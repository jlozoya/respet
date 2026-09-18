import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  BlockedUser,
  Hashtag as HashtagDto,
  OnlineContact,
  SearchResults,
  UserSuggestion,
} from '@social-network/shared';

import { AppException, ErrorCode } from '../common/errors.js';
import { POPULATE_POST, toIso, toUserSummary } from '../common/mappers.js';
import { escapeRegex } from '../common/utils/regex.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Follow, Hashtag, Post } from '../database/schemas/content.schema.js';
import { Block, User } from '../database/schemas/user.schema.js';
import { PresenceService } from '../realtime/presence.service.js';
import { PostViewService } from './post-view.service.js';
import { ProfileService } from './profile.service.js';
import { RelationshipService } from './relationship.service.js';
import { normalizeHashtag } from './text.js';

const SUMMARY_FIELDS = 'name firstName lastName avatarId verified';

/**
 * Lo social que no es de nadie en concreto: bloqueos, buscador, etiquetas,
 * sugerencias y contactos conectados.
 */
@Injectable()
export class SocialService {
  constructor(
    @InjectModel(Block.name) private readonly blocks: Model<Block>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Hashtag.name) private readonly hashtags: Model<Hashtag>,
    private readonly relationships: RelationshipService,
    private readonly profiles: ProfileService,
    private readonly postViews: PostViewService,
    private readonly presence: PresenceService,
  ) {}

  // --- Bloqueos ---------------------------------------------------------------

  /**
   * Bloquea a alguien.
   *
   * Además de apuntar el bloqueo deshace los seguimientos en los dos sentidos:
   * bloquear a alguien y que siga figurando entre tus seguidores no se
   * entendería.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'You cannot block yourself');
    }

    if (!isValidObjectId(blockedId) || !(await this.users.exists({ _id: blockedId }))) {
      throw AppException.notFound('User');
    }

    await this.blocks.updateOne({ blockerId, blockedId }, { $setOnInsert: { blockerId, blockedId } }, { upsert: true });
    await this.follows.deleteMany({
      $or: [
        { followerId: blockerId, followeeId: blockedId },
        { followerId: blockedId, followeeId: blockerId },
      ],
    });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blocks.deleteOne({ blockerId, blockedId });
  }

  async blockedUsers(userId: string): Promise<BlockedUser[]> {
    const docs = await this.blocks
      .find({ blockerId: userId })
      .sort({ createdAt: -1 })
      .populate({ path: 'blocked', select: SUMMARY_FIELDS, populate: { path: 'avatar' } })
      .lean();

    return docs
      .filter((doc) => (doc as { blocked?: unknown }).blocked)
      .map((doc) => ({
        user: toUserSummary((doc as unknown as { blocked: Parameters<typeof toUserSummary>[0] }).blocked),
        blockedAt: toIso(doc.createdAt),
      }));
  }

  // --- Buscador ---------------------------------------------------------------

  /**
   * Busca personas, etiquetas y publicaciones.
   *
   * Las personas se buscan por prefijo del nombre de usuario o del nombre
   * visible, que es como se escribe un nombre en un buscador; las
   * publicaciones, por el índice de texto. Con `#` delante sólo se buscan
   * etiquetas y publicaciones con esa etiqueta.
   */
  async search(term: string, viewerId: string | null, limit = 10): Promise<SearchResults> {
    const clean = term.trim().slice(0, 80);

    if (clean.length === 0) {
      return { users: [], hashtags: [], posts: [] };
    }

    const context = await this.relationships.viewerContext(viewerId);
    const blocked = [...context.blockedIds].map((id) => new ObjectId(id));
    const asTag = clean.startsWith('#');
    const tag = normalizeHashtag(clean);
    const prefix = new RegExp(`^${escapeRegex(asTag ? tag : clean.replace(/^@/, ''))}`, 'i');

    const [userDocs, tagDocs, postDocs] = await Promise.all([
      asTag
        ? Promise.resolve([])
        : this.users
            .find({
              _id: { $nin: blocked },
              $or: [{ name: prefix }, { firstName: prefix }, { lastName: prefix }],
            })
            .select('_id')
            .limit(limit)
            .lean(),
      tag.length > 0
        ? this.hashtags.find({ tag: new RegExp(`^${escapeRegex(tag)}`) }).sort({ postCount: -1 }).limit(limit).lean()
        : Promise.resolve([]),
      this.posts
        .find({
          ...(asTag ? { hashtags: tag } : { $text: { $search: clean } }),
          ...this.relationships.visiblePostsFilter(context),
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate(POPULATE_POST)
        .lean(),
    ]);

    return {
      users: await this.profiles.byIds(
        userDocs.map((doc) => doc._id),
        viewerId,
      ),
      hashtags: tagDocs.map((doc) => ({ tag: doc.tag, postCount: doc.postCount })),
      posts: await this.postViews.present(postDocs, viewerId, context),
    };
  }

  /** Las etiquetas más usadas en la última semana. */
  async trendingHashtags(limit = 10): Promise<HashtagDto[]> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await this.posts.aggregate<{ _id: string; total: number }>([
      { $match: { createdAt: { $gte: since }, audience: 'public', hashtags: { $ne: [] } } },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]);

    if (rows.length > 0) {
      return rows.map((row) => ({ tag: row._id, postCount: row.total }));
    }

    const docs = await this.hashtags.find().sort({ postCount: -1 }).limit(limit).lean();

    return docs.map((doc) => ({ tag: doc.tag, postCount: doc.postCount }));
  }

  /**
   * Personas que quizá conozcas.
   *
   * Los seguidos de tus seguidos, ordenados por cuántos de tus seguidos los
   * siguen —«amigos de amigos»—. Quien aún no sigue a nadie recibe las
   * cuentas con más seguidores.
   */
  async suggestions(userId: string, limit = 10): Promise<UserSuggestion[]> {
    const [following, blocked] = await Promise.all([
      this.relationships.followingIds(userId),
      this.relationships.blockedIds(userId),
    ]);

    const exclude = [
      new ObjectId(userId),
      ...following,
      ...[...blocked].map((id) => new ObjectId(id)),
    ];

    // Incluye también las solicitudes pendientes: no se sugiere a quien ya se pidió seguir.
    const pending = await this.follows.find({ followerId: userId, pending: true }).select('followeeId').lean();
    exclude.push(...pending.map((doc) => doc.followeeId));

    let rows: { _id: Types.ObjectId; total: number; via: Types.ObjectId[] }[] = [];

    if (following.length > 0) {
      rows = await this.follows.aggregate([
        { $match: { followerId: { $in: following }, followeeId: { $nin: exclude }, pending: { $ne: true } } },
        { $group: { _id: '$followeeId', total: { $sum: 1 }, via: { $push: '$followerId' } } },
        { $sort: { total: -1 } },
        { $limit: limit },
      ]);
    }

    if (rows.length < limit) {
      const popular = await this.follows.aggregate<{ _id: Types.ObjectId; total: number }>([
        {
          $match: {
            followeeId: { $nin: [...exclude, ...rows.map((row) => row._id)] },
            pending: { $ne: true },
          },
        },
        { $group: { _id: '$followeeId', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: limit - rows.length },
      ]);

      rows.push(...popular.map((row) => ({ _id: row._id, total: 0, via: [] })));
    }

    if (rows.length < limit) {
      // Una red recién estrenada no tiene aún seguimientos: se completa con
      // las cuentas más recientes.
      const recent = await this.users
        .find({ _id: { $nin: [...exclude, ...rows.map((row) => row._id)] } })
        .sort({ createdAt: -1 })
        .limit(limit - rows.length)
        .select('_id')
        .lean();

      rows.push(...recent.map((doc) => ({ _id: doc._id, total: 0, via: [] })));
    }

    const userIds = [...new Set(rows.flatMap((row) => [row._id, ...row.via.slice(0, 2)]).map(String))];
    const docs = await this.users
      .find({ _id: { $in: userIds } })
      .select(SUMMARY_FIELDS)
      .populate('avatar')
      .lean();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

    return rows
      .filter((row) => byId.has(String(row._id)))
      .map((row) => ({
        user: toUserSummary(byId.get(String(row._id)) as never),
        mutualCount: row.total,
        mutuals: row.via
          .slice(0, 2)
          .map((id) => byId.get(String(id)))
          .filter(Boolean)
          .map((doc) => toUserSummary(doc as never)),
      }));
  }

  /**
   * Las personas que sigues con su estado de conexión: la columna de
   * contactos de Facebook. Primero las conectadas.
   */
  async onlineContacts(userId: string, limit = 30): Promise<OnlineContact[]> {
    const following = await this.relationships.followingIds(userId);

    if (following.length === 0) {
      return [];
    }

    const online = await this.presence.visibleOnlineAmong(following.map(String));
    const docs = await this.users
      .find({ _id: { $in: following } })
      .select(`${SUMMARY_FIELDS} lastSeenAt`)
      .populate('avatar')
      .lean();

    return docs
      .map((doc) => ({
        user: toUserSummary(doc as never),
        online: online.has(String(doc._id)),
        lastSeenAt: online.has(String(doc._id)) ? null : toIso(doc.lastSeenAt),
      }))
      .sort((a, b) => Number(b.online) - Number(a.online) || (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''))
      .slice(0, limit);
  }
}
