import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  Media,
  Paginated,
  Post as PostDto,
  PostReactor,
  ReactionResult,
} from '@social-network/shared';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { POPULATE_POST, toMedia, toReactionSummary, toUserSummary } from '../common/mappers.js';
import { boundingBox, distanceKm } from '../common/utils/geo.js';
import { upsertLocation } from '../common/utils/location.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import {
  Comment,
  CommentLike,
  Hashtag,
  Location,
  Media as MediaDoc,
  Post,
  PostReaction,
  SavedPost,
} from '../database/schemas/content.schema.js';
import {
  Audience,
  NotificationType,
  ReactionType,
  ReportTarget,
} from '../database/schemas/enums.js';
import { MediaService } from '../media/media.service.js';
import type { PendingUpload } from '../media/upload.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import { PostViewService, type LeanPost } from '../social/post-view.service.js';
import { RelationshipService, type ViewerContext } from '../social/relationship.service.js';
import { extractHashtags, extractMentions, normalizeHashtag } from '../social/text.js';
import type {
  CreatePostDto,
  PostListQueryDto,
  ReactorListQueryDto,
  ReportPostDto,
  UpdatePostDto,
} from './dto/post.dto.js';

/** Fotos y vídeos por publicación, como en Instagram. */
const MAX_MEDIA_PER_POST = 10;

/**
 * Publicaciones que se traen como mucho al buscar por cercanía.
 *
 * Acota el coste de filtrar y ordenar en memoria; con este volumen de datos
 * sobra de largo para cualquier radio razonable.
 */
const NEARBY_SCAN_LIMIT = 500;

/** Por debajo de tantos seguidos, el muro de portada se completa con lo destacado. */
const HOME_DISCOVERY_THRESHOLD = 30;

