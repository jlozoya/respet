import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { NotificationType } from './enums.js';

/**
 * Un aviso para alguien: le han reaccionado, comentado, seguido…
 *
 * Los avisos parecidos se agrupan como en Facebook —«Ana y 3 personas más
 * reaccionaron a tu publicación»—: comparten `groupKey` y, mientras no se
 * hayan leído, el nuevo actor se suma al aviso existente en lugar de crear
 * otro.
 */
@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type!: NotificationType;

  /** Quiénes lo provocaron, del más reciente al más antiguo. Se guardan unos pocos. */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  actorIds!: Types.ObjectId[];

  /** Cuántas personas distintas en total, aunque sólo se guarden las últimas. */
  @Prop({ default: 1 })
  actorCount!: number;

  @Prop({ required: true })
  groupKey!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', default: null })
  postId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comment', default: null })
  commentId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Story', default: null })
  storyId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'LiveStream', default: null })
  liveStreamId!: Types.ObjectId | null;

  /** Un fragmento del comentario o la reacción usada, para leerlo sin abrirlo. */
  @Prop({ type: String, default: null })
  preview!: string | null;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  /** Momento de la última actividad: lo que ordena la lista. */
  @Prop({ type: Date, required: true })
  activityAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, activityAt: -1 });
NotificationSchema.index({ recipientId: 1, readAt: 1 });
NotificationSchema.index({ recipientId: 1, groupKey: 1, readAt: 1 });
// Los avisos se guardan tres meses.
NotificationSchema.index({ activityAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

NotificationSchema.virtual('actors', {
  ref: 'User',
  localField: 'actorIds',
  foreignField: '_id',
});

NotificationSchema.set('toObject', { virtuals: true });
NotificationSchema.set('toJSON', { virtuals: true });

/** Un dispositivo al que mandar notificaciones push. */
@Schema({ collection: 'push_devices', timestamps: true })
export class PushDevice {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token!: string;

  /** `android`, `ios` o `web`. */
  @Prop({ required: true })
  platform!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session', default: null })
  sessionId!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PushDeviceDocument = HydratedDocument<PushDevice>;
export const PushDeviceSchema = SchemaFactory.createForClass(PushDevice);
