import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import {
  Audience,
  MediaType,
  PostKind,
  ReactionType,
  ReportStatus,
  ReportTarget,
  VoteValue,
} from './enums.js';

@Schema({ collection: 'locations', timestamps: true })
export class Location {
  @Prop({ type: String, default: null })
  country!: string | null;

  @Prop({ type: String, default: null })
  state!: string | null;

  @Prop({ type: String, default: null })
  city!: string | null;

  @Prop({ type: String, default: null })
  route!: string | null;

  @Prop({ type: String, default: null })
  streetNumber!: string | null;

  @Prop({ type: String, default: null })
  postalCode!: string | null;

  @Prop({ type: Number, default: null })
  lat!: number | null;

  @Prop({ type: Number, default: null })
  lng!: number | null;
}

export type LocationDocument = HydratedDocument<Location>;
export const LocationSchema = SchemaFactory.createForClass(Location);

LocationSchema.index({ lat: 1, lng: 1 });

/**
 * Archivo subido: imagen, vídeo o audio.
 *
 * Las galerías —publicación o producto— se apuntan desde aquí con su clave
 * foránea; los dueños únicos —un avatar, una historia, un adjunto del chat—
 * apuntan ellos al archivo.
 */
@Schema({ collection: 'media', timestamps: true })
export class Media {
  @Prop({ type: String, enum: Object.values(MediaType), default: MediaType.Image })
  type!: MediaType;

  @Prop({ required: true })
  url!: string;

  @Prop({ default: 'media' })
  alt!: string;

  @Prop({ type: Number, default: null })
  width!: number | null;

  @Prop({ type: Number, default: null })
  height!: number | null;

  @Prop({ type: String, default: null })
  storageKey!: string | null;

  /** El tipo real del archivo, averiguado por su contenido y no por lo que dijo el cliente. */
  @Prop({ type: String, default: null })
  mimeType!: string | null;

  @Prop({ type: Number, default: null })
  sizeBytes!: number | null;

  /** Duración de vídeos y audios, en milisegundos. */
  @Prop({ type: Number, default: null })
  durationMs!: number | null;

  /** Fotograma de portada de un vídeo. */
  @Prop({ type: String, default: null })
  posterUrl!: string | null;

  @Prop({ type: String, default: null })
  posterKey!: string | null;

  /** Nombre original, para los documentos adjuntos que se descargan. */
  @Prop({ type: String, default: null })
  fileName!: string | null;

  /** Quién lo subió. Nulo en lo anterior a que se guardara. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  uploaderId!: Types.ObjectId | null;

  @Prop({ default: 0 })
  position!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', default: null })
  postId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', default: null })
  productId!: Types.ObjectId | null;
}

export type MediaDocument = HydratedDocument<Media>;
export const MediaSchema = SchemaFactory.createForClass(Media);

MediaSchema.index({ postId: 1, position: 1 });
MediaSchema.index({ productId: 1, position: 1 });
MediaSchema.index({ uploaderId: 1, createdAt: -1 });

/** Cuántas reacciones de cada tipo lleva algo. */
@Schema({ _id: false })
export class ReactionSummary {
  @Prop({ default: 0 })
  like!: number;

  @Prop({ default: 0 })
  love!: number;

  @Prop({ default: 0 })
  care!: number;

  @Prop({ default: 0 })
  haha!: number;

  @Prop({ default: 0 })
  wow!: number;

  @Prop({ default: 0 })
  sad!: number;

  @Prop({ default: 0 })
  angry!: number;
}

export const ReactionSummarySchema = SchemaFactory.createForClass(ReactionSummary);

@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** Puede ir vacía cuando la publicación sólo lleva fotos o comparte otra. */
  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, enum: Object.values(PostKind), default: PostKind.General })
  kind!: PostKind;

  @Prop({ type: String, enum: Object.values(Audience), default: Audience.Public })
  audience!: Audience;

  /**
   * Copia de si el perfil del autor es privado.
   *
   * Con el perfil privado lo publicado sólo lo ven los seguidores, aunque la
   * publicación diga «público». Tenerlo aquí permite filtrar el muro en la
   * propia consulta en lugar de cruzar con los ajustes de cada autor; se
   * actualiza en bloque cuando alguien cambia su privacidad.
   */
  @Prop({ default: false })
  authorPrivate!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  locationId!: Types.ObjectId | null;

  /** 0 = ubicación exacta. Valores mayores difuminan el punto en el mapa. */
  @Prop({ default: 0 })
  locationAccuracy!: number;

  /** Etiquetas del texto, en minúsculas y sin la almohadilla. */
  @Prop({ type: [String], default: [] })
  hashtags!: string[];

  /** Personas mencionadas con @ que existen de verdad. */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  mentionIds!: Types.ObjectId[];

  /** La publicación que ésta comparte, si la comparte. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', default: null })
  sharedPostId!: Types.ObjectId | null;

  @Prop({ default: false })
  commentsDisabled!: boolean;

  /** Cuándo se editó el texto por última vez; nulo si nunca. */
  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  /**
   * Cifras guardadas junto a la publicación.
   *
   * Contarlas en cada lectura del muro eran tres agregaciones por página. Se
   * mantienen con `$inc` en cada cambio y el script de migración sabe
   * recalcularlas si alguna vez se descuadran.
   */
  @Prop({ type: ReactionSummarySchema, default: () => ({}) })
  reactions!: ReactionSummary;

  @Prop({ default: 0 })
  reactionCount!: number;

  @Prop({ default: 0 })
  commentCount!: number;

  @Prop({ default: 0 })
  shareCount!: number;

  /** Cuántas fotos o vídeos lleva: la cuadrícula del perfil sólo enseña las que tienen. */
  @Prop({ default: 0 })
  mediaCount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ kind: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ audience: 1, reactionCount: -1, createdAt: -1 });
