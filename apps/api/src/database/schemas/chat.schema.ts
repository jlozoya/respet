import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { MessageKind } from './enums.js';

@Schema({ collection: 'conversations', timestamps: true })
export class Conversation {
  /**
   * Copia del último mensaje, para pintar la lista de conversaciones sin
   * consultar la colección de mensajes una vez por cada una.
   */
  @Prop({ type: Date, default: null, index: true })
  lastMessageAt!: Date | null;

  @Prop({ type: String, default: null })
  lastPreview!: string | null;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.virtual('members', {
  ref: 'ConversationMember',
  localField: '_id',
  foreignField: 'conversationId',
});

ConversationSchema.set('toObject', { virtuals: true });
ConversationSchema.set('toJSON', { virtuals: true });

/** Participación de una persona en una conversación. */
@Schema({ collection: 'conversation_members', timestamps: { createdAt: true, updatedAt: false } })
export class ConversationMember {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /**
   * Hasta dónde ha leído. Permite contar lo no leído sin guardar una fila por
   * mensaje y participante.
   */
  @Prop({ type: Date, default: null })
  lastReadAt!: Date | null;

  @Prop({ default: false })
  muted!: boolean;
}

export type ConversationMemberDocument = HydratedDocument<ConversationMember>;
export const ConversationMemberSchema = SchemaFactory.createForClass(ConversationMember);

ConversationMemberSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

ConversationMemberSchema.set('toObject', { virtuals: true });
ConversationMemberSchema.set('toJSON', { virtuals: true });

/** Nadie participa dos veces en la misma conversación. */
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

@Schema({ collection: 'messages', timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(MessageKind), default: MessageKind.Text })
  kind!: MessageKind;

  @Prop({ type: String, default: null })
  body!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  mediaId!: Types.ObjectId | null;

  /**
   * Marca de borrado: los mensajes no se eliminan para no dejar huecos en el
   * hilo de la otra persona; se muestran como «mensaje eliminado».
   */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.virtual('media', {
  ref: 'Media',
  localField: 'mediaId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.set('toObject', { virtuals: true });
MessageSchema.set('toJSON', { virtuals: true });

MessageSchema.index({ conversationId: 1, createdAt: 1 });
