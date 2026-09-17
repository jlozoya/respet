import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import {
  ConversationRole,
  ConversationType,
  MessageKind,
  SystemMessageAction,
} from './enums.js';

/**
 * Una conversación: de dos o de grupo.
 *
 * Guarda una copia del último mensaje para pintar la bandeja sin consultar la
 * colección de mensajes una vez por hilo.
 */
@Schema({ collection: 'conversations', timestamps: true })
export class Conversation {
  @Prop({ type: String, enum: Object.values(ConversationType), default: ConversationType.Direct })
  type!: ConversationType;

  /**
   * Clave de una conversación de dos: los dos ids ordenados y unidos.
   *
   * Con un índice único encima, abrir la conversación con alguien es
   * idempotente incluso si los dos pulsan «Enviar mensaje» a la vez; antes se
   * buscaba cruzando las listas de cada uno, que era lento y admitía carreras.
   * Nula en los grupos.
   */
  @Prop({ type: String, default: null })
  directKey!: string | null;

  /** Nombre del grupo. */
  @Prop({ type: String, default: null })
  title!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  photoId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  createdById!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Message', default: null })
  lastMessageId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null, index: true })
  lastMessageAt!: Date | null;

  @Prop({ type: String, default: null })
  lastPreview!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  lastSenderId!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } },
);

ConversationSchema.virtual('members', {
  ref: 'ConversationMember',
  localField: '_id',
  foreignField: 'conversationId',
});

ConversationSchema.virtual('photo', {
  ref: 'Media',
  localField: 'photoId',
  foreignField: '_id',
  justOne: true,
});

ConversationSchema.set('toObject', { virtuals: true });
ConversationSchema.set('toJSON', { virtuals: true });

/** Participación de una persona en una conversación, con su estado de lectura. */
@Schema({ collection: 'conversation_members', timestamps: true })
export class ConversationMember {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ConversationRole), default: ConversationRole.Member })
  role!: ConversationRole;

  /**
   * Cuándo dejó el grupo. Mientras sea nulo participa.
   *
   * No se borra la fila al salir: sus mensajes siguen en el hilo con su
   * nombre, y volver a añadirla la reactiva en lugar de duplicarla.
   */
  @Prop({ type: Date, default: null })
  leftAt!: Date | null;

  /**
   * Hasta dónde ha leído. Permite marcar «visto» sin guardar una fila por
   * mensaje y participante.
   */
  @Prop({ type: Date, default: null })
  lastReadAt!: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Message', default: null })
  lastReadMessageId!: Types.ObjectId | null;

  /** Hasta dónde le han llegado los mensajes a alguno de sus dispositivos. */
  @Prop({ type: Date, default: null })
  lastDeliveredAt!: Date | null;

  /** Contador de no leídos, que se suma al llegar un mensaje y se pone a cero al leer. */
  @Prop({ default: 0 })
  unreadCount!: number;

  @Prop({ default: false })
  muted!: boolean;

  @Prop({ default: false })
  archived!: boolean;

  @Prop({ type: Date, default: null })
  pinnedAt!: Date | null;

  /**
   * «Eliminar conversación» para uno mismo: lo anterior a esta fecha deja de
   * verse, sin tocar el hilo de los demás.
   */
  @Prop({ type: Date, default: null })
  clearedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
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
ConversationMemberSchema.index({ userId: 1, leftAt: 1, archived: 1 });

/** Reacción con un emoji a un mensaje. */
@Schema({ _id: false })
export class MessageReaction {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  emoji!: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;
}

export const MessageReactionSchema = SchemaFactory.createForClass(MessageReaction);

/** Lo que cuenta un mensaje de sistema. */
@Schema({ _id: false })
export class SystemEvent {
  @Prop({ type: String, enum: Object.values(SystemMessageAction), required: true })
  action!: SystemMessageAction;

  /** A quién afecta: a quién se añadió, a quién se quitó… */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  targetIds!: Types.ObjectId[];

  /** El nombre nuevo, cuando se renombra. */
  @Prop({ type: String, default: null })
  value!: string | null;
}

export const SystemEventSchema = SchemaFactory.createForClass(SystemEvent);

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  /**
   * Identificador que pone el cliente antes de enviar.
   *
   * Si la conexión se corta después de guardar pero antes de recibir la
   * respuesta, el cliente reintenta con el mismo: el índice único hace que el
   * segundo intento devuelva el mensaje ya guardado en lugar de duplicarlo.
   */
  @Prop({ type: String, default: null })
  clientId!: string | null;

  @Prop({ type: String, enum: Object.values(MessageKind), default: MessageKind.Text })
  kind!: MessageKind;

  @Prop({ type: String, default: null })
  body!: string | null;

  /** Fotos, vídeos, audio o documentos adjuntos, en orden. */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Media', default: [] })
  attachmentIds!: Types.ObjectId[];

  /** El mensaje al que contesta, citado encima. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Message', default: null })
  replyToId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Post', default: null })
  sharedPostId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Story', default: null })
  storyId!: Types.ObjectId | null;

  @Prop({ type: SystemEventSchema, default: null })
  system!: SystemEvent | null;

  @Prop({ type: [MessageReactionSchema], default: [] })
  reactions!: MessageReaction[];

  @Prop({ type: Date, default: null })
  editedAt!: Date | null;

  /**
   * Marca de borrado para todos: los mensajes no se eliminan para no dejar
   * huecos en el hilo de los demás; se muestran como «mensaje eliminado».
   */
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  /** Quienes lo han quitado sólo de su vista. */
  @Prop({ type: [SchemaTypes.ObjectId], default: [] })
  hiddenFor!: Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.virtual('attachments', {
  ref: 'Media',
  localField: 'attachmentIds',
  foreignField: '_id',
});

MessageSchema.virtual('replyTo', {
  ref: 'Message',
  localField: 'replyToId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.virtual('sharedPost', {
  ref: 'Post',
  localField: 'sharedPostId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.virtual('story', {
  ref: 'Story',
  localField: 'storyId',
  foreignField: '_id',
  justOne: true,
});

MessageSchema.set('toObject', { virtuals: true });
MessageSchema.set('toJSON', { virtuals: true });

MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index(
  { senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);
MessageSchema.index({ conversationId: 1, body: 'text' });