PostSchema.index({ description: 'text' });

/**
 * Autor, ubicación e imágenes de una publicación.
 *
 * Los virtuales no se guardan: describen por dónde buscar. `toJSON` y
 * `toObject` los incluyen para que los mapeadores vean el documento completo.
 */
PostSchema.virtual('author', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

PostSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true,
});

PostSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'postId',
  options: { sort: { position: 1 } },
});

PostSchema.virtual('sharedPost', {
  ref: 'Post',
  localField: 'sharedPostId',
  foreignField: '_id',
  justOne: true,
});

PostSchema.virtual('mentions', {
  ref: 'User',
  localField: 'mentionIds',
  foreignField: '_id',
});

PostSchema.set('toObject', { virtuals: true });
PostSchema.set('toJSON', { virtuals: true });

/** Reacción de una persona a una publicación. Una por persona: cambiarla la sustituye. */
@Schema({ collection: 'post_reactions', timestamps: true })
export class PostReaction {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true })
  postId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ReactionType), required: true })
  type!: ReactionType;

  createdAt!: Date;
}

export type PostReactionDocument = HydratedDocument<PostReaction>;
export const PostReactionSchema = SchemaFactory.createForClass(PostReaction);

PostReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostReactionSchema.index({ postId: 1, type: 1, createdAt: -1 });
PostReactionSchema.index({ userId: 1, createdAt: -1 });

PostReactionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

PostReactionSchema.set('toObject', { virtuals: true });
PostReactionSchema.set('toJSON', { virtuals: true });

/**
 * Voto de una persona sobre una publicación.
 *
 * Es el sistema anterior a las reacciones. No se escribe desde la API; el
 * script de migración convierte los votos a favor en «me gusta».
 */
@Schema({ collection: 'post_votes', timestamps: true })
export class PostVote {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true })
  postId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(VoteValue), default: VoteValue.Up })
  value!: VoteValue;
}

export type PostVoteDocument = HydratedDocument<PostVote>;
export const PostVoteSchema = SchemaFactory.createForClass(PostVote);

PostVoteSchema.index({ postId: 1, userId: 1 }, { unique: true });

@Schema({ collection: 'comments', timestamps: true })
export class Comment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true })
  postId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /**
   * El comentario al que responde.
   *
   * Un solo nivel, como en Instagram: responder a una respuesta cuelga del
   * mismo comentario raíz y menciona a su autor.
   */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comment', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true })
  body!: string;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  mentionIds!: Types.ObjectId[];

  @Prop({ default: 0 })
  likeCount!: number;

  @Prop({ default: 0 })
  replyCount!: number;

  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  /** Los comentarios retirados no se borran: dejarían un hueco en el hilo. */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CommentDocument = HydratedDocument<Comment>;
export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });

CommentSchema.virtual('author', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

CommentSchema.virtual('mentions', {
  ref: 'User',
  localField: 'mentionIds',
  foreignField: '_id',
});

CommentSchema.set('toObject', { virtuals: true });
CommentSchema.set('toJSON', { virtuals: true });

/** «Me gusta» a un comentario: el corazón pequeño de Instagram. */
@Schema({ collection: 'comment_likes', timestamps: { createdAt: true, updatedAt: false } })
export class CommentLike {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comment', required: true })
  commentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;
}

export type CommentLikeDocument = HydratedDocument<CommentLike>;
export const CommentLikeSchema = SchemaFactory.createForClass(CommentLike);

CommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

/** Publicación guardada para verla después. Sólo la ve quien la guardó. */
@Schema({ collection: 'saved_posts', timestamps: { createdAt: true, updatedAt: false } })
export class SavedPost {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true, index: true })
  postId!: Types.ObjectId;

  createdAt!: Date;
}

