import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Media, Paginated, Post as PostDto, PostVoteResult, VoteValue } from '@respet/shared';
import { ObjectId, isValidObjectId } from '../database/mongoose.js';
import type { Model, Types } from '../database/mongoose.js';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { POPULATE_POST, toMedia, toPost, type PostVotes } from '../common/mappers.js';
import { boundingBox, distanceKm, fuzzyPoint } from '../common/utils/geo.js';
import { upsertLocation } from '../common/utils/location.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { escapeRegex } from '../common/utils/regex.js';
import {
  Comment,
  Follow,
  Location,
  Media as MediaDoc,
  Post,
  PostReport,
  PostVote,
} from '../database/schemas/content.schema.js';
import { MediaService } from '../media/media.service.js';
import type {
  CreatePostDto,
  PostListQueryDto,
  ReportPostDto,
  UpdatePostDto,
} from './dto/post.dto.js';

/**
 * Publicación leída con `.lean()`.
 *
 * Lo único que este servicio necesita saber de ella es que tiene identificador:
 * de la forma completa —con los virtuales poblados— se ocupa el mapeador.
 */
type LeanPost = { _id: unknown };

/** Filtro de búsqueda tal y como lo entiende `find`. */
type PostFilter = Record<string, unknown>;

/** Imágenes por publicación. */
const MAX_MEDIA_PER_POST = 6;

/**
 * Publicaciones que se traen como mucho al buscar por cercanía.
 *
 * Acota el coste de filtrar y ordenar en memoria; con este volumen de datos
 * sobra de largo para cualquier radio razonable.
 */
