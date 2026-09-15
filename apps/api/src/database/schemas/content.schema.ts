import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { MediaType, PostKind, ReportStatus, VoteValue } from './enums.js';

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

/** Archivo subido. Apunta directamente a su dueño: publicación o producto. */
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

@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: String, enum: Object.values(PostKind), default: PostKind.General })
  kind!: PostKind;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  locationId!: Types.ObjectId | null;

  /** 0 = ubicación exacta. Valores mayores difuminan el punto en el mapa. */
  @Prop({ default: 0 })
  locationAccuracy!: number;
}

export type PostDocument = HydratedDocument<Post>;
export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ kind: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });

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

PostSchema.set('toObject', { virtuals: true });
PostSchema.set('toJSON', { virtuals: true });

/**
 * Voto de una persona sobre una publicación.
 *
 * El índice único sobre el par es lo que impide votar dos veces; cambiar de
 * opinión actualiza el sentido en lugar de añadir otra fila.
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
PostVoteSchema.index({ postId: 1, value: 1 });
PostVoteSchema.index({ userId: 1, createdAt: -1 });

@Schema({ collection: 'comments', timestamps: true })
export class Comment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', required: true })
  postId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  body!: string;

  /** Los comentarios retirados no se borran: dejarían un hueco en el hilo. */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type CommentDocument = HydratedDocument<Comment>;
export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ postId: 1, createdAt: 1 });

CommentSchema.virtual('author', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

CommentSchema.set('toObject', { virtuals: true });
CommentSchema.set('toJSON', { virtuals: true });

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

/** Una denuncia por persona y publicación: repetirla no la hace más grave. */
PostReportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });
PostReportSchema.index({ status: 1, createdAt: -1 });

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