export type SavedPostDocument = HydratedDocument<SavedPost>;
export const SavedPostSchema = SchemaFactory.createForClass(SavedPost);

SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
SavedPostSchema.index({ userId: 1, createdAt: -1 });

/** Una etiqueta y cuánto se usa, para el buscador y las tendencias. */
@Schema({ collection: 'hashtags', timestamps: true })
export class Hashtag {
  @Prop({ required: true, unique: true })
  tag!: string;

  @Prop({ default: 0 })
  postCount!: number;

  @Prop({ type: Date, default: null, index: true })
  lastUsedAt!: Date | null;
}

export type HashtagDocument = HydratedDocument<Hashtag>;
export const HashtagSchema = SchemaFactory.createForClass(Hashtag);

HashtagSchema.index({ postCount: -1 });

/**
 * Seguimiento dirigido: `follower` sigue a `followee`, sin reciprocidad.
 *
 * Con el perfil privado el mismo documento nace pendiente y espera respuesta,
 * en lugar de guardarse la solicitud en una colección aparte: es el mismo
 * vínculo en un estado anterior, y separarlo obligaría a moverlo de sitio al
 * aceptarlo —y a mirar en dos lados cada vez que hay que saber si se sigue a
 * alguien—.
 */
@Schema({ collection: 'follows', timestamps: { createdAt: true, updatedAt: false } })
export class Follow {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  followerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  followeeId!: Types.ObjectId;

  /** Cierto mientras es una solicitud sin responder. */
  @Prop({ default: false })
  pending!: boolean;

  /* Lo escribe `timestamps`; se declara para poder leerlo con tipos. */
  createdAt!: Date;
}

export type FollowDocument = HydratedDocument<Follow>;
export const FollowSchema = SchemaFactory.createForClass(Follow);

FollowSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
FollowSchema.index({ followeeId: 1, createdAt: -1 });
// Las solicitudes que le quedan a alguien por responder, en una sola pasada.
FollowSchema.index({ followeeId: 1, pending: 1, createdAt: -1 });

/**
 * Denuncias de publicaciones del sistema anterior.
 *
 * Las nuevas van a `reports`, que admite cualquier cosa denunciable; el script
 * de migración vuelca éstas allí.
 */
@Schema({ collection: 'post_reports', timestamps: true })
export class PostReport {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true })
  postId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  reporterId!: Types.ObjectId | null;

  @Prop({ required: true })
  reason!: string;

  @Prop({ type: String, enum: Object.values(ReportStatus), default: ReportStatus.Pending })
  status!: ReportStatus;
}

export type PostReportDocument = HydratedDocument<PostReport>;
export const PostReportSchema = SchemaFactory.createForClass(PostReport);

/** Una denuncia de algo —publicación, comentario, persona, historia…— para moderación. */
@Schema({ collection: 'reports', timestamps: true })
export class Report {
  @Prop({ type: String, enum: Object.values(ReportTarget), required: true })
  targetType!: ReportTarget;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  targetId!: Types.ObjectId;

  /** Dueño de lo denunciado, para ver de un vistazo a quién se denuncia más. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  targetOwnerId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  reporterId!: Types.ObjectId | null;

  @Prop({ required: true })
  reason!: string;

  @Prop({ type: String, enum: Object.values(ReportStatus), default: ReportStatus.Pending })
  status!: ReportStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  reviewedById!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);

/** Una denuncia por persona y cosa denunciada: repetirla no la hace más grave. */
ReportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });
ReportSchema.index({ status: 1, createdAt: -1 });

ReportSchema.virtual('reporter', {
  ref: 'User',
  localField: 'reporterId',
  foreignField: '_id',
  justOne: true,
});

ReportSchema.set('toObject', { virtuals: true });
ReportSchema.set('toJSON', { virtuals: true });

@Schema({ collection: 'bulletins', timestamps: true })
export class Bulletin {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, index: true })
  date!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  mediaId!: Types.ObjectId | null;
}

export type BulletinDocument = HydratedDocument<Bulletin>;
export const BulletinSchema = SchemaFactory.createForClass(Bulletin);

BulletinSchema.virtual('media', {
  ref: 'Media',
  localField: 'mediaId',
  foreignField: '_id',
  justOne: true,
});

BulletinSchema.set('toObject', { virtuals: true });
BulletinSchema.set('toJSON', { virtuals: true });

@Schema({ collection: 'support_tickets', timestamps: true })
export class SupportTicket {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ type: String, default: null })
  phone!: string | null;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: 'es' })
  lang!: string;
}

export type SupportTicketDocument = HydratedDocument<SupportTicket>;
export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ email: 1 });
SupportTicketSchema.index({ createdAt: -1 });