const NEARBY_SCAN_LIMIT = 500;

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(PostVote.name) private readonly votes: Model<PostVote>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(PostReport.name) private readonly reports: Model<PostReport>,
    @InjectModel(MediaDoc.name) private readonly mediaModel: Model<MediaDoc>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    private readonly media: MediaService,
  ) {}

  async list(query: PostListQueryDto, viewerId: string | null = null): Promise<Paginated<PostDto>> {
    const geo = this.geoFilterOf(query);

    return geo
      ? this.listNearby(query, geo, viewerId)
      : this.listChronological(query, viewerId);
  }

  private async listChronological(
    query: PostListQueryDto,
    viewerId: string | null,
  ): Promise<Paginated<PostDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const where = await this.buildFilter(query, null, viewerId);

    const [docs, total] = await Promise.all([
      this.posts
        .find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate(POPULATE_POST)
        .lean(),
      this.posts.countDocuments(where),
    ]);

    return paginate(await this.decorate(docs, viewerId), total, page, perPage);
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
    geo: { lat: number; lng: number; radiusKm: number },
    viewerId: string | null,
  ): Promise<Paginated<PostDto>> {
    const { page, perPage } = toPage(query);
    const center = { lat: geo.lat, lng: geo.lng };

    const docs = await this.posts
      .find(await this.buildFilter(query, geo, viewerId))
      .sort({ createdAt: -1 })
      .limit(NEARBY_SCAN_LIMIT)
      .populate(POPULATE_POST)
      .lean();

    const near = (await this.decorate(docs, viewerId))
      .map((post) => ({
        post,
        distance:
          post.location?.lat != null && post.location.lng != null
            ? distanceKm(center, { lat: post.location.lat, lng: post.location.lng })
            : Number.POSITIVE_INFINITY,
      }))
      .filter((entry) => entry.distance <= geo.radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.post);

    const start = (page - 1) * perPage;

    return paginate(near.slice(start, start + perPage), near.length, page, perPage);
  }

  async findById(id: string, viewerId: string | null = null): Promise<PostDto> {
    const doc = await this.findDocOrFail(id);
    const [decorado] = await this.decorate([doc], viewerId);

    return decorado!;
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostDto> {
    const locationId = await upsertLocation(this.locations, null, dto.location);

    const created = await this.posts.create({
      userId,
      description: dto.description,
      kind: dto.kind,
      locationId: locationId ?? null,
      locationAccuracy: dto.locationAccuracy ?? 0,
    });

    return this.findById(String(created._id), userId);
  }

  async update(id: string, dto: UpdatePostDto, actor: AuthenticatedUser): Promise<PostDto> {
    const post = await this.assertCanEdit(id, actor);
    const locationId = await upsertLocation(this.locations, post.locationId, dto.location);

    await this.posts.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
          ...(dto.locationAccuracy !== undefined
            ? { locationAccuracy: dto.locationAccuracy }
            : {}),
          ...(locationId !== undefined ? { locationId } : {}),
        },
      },
    );

    return this.findById(id, actor.id);
  }

  /**
   * Borra la publicación y todo lo que colgaba de ella.
   *
   * En SQL lo hacían las claves foráneas en cascada; aquí no hay quien lo haga
   * por nosotros, así que se limpia a mano: votos, comentarios, denuncias y
   * archivos. Dejarlos convertiría la base en un cementerio de referencias a
   * documentos que ya no existen.
   */
  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const post = await this.assertCanEdit(id, actor);

    await Promise.all([
      this.posts.deleteOne({ _id: id }),
      this.votes.deleteMany({ postId: id }),
      this.comments.deleteMany({ postId: id }),
      this.reports.deleteMany({ postId: id }),
    ]);

    await this.media.removeMany(post.mediaIds);
  }

  async addMedia(id: string, file: Express.Multer.File, actor: AuthenticatedUser): Promise<Media> {
    const post = await this.assertCanEdit(id, actor);

    if (post.mediaIds.length >= MAX_MEDIA_PER_POST) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        `A post cannot have more than ${MAX_MEDIA_PER_POST} images`,
      );
    }

    const created = await this.media.createFromUpload(file, 'post', {
      postId: id,
      position: post.mediaIds.length,
      alt: post.description.slice(0, 120),
    });

    const doc = await this.mediaModel.findById(created.id).lean();

    if (!doc) {
      throw AppException.notFound('Media');
    }

    return toMedia(doc as never);
  }

  async removeMedia(id: string, mediaId: string, actor: AuthenticatedUser): Promise<void> {
    const post = await this.assertCanEdit(id, actor);

    if (!post.mediaIds.includes(mediaId)) {
      throw AppException.notFound('Media');
    }

    await this.media.remove(mediaId);
  }

  /**
   * Registra la denuncia de una publicación.
   *
   * Denunciar dos veces la misma actualiza el motivo en lugar de acumular
   * documentos: el peso de una denuncia no debe depender de cuántas veces pulse
   * el botón la misma persona.
   */
  async report(id: string, dto: ReportPostDto, reporterId: string): Promise<void> {
    const post = await this.posts.findById(id).select('userId').lean();

    if (!post) {
      throw AppException.notFound('Post');
    }

    if (String(post.userId) === reporterId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'You cannot report your own post');
    }

    await this.reports.updateOne(
      { postId: id, reporterId },
      { $set: { reason: dto.reason, status: 'pending' } },
      { upsert: true },
    );
  }

  /**
   * Vota una publicación, a favor o en contra.
   *
   * Es un solo documento por persona y publicación, así que votar lo contrario
   * cambia el sentido en lugar de acumular: nadie aparece a la vez a favor y en
   * contra de lo mismo. Se devuelven las cuentas ya hechas para que la
   * aplicación no tenga que adivinarlas, que es como se desincronizan.
   */
  async vote(postId: string, userId: string, value: VoteValue): Promise<PostVoteResult> {
    await this.assertExists(postId);

    await this.votes.updateOne({ postId, userId }, { $set: { value } }, { upsert: true });

    return this.voteResult(postId, userId);
  }

  /** Retira el voto propio, sea el que sea. */
  async unvote(postId: string, userId: string): Promise<PostVoteResult> {
    await this.assertExists(postId);
    await this.votes.deleteOne({ postId, userId });

    return this.voteResult(postId, userId);
  }

  private async voteResult(postId: string, userId: string): Promise<PostVoteResult> {
    const resumen = (await this.voteSummaries(userId, [postId])).get(postId);

    return {
      likeCount: resumen?.likeCount ?? 0,
      dislikeCount: resumen?.dislikeCount ?? 0,
      myVote: resumen?.myVote ?? null,
    };
  }

  /**
   * Añade a cada publicación sus votos y su número de comentarios.
   *
   * Tres consultas agrupadas para todo el listado —cifras de voto, voto propio
   * y comentarios—, en lugar de una por tarjeta.
   */
  private async decorate(docs: LeanPost[], viewerId: string | null): Promise<PostDto[]> {
    const ids = docs.map((doc) => String(doc._id));
    const [votos, comentarios] = await Promise.all([
      this.voteSummaries(viewerId, ids),
      this.commentCounts(ids),
    ]);

    return docs.map((doc) => {
      const id = String(doc._id);

      return this.blurLocation(
        toPost(doc as never, votos.get(id), comentarios.get(id) ?? 0),
      );
    });
  }

  private async commentCounts(postIds: string[]): Promise<Map<string, number>> {
    const cuentas = new Map<string, number>();

    if (postIds.length === 0) {
      return cuentas;
    }

    const filas = await this.comments.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { postId: { $in: postIds.map((id) => new ObjectId(id)) } } },
      { $group: { _id: '$postId', total: { $sum: 1 } } },
    ]);

    for (const fila of filas) {
      cuentas.set(String(fila._id), fila.total);
    }

    return cuentas;
  }

  private async voteSummaries(
    viewerId: string | null,
    postIds: string[],
  ): Promise<Map<string, PostVotes>> {
    const resumen = new Map<string, PostVotes>();

    if (postIds.length === 0) {
      return resumen;
    }

    for (const id of postIds) {
      resumen.set(id, { likeCount: 0, dislikeCount: 0, myVote: null });
    }

    const objectIds = postIds.map((id) => new ObjectId(id));

    const [cuentas, propios] = await Promise.all([
      this.votes.aggregate<{ _id: { postId: Types.ObjectId; value: VoteValue }; total: number }>([
        { $match: { postId: { $in: objectIds } } },
        { $group: { _id: { postId: '$postId', value: '$value' }, total: { $sum: 1 } } },
      ]),
      viewerId === null
        ? Promise.resolve([])
        : this.votes.find({ userId: viewerId, postId: { $in: objectIds } }).lean(),
    ]);

    for (const fila of cuentas) {
      const actual = resumen.get(String(fila._id.postId));

      if (!actual) {
        continue;
      }

      if (fila._id.value === 'up') {
        actual.likeCount = fila.total;
      } else {
        actual.dislikeCount = fila.total;
      }
    }

    for (const fila of propios) {
      const actual = resumen.get(String(fila.postId));

      if (actual) {
        actual.myVote = fila.value;
      }
    }

    return resumen;
  }

  private async findDocOrFail(id: string): Promise<LeanPost> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Post');
    }

    const doc = await this.posts.findById(id).populate(POPULATE_POST).lean();

    if (!doc) {
      throw AppException.notFound('Post');
    }

    return doc as LeanPost;
  }

  private async assertExists(postId: string): Promise<void> {
    if (!isValidObjectId(postId) || !(await this.posts.exists({ _id: postId }))) {
      throw AppException.notFound('Post');
    }
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
  ): Promise<{ locationId: string | null; description: string; mediaIds: string[] }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Post');
    }

    const post = await this.posts.findById(id).select('userId locationId description').lean();

    if (!post) {
      throw AppException.notFound('Post');
    }

    if (String(post.userId) !== actor.id && actor.role !== 'admin') {
      throw AppException.forbidden('You can only modify your own posts');
    }

    const media = await this.mediaModel
      .find({ postId: id })
      .sort({ position: 1 })
      .select('_id')
      .lean();

    return {
      locationId: post.locationId ? String(post.locationId) : null,
      description: post.description,
      mediaIds: media.map((doc) => String(doc._id)),
    };
  }

  /**
   * Sustituye la ubicación exacta por un punto aproximado cuando el autor lo
   * pidió, de modo que la coordenada real no sale nunca del servidor.
   */
  private blurLocation(post: PostDto): PostDto {
    if (post.locationAccuracy <= 0 || post.location?.lat == null || post.location.lng == null) {
      return post;
    }

    const blurred = fuzzyPoint(
      { lat: post.location.lat, lng: post.location.lng },
      post.locationAccuracy,
      post.id,
    );

    return { ...post, location: { ...post.location, lat: blurred.lat, lng: blurred.lng } };
  }

  private geoFilterOf(
    query: PostListQueryDto,
  ): { lat: number; lng: number; radiusKm: number } | null {
    if (query.lat === undefined || query.lng === undefined) {
      return null;
    }

    return { lat: query.lat, lng: query.lng, radiusKm: query.radiusKm ?? 50 };
  }

  private async buildFilter(
    query: PostListQueryDto,
    geo: { lat: number; lng: number; radiusKm: number } | null,
    viewerId: string | null = null,
  ): Promise<PostFilter> {
    const filtros: PostFilter[] = [];

    if (query.kind) {
      filtros.push({ kind: query.kind });
    }

    if (query.userId) {
      filtros.push({ userId: query.userId });
    }

    if (query.search?.trim()) {
      // Sin índice de texto: se busca por expresión regular escapada, que para
      // este volumen basta y no obliga a mantener un índice aparte.
      filtros.push({ description: { $regex: escapeRegex(query.search.trim()), $options: 'i' } });
    }

    // El muro de seguidos incluye lo propio: un muro donde no aparece lo que
    // uno acaba de publicar se lee como si no se hubiera publicado.
    if (query.feed === 'following' && viewerId !== null) {
      const seguidos = await this.followingIds(viewerId);

      filtros.push({ userId: { $in: [...seguidos, new ObjectId(viewerId)] } });
    }

    if (geo) {
      // El difuminado desplaza el punto como mucho `locationAccuracy` km, así
      // que la caja se amplía para no perder publicaciones por el camino.
      const box = boundingBox(geo, geo.radiusKm + 25);
      const cercanas = await this.locations
        .find({
          lat: { $gte: box.minLat, $lte: box.maxLat },
          lng: { $gte: box.minLng, $lte: box.maxLng },
        })
        .select('_id')
        .lean();

      filtros.push({ locationId: { $in: cercanas.map((doc) => doc._id) } });
    }

    return filtros.length > 0 ? { $and: filtros } : {};
  }

  /** A quiénes sigue esta persona, como identificadores sueltos. */
  private async followingIds(viewerId: string): Promise<Types.ObjectId[]> {
    const follows = await this.follows.find({ followerId: viewerId }).select('followeeId').lean();

    return follows.map((doc) => doc.followeeId);
  }
}

