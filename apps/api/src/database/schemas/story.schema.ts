import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { Audience, LiveStatus, StoryKind } from './enums.js';

/** Cómo se pinta una historia de texto. */
@Schema({ _id: false })
export class StoryStyle {
  /** Fondo: un color o un degradado CSS, de una lista cerrada que valida la API. */
  @Prop({ default: 'sunset' })
  background!: string;

  @Prop({ default: 'classic' })
  font!: string;
}

export const StoryStyleSchema = SchemaFactory.createForClass(StoryStyle);

/**
 * Una historia: una foto, un vídeo o un texto que se ve durante un día.
 *
 * No se borra al caducar: deja de salir en la barra de historias pero sigue en
 * el archivo de su autor y puede formar parte de una historia destacada.
 */
@Schema({ collection: 'stories', timestamps: true })
export class Story {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(StoryKind), required: true })
  kind!: StoryKind;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  mediaId!: Types.ObjectId | null;

  /** El texto de una historia de texto, o el pie de una foto o vídeo. */
  @Prop({ type: String, default: null })
  text!: string | null;

  @Prop({ type: StoryStyleSchema, default: () => ({}) })
  style!: StoryStyle;

  /** Cuánto se enseña antes de pasar a la siguiente. Los vídeos, lo que duren. */
  @Prop({ default: 5000 })
  durationMs!: number;

  @Prop({ type: String, enum: Object.values(Audience), default: Audience.Followers })
  audience!: Audience;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ default: 0 })
  viewCount!: number;

  @Prop({ default: 0 })
  reactionCount!: number;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type StoryDocument = HydratedDocument<Story>;
export const StorySchema = SchemaFactory.createForClass(Story);

StorySchema.index({ authorId: 1, expiresAt: -1 });
StorySchema.index({ expiresAt: 1, deletedAt: 1 });

StorySchema.virtual('author', {
  ref: 'User',
  localField: 'authorId',
  foreignField: '_id',
  justOne: true,
});

StorySchema.virtual('media', {
  ref: 'Media',
  localField: 'mediaId',
  foreignField: '_id',
  justOne: true,
});

StorySchema.set('toObject', { virtuals: true });
StorySchema.set('toJSON', { virtuals: true });

/** Quién ha visto una historia y, si reaccionó, con qué. */
@Schema({ collection: 'story_views', timestamps: true })
export class StoryView {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Story', required: true })
  storyId!: Types.ObjectId;

  /** Autor de la historia, para saber de un vistazo qué ha visto alguien de cada persona. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  viewerId!: Types.ObjectId;

  @Prop({ type: String, default: null })
  reaction!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type StoryViewDocument = HydratedDocument<StoryView>;
export const StoryViewSchema = SchemaFactory.createForClass(StoryView);

StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
StoryViewSchema.index({ viewerId: 1, authorId: 1 });
StoryViewSchema.index({ storyId: 1, createdAt: -1 });

StoryViewSchema.virtual('viewer', {
  ref: 'User',
  localField: 'viewerId',
  foreignField: '_id',
  justOne: true,
});

StoryViewSchema.set('toObject', { virtuals: true });
StoryViewSchema.set('toJSON', { virtuals: true });

/** Historias destacadas: una colección con nombre que queda fija en el perfil. */
@Schema({ collection: 'story_highlights', timestamps: true })
export class StoryHighlight {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Story', default: [] })
  storyIds!: Types.ObjectId[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Story', default: null })
  coverStoryId!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type StoryHighlightDocument = HydratedDocument<StoryHighlight>;
export const StoryHighlightSchema = SchemaFactory.createForClass(StoryHighlight);

/**
 * Una emisión en directo.
 *
 * El vídeo no pasa por aquí: va de quien emite a quien mira a través de
 * LiveKit. Este documento es lo que la red social sabe de él —quién, cuándo,
 * cuánta gente— y la sala de LiveKit a la que hay que conectarse.
 */
@Schema({ collection: 'live_streams', timestamps: true })
export class LiveStream {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  hostId!: Types.ObjectId;

  @Prop({ default: '' })
  title!: string;

  @Prop({ type: String, enum: Object.values(LiveStatus), default: LiveStatus.Live })
  status!: LiveStatus;

  @Prop({ type: String, enum: Object.values(Audience), default: Audience.Public })
  audience!: Audience;

  @Prop({ required: true, unique: true })
  roomName!: string;

  @Prop({ type: Date, required: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  /**
   * Última señal de vida de quien emite.
   *
   * Si cierra la aplicación de golpe no hay nadie que avise de que el directo
   * terminó; una tarea periódica da por acabados los que llevan un rato sin
   * latido.
   */
  @Prop({ type: Date, required: true })
  lastHeartbeatAt!: Date;

  @Prop({ default: 0 })
  viewerCount!: number;

  @Prop({ default: 0 })
  peakViewerCount!: number;

  @Prop({ default: 0 })
  totalViewers!: number;

  @Prop({ default: 0 })
  reactionCount!: number;

  @Prop({ default: 0 })
  commentCount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type LiveStreamDocument = HydratedDocument<LiveStream>;
export const LiveStreamSchema = SchemaFactory.createForClass(LiveStream);

LiveStreamSchema.index({ status: 1, startedAt: -1 });
LiveStreamSchema.index({ hostId: 1, status: 1 });

LiveStreamSchema.virtual('host', {
  ref: 'User',
  localField: 'hostId',
  foreignField: '_id',
  justOne: true,
});

LiveStreamSchema.set('toObject', { virtuals: true });
LiveStreamSchema.set('toJSON', { virtuals: true });

@Schema({ collection: 'live_comments', timestamps: { createdAt: true, updatedAt: false } })
export class LiveComment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LiveStream', required: true })
  streamId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  body!: string;

  createdAt!: Date;
}

export type LiveCommentDocument = HydratedDocument<LiveComment>;
export const LiveCommentSchema = SchemaFactory.createForClass(LiveComment);

LiveCommentSchema.index({ streamId: 1, _id: -1 });

LiveCommentSchema.virtual('author', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

LiveCommentSchema.set('toObject', { virtuals: true });
LiveCommentSchema.set('toJSON', { virtuals: true });