type PostFilter = Record<string, unknown>;

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(PostReaction.name) private readonly reactions: Model<PostReaction>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(CommentLike.name) private readonly commentLikes: Model<CommentLike>,
    @InjectModel(SavedPost.name) private readonly saved: Model<SavedPost>,
    @InjectModel(Hashtag.name) private readonly hashtags: Model<Hashtag>,
    @InjectModel(MediaDoc.name) private readonly mediaModel: Model<MediaDoc>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
    private readonly media: MediaService,
    private readonly views: PostViewService,
    private readonly relationships: RelationshipService,
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService,
    private readonly bus: EventBusService,
  ) {}

  /**
   * El muro, en cualquiera de sus formas.
   *
   * Con `lat` y `lng` se ordena por cercanía; si no, por fecha. Cada resultado
   * pasa por las reglas de visibilidad: audiencia, perfil privado y bloqueos.
   */
  async list(query: PostListQueryDto, viewerId: string | null): Promise<Paginated<PostDto>> {
    const context = await this.relationships.viewerContext(viewerId);

    if (query.userId) {
      await this.relationships.assertCanViewContentOf(viewerId, query.userId);
    }

    const filter = this.buildFilter(query, context);

    if (query.lat !== undefined && query.lng !== undefined) {
      return this.listNearby(query, filter, context);
    }

    const { skip, take, page, perPage } = toPage(query);

    const [docs, total] = await Promise.all([
      this.posts.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).populate(POPULATE_POST).lean(),
      this.posts.countDocuments(filter),
    ]);

    return paginate(await this.views.present(docs as unknown as LeanPost[], viewerId, context), total, page, perPage);
  }

  /**
   * Explorar: lo más comentado y con más reacciones del último mes, con foto
   * o vídeo, de quien no sigues todavía. La cuadrícula de Instagram.
   */
  async explore(viewerId: string | null, page: number, perPage: number): Promise<Paginated<PostDto>> {
    const context = await this.relationships.viewerContext(viewerId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pagination = toPage({ page, perPage });

    const filter: PostFilter = {
      $and: [
        this.relationships.visiblePostsFilter(context),
        { mediaCount: { $gt: 0 }, createdAt: { $gte: since } },
        ...(viewerId ? [{ userId: { $ne: new ObjectId(viewerId) } }] : []),
      ],
    };

    const [docs, total] = await Promise.all([
      this.posts.aggregate<{ _id: Types.ObjectId }>([
        { $match: filter },
        { $addFields: { score: { $add: ['$reactionCount', { $multiply: ['$commentCount', 2] }, '$shareCount'] } } },
        { $sort: { score: -1, createdAt: -1 } },
        { $skip: pagination.skip },
        { $limit: pagination.take },
        { $project: { _id: 1 } },
      ]),
      this.posts.countDocuments(filter),
    ]);

    const ids = docs.map((doc) => doc._id);
    const full = await this.posts.find({ _id: { $in: ids } }).populate(POPULATE_POST).lean();
    const order = new Map(ids.map((id, index) => [String(id), index]));
    const sorted = (full as unknown as LeanPost[]).sort(
      (a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0),
    );

    return paginate(await this.views.present(sorted, viewerId, context), total, pagination.page, pagination.perPage);
  }

  /**
   * Listado ordenado por cercanía.
   *
   * La distancia real no se calcula en la consulta: la base acota con una caja
   * de coordenadas —que sí usa el índice de `lat`/`lng`— y el recorte fino se
   * hace aquí. Por eso la paginación también se resuelve en memoria: si se
   * paginara en la base, el total contaría publicaciones que luego quedan fuera
   * del radio y las páginas saldrían con huecos.
   */
  private async listNearby(
    query: PostListQueryDto,
    filter: PostFilter,
    context: ViewerContext,
  ): Promise<Paginated<PostDto>> {
    const { page, perPage } = toPage(query);
    const center = { lat: query.lat as number, lng: query.lng as number };
    const radiusKm = query.radiusKm ?? 50;

    // El difuminado desplaza el punto como mucho 25 km, así que la caja se
    // amplía para no perder publicaciones por el camino.
    const box = boundingBox(center, radiusKm + 25);
    const nearby = await this.locations
      .find({ lat: { $gte: box.minLat, $lte: box.maxLat }, lng: { $gte: box.minLng, $lte: box.maxLng } })
      .select('_id')
      .lean();

    const docs = await this.posts
      .find({ $and: [filter, { locationId: { $in: nearby.map((doc) => doc._id) } }] })
      .sort({ createdAt: -1 })
      .limit(NEARBY_SCAN_LIMIT)
      .populate(POPULATE_POST)
      .lean();

    const near = (await this.views.present(docs as unknown as LeanPost[], context.viewerId, context))
      .map((post) => ({
        post,
        distance:
          post.location?.lat != null && post.location.lng != null
            ? distanceKm(center, { lat: post.location.lat, lng: post.location.lng })
            : Number.POSITIVE_INFINITY,
      }))
      .filter((entry) => entry.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.post);

    const start = (page - 1) * perPage;

    return paginate(near.slice(start, start + perPage), near.length, page, perPage);
  }

  async findById(id: string, viewerId: string | null): Promise<PostDto> {
    const doc = await this.findVisibleDoc(id, viewerId);
    const [post] = await this.views.present([doc], viewerId);

    return post;
  }

  async savedPosts(userId: string, page: number, perPage: number): Promise<Paginated<PostDto>> {
    const pagination = toPage({ page, perPage });
    const context = await this.relationships.viewerContext(userId);

    const [rows, total] = await Promise.all([
      this.saved.find({ userId }).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.take).lean(),
      this.saved.countDocuments({ userId }),
    ]);

    const docs = await this.posts
      .find({ $and: [{ _id: { $in: rows.map((row) => row.postId) } }, this.relationships.visiblePostsFilter(context)] })
      .populate(POPULATE_POST)
      .lean();
    const order = new Map(rows.map((row, index) => [String(row.postId), index]));
    const sorted = (docs as unknown as LeanPost[]).sort(
      (a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0),
    );

    return paginate(await this.views.present(sorted, userId, context), total, pagination.page, pagination.perPage);
  }

  /**
   * Publica.
   *
   * Las fotos y vídeos llegan en la misma operación. Se guardan antes que la
   * publicación y, si alguno no vale, se borran los que ya estaban: nunca
   * queda una publicación a medias ni archivos sueltos.
   */
  async create(author: AuthenticatedUser, dto: CreatePostDto, files: PendingUpload[] = []): Promise<PostDto> {
    const description = (dto.description ?? '').trim();

    if (files.length > MAX_MEDIA_PER_POST) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, `A post cannot have more than ${MAX_MEDIA_PER_POST} files`);
    }

    if (!description && files.length === 0 && !dto.sharedPostId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The post is empty');
    }

    if (dto.sharedPostId) {
      // Sólo se comparte lo que uno puede ver. Y lo compartido apunta siempre
      // al original, como en Facebook: compartir algo compartido no anida.
      const shared = await this.findVisibleDoc(dto.sharedPostId, author.id);

      if (shared.audience !== Audience.Public || shared.authorPrivate) {
        throw AppException.forbiddenWith(ErrorCode.PrivateContent, 'Only public posts can be shared');
      }

      dto.sharedPostId = shared.sharedPostId ? String(shared.sharedPostId) : dto.sharedPostId;
    }

    const stored: Types.ObjectId[] = [];

    try {
      for (const [position, file] of files.entries()) {
        const media = await this.media.storeUpload(file, {
          accept: ['image', 'video'],
          preset: 'post',
          uploaderId: author.id,
          position,
          alt: description.slice(0, 120) || 'post',
          maxDurationMs: 10 * 60 * 1000,
        });
        stored.push(media._id);
      }
    } catch (error) {
      await this.media.removeMany(stored);
      throw error;
    }

    const locationId = await upsertLocation(this.locations, null, dto.location);
    const hashtags = extractHashtags(description);
    const mentionIds = await this.relationships.resolveUsernames(extractMentions(description), author.id);

    const created = await this.posts.create({
      userId: author.id,
      description,
      kind: dto.kind ?? 'general',
      audience: dto.audience ?? Audience.Public,
      authorPrivate: await this.relationships.isPrivate(author.id),
      locationId: locationId ?? null,
      locationAccuracy: dto.locationAccuracy ?? 0,
      hashtags,
      mentionIds,
      sharedPostId: dto.sharedPostId ?? null,
      commentsDisabled: dto.commentsDisabled ?? false,
      mediaCount: stored.length,
    });

    await this.media.attachToPost(stored, created._id);
    await this.trackHashtags(hashtags, []);

    const postId = String(created._id);

    if (dto.sharedPostId) {
      const original = await this.posts
        .findByIdAndUpdate(dto.sharedPostId, { $inc: { shareCount: 1 } })
        .select('userId')
        .lean();

      if (original) {
        await this.notifications.notify({
          recipientId: original.userId,
          actorId: author.id,
          type: NotificationType.PostShared,
          postId: dto.sharedPostId,
        });
      }
    }

    await this.notifyMentions(mentionIds, author.id, postId, description);
    await this.bus.publish(Topic.domain(DomainEvent.PostCreated), { postId, userId: author.id });

    return this.findById(postId, author.id);
  }

  async update(id: string, dto: UpdatePostDto, actor: AuthenticatedUser): Promise<PostDto> {
    const post = await this.assertCanEdit(id, actor);
    const locationId = await upsertLocation(this.locations, post.locationId ? String(post.locationId) : null, dto.location);

    const changes: Record<string, unknown> = {
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
      ...(dto.commentsDisabled !== undefined ? { commentsDisabled: dto.commentsDisabled } : {}),
      ...(dto.locationAccuracy !== undefined ? { locationAccuracy: dto.locationAccuracy } : {}),
      ...(locationId !== undefined ? { locationId } : {}),
    };

    if (dto.description !== undefined && dto.description.trim() !== post.description) {
      const description = dto.description.trim();
      const hashtags = extractHashtags(description);
      const mentionIds = await this.relationships.resolveUsernames(extractMentions(description), post.userId.toString());
      const previousMentions = new Set(post.mentionIds.map(String));

      Object.assign(changes, { description, hashtags, mentionIds, editedAt: new Date() });

      await this.trackHashtags(
        hashtags.filter((tag) => !post.hashtags.includes(tag)),
        post.hashtags.filter((tag) => !hashtags.includes(tag)),
      );
      await this.notifyMentions(
        mentionIds.filter((mention) => !previousMentions.has(String(mention))),
        actor.id,
        id,
        description,
      );
    }

    await this.posts.updateOne({ _id: id }, { $set: changes });

    return this.findById(id, actor.id);
  }

  /**
   * Borra la publicación y todo lo que colgaba de ella.
   *
   * No hay claves foráneas en cascada que lo hagan solo: reacciones,
   * comentarios con sus «me gusta», guardados, avisos y archivos se limpian a
   * mano. Las publicaciones que la compartían se quedan, marcando que lo
   * compartido ya no está.
   */
  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const post = await this.assertCanEdit(id, actor);
    const mediaIds = (await this.mediaModel.find({ postId: id }).select('_id').lean()).map((doc) => doc._id);
    const commentIds = (await this.comments.find({ postId: id }).select('_id').lean()).map((doc) => doc._id);

    await Promise.all([
      this.posts.deleteOne({ _id: id }),
      this.reactions.deleteMany({ postId: id }),
      this.comments.deleteMany({ postId: id }),
      this.commentLikes.deleteMany({ commentId: { $in: commentIds } }),
      this.saved.deleteMany({ postId: id }),
      this.notifications.removeFor({ postId: id }),
      post.sharedPostId
        ? this.posts.updateOne({ _id: post.sharedPostId, shareCount: { $gt: 0 } }, { $inc: { shareCount: -1 } })
        : Promise.resolve(),
    ]);

    await this.trackHashtags([], post.hashtags);
    await this.media.removeMany(mediaIds);
    await this.bus.publish(Topic.domain(DomainEvent.PostDeleted), { postId: id, userId: String(post.userId) });
  }

  async addMedia(id: string, file: PendingUpload, actor: AuthenticatedUser): Promise<Media> {
    await this.assertCanEdit(id, actor);

    const count = await this.mediaModel.countDocuments({ postId: id });

    if (count >= MAX_MEDIA_PER_POST) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, `A post cannot have more than ${MAX_MEDIA_PER_POST} files`);
    }

    const stored = await this.media.storeUpload(file, {
      accept: ['image', 'video'],
      preset: 'post',
      postId: id,
      uploaderId: actor.id,
      position: count,
    });

    await this.posts.updateOne({ _id: id }, { $inc: { mediaCount: 1 } });

    return toMedia(stored);
  }

  async removeMedia(id: string, mediaId: string, actor: AuthenticatedUser): Promise<void> {
    await this.assertCanEdit(id, actor);

    if (!isValidObjectId(mediaId) || !(await this.mediaModel.exists({ _id: mediaId, postId: id }))) {
      throw AppException.notFound('Media');
    }

    await this.media.remove(mediaId);
    await this.posts.updateOne({ _id: id, mediaCount: { $gt: 0 } }, { $inc: { mediaCount: -1 } });
  }

  /**
   * Reacciona a una publicación.
   *
   * Una reacción por persona: elegir otra la sustituye. Las cifras se guardan
   * en la propia publicación y se ajustan con `$inc`, de modo que dos
   * reacciones simultáneas no se pisan.
   */
  async react(postId: string, userId: string, type: ReactionType): Promise<ReactionResult> {
    const post = await this.findVisibleDoc(postId, userId);

    const previous = await this.reactions
      .findOneAndUpdate({ postId, userId }, { $set: { type } }, { upsert: true, returnDocument: 'before' })
      .lean();

    if (!previous) {
      await this.posts.updateOne({ _id: postId }, { $inc: { reactionCount: 1, [`reactions.${type}`]: 1 } });
      await this.notifications.notify({
        recipientId: post.userId,
        actorId: userId,
        type: NotificationType.Reaction,
        postId,
        preview: type,
      });
      await this.bus.publish(Topic.domain(DomainEvent.ReactionAdded), { postId, userId, type });
    } else if (previous.type !== type) {
      await this.posts.updateOne(
        { _id: postId },
        { $inc: { [`reactions.${previous.type}`]: -1, [`reactions.${type}`]: 1 } },
      );
    }

    return this.reactionResult(postId, type);
  }

  async unreact(postId: string, userId: string): Promise<ReactionResult> {
    const post = await this.findVisibleDoc(postId, userId);
    const previous = await this.reactions.findOneAndDelete({ postId, userId }).lean();

    if (previous) {
      await this.posts.updateOne(
        { _id: postId },
        { $inc: { reactionCount: -1, [`reactions.${previous.type}`]: -1 } },
      );
      await this.notifications.retract({
        recipientId: post.userId,
        actorId: userId,
        type: NotificationType.Reaction,
        postId,
      });
    }

    return this.reactionResult(postId, null);
  }

  /** Quién reaccionó, con qué, y si quien mira ya le sigue. */
  async reactors(postId: string, query: ReactorListQueryDto, viewerId: string | null): Promise<Paginated<PostReactor>> {
    await this.findVisibleDoc(postId, viewerId);

    const { skip, take, page, perPage } = toPage(query);
    const blocked = viewerId ? [...(await this.relationships.blockedIds(viewerId))] : [];
    const filter = {
      postId,
      ...(query.type ? { type: query.type } : {}),
      ...(blocked.length > 0 ? { userId: { $nin: blocked } } : {}),
    };

    const [docs, total] = await Promise.all([
      this.reactions
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate({ path: 'user', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } })
        .lean(),
      this.reactions.countDocuments(filter),
    ]);

    const states = await this.relationships.followStates(
      viewerId,
      docs.map((doc) => String(doc.userId)),
    );

    return paginate(
      docs
        .filter((doc) => (doc as { user?: unknown }).user)
        .map((doc) => ({
          user: toUserSummary((doc as unknown as { user: never }).user),
          type: doc.type,
          followState: states.get(String(doc.userId)) ?? null,
        })),
      total,
      page,
      perPage,
    );
  }

  async save(postId: string, userId: string): Promise<boolean> {
    await this.findVisibleDoc(postId, userId);
    await this.saved.updateOne({ userId, postId }, { $setOnInsert: { userId, postId } }, { upsert: true });

    return true;
  }

  async unsave(postId: string, userId: string): Promise<boolean> {
    await this.saved.deleteOne({ userId, postId });

    return false;
  }

  async report(id: string, dto: ReportPostDto, reporterId: string): Promise<void> {
    await this.moderation.report(reporterId, ReportTarget.Post, id, dto.reason);
  }

  /** La publicación, si existe y quien mira puede verla. Si no, «no encontrada». */
  async findVisibleDoc(id: string, viewerId: string | null): Promise<LeanPost> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Post');
    }

    const doc = (await this.posts.findById(id).populate(POPULATE_POST).lean()) as unknown as
      | (LeanPost & { sharedPostId: Types.ObjectId | null })
      | null;

    if (!doc) {
      throw AppException.notFound('Post');
    }

    const context = await this.relationships.viewerContext(viewerId);
    const visible = this.relationships.canSee(context, {
      ownerId: String(doc.userId),
      audience: doc.audience,
      ownerPrivate: doc.authorPrivate === true,
    });

    if (!visible) {
      // «No encontrada» y no «prohibida»: confirmar que existe ya diría más de
      // la cuenta a quien no puede verla.
      throw AppException.notFound('Post');
    }

    return doc;
  }

  private async reactionResult(postId: string, myReaction: ReactionType | null): Promise<ReactionResult> {
    const post = await this.posts.findById(postId).select('reactions reactionCount').lean();

    return {
      reactionCount: Math.max(0, post?.reactionCount ?? 0),
      reactionSummary: toReactionSummary(post?.reactions),
      myReaction,
    };
  }

  /**
   * Comprueba que la publicación existe y que quien actúa puede tocarla.
   *
   * Devuelve lo que necesitan las operaciones de escritura, para no repetir la
   * consulta después.
   */
  private async assertCanEdit(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<Post & { _id: Types.ObjectId }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Post');
    }

    const post = await this.posts.findById(id).lean();

    if (!post) {
      throw AppException.notFound('Post');
    }

    if (String(post.userId) !== actor.id && actor.role !== 'admin') {
      throw AppException.forbidden('You can only modify your own posts');
    }

    return post;
  }

  private buildFilter(query: PostListQueryDto, context: ViewerContext): PostFilter {
    const filtros: PostFilter[] = [this.relationships.visiblePostsFilter(context)];

    if (query.kind) {
      filtros.push({ kind: query.kind });
    }

    if (query.userId) {
      filtros.push({ userId: new ObjectId(query.userId) });
    }

    if (query.hashtag) {
      filtros.push({ hashtags: normalizeHashtag(query.hashtag) });
    }

    if (query.withMediaOnly) {
      filtros.push({ mediaCount: { $gt: 0 } });
    }

    if (query.search?.trim()) {
      filtros.push({ $text: { $search: query.search.trim() } });
    }

    const feed = query.userId || query.hashtag ? 'discover' : (query.feed ?? 'discover');

    if (context.viewerId && (feed === 'following' || feed === 'home')) {
      const authors = [...context.followingIds, context.viewerId].map((id) => new ObjectId(id));

      // Quien sigue a poca gente vería un muro casi vacío: se le añade lo
      // público reciente, que es lo que hace Facebook con las «sugerencias».
      if (feed === 'home' && context.followingIds.size < HOME_DISCOVERY_THRESHOLD) {
        filtros.push({
          $or: [
            { userId: { $in: authors } },
            { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
          ],
        });
      } else {
        filtros.push({ userId: { $in: authors } });
      }
    }

    return filtros.length === 1 ? (filtros[0]) : { $and: filtros };
  }

  private async notifyMentions(
    mentionIds: Types.ObjectId[],
    actorId: string,
    postId: string,
    text: string,
  ): Promise<void> {
    await Promise.all(
      mentionIds.map((recipientId) =>
        this.notifications.notify({
          recipientId,
          actorId,
          type: NotificationType.Mention,
          postId,
          preview: text.slice(0, 120),
        }),
      ),
    );
  }

  /** Lleva la cuenta de cuántas publicaciones usan cada etiqueta. */
  private async trackHashtags(added: string[], removed: string[]): Promise<void> {
    const now = new Date();

    await Promise.all([
      ...added.map((tag) =>
        this.hashtags.updateOne({ tag }, { $inc: { postCount: 1 }, $set: { lastUsedAt: now } }, { upsert: true }),
      ),
      ...removed.map((tag) => this.hashtags.updateOne({ tag, postCount: { $gt: 0 } }, { $inc: { postCount: -1 } })),
    ]);
  }
}
