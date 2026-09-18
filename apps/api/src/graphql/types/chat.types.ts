import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  ChatEvent,
  Conversation,
  ConversationMember,
  Message,
  MessagePage,
  MessageReactionGroup,
  MessageReference,
  StoryReference,
  SystemEventInfo,
} from '@social-network/shared';

import {
  ChatEventType,
  ConversationRole,
  ConversationType as ConversationKind,
  MessageKind,
  MessageStatus,
  SystemMessageAction,
} from '../enums.js';
import { MediaType } from './common.types.js';
import { PostType } from './social.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('MessageReactionGroup', { description: 'Las reacciones de un mensaje con el mismo emoji.' })
export class MessageReactionGroupType implements MessageReactionGroup {
  @Field()
  emoji!: string;

  @Field(() => Int)
  count!: number;

  @Field(() => [ID])
  userIds!: string[];

  @Field()
  reactedByMe!: boolean;
}

@ObjectType('MessageReference', { description: 'Un mensaje citado encima de su respuesta.' })
export class MessageReferenceType implements MessageReference {
  @Field(() => ID)
  id!: string;

  @Field(() => MessageKind)
  kind!: MessageKind;

  @Field(() => String, { nullable: true })
  body!: string | null;

  @Field(() => UserSummaryType)
  sender!: UserSummaryType;

  @Field(() => MediaType, { nullable: true })
  thumbnail!: MediaType | null;

  @Field()
  deleted!: boolean;
}

@ObjectType('StoryReference', { description: 'La historia a la que contesta un mensaje.' })
export class StoryReferenceType implements StoryReference {
  @Field(() => ID)
  id!: string;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field(() => String, { nullable: true })
  text!: string | null;

  @Field()
  expired!: boolean;
}

@ObjectType('SystemEventInfo', { description: 'Lo que cuenta un mensaje de sistema.' })
export class SystemEventInfoType implements SystemEventInfo {
  @Field(() => SystemMessageAction)
  action!: SystemMessageAction;

  @Field(() => [UserSummaryType])
  targets!: UserSummaryType[];

  @Field(() => String, { nullable: true })
  value!: string | null;
}

@ObjectType('Message')
export class MessageType implements Message {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => String, { nullable: true })
  clientId!: string | null;

  @Field(() => MessageKind)
  kind!: MessageKind;

  @Field(() => String, { nullable: true, description: 'Nulo en los mensajes sólo con adjuntos y en los retirados.' })
  body!: string | null;

  @Field(() => [MediaType])
  attachments!: MediaType[];

  @Field(() => MessageReferenceType, { nullable: true })
  replyTo!: MessageReferenceType | null;

  @Field(() => PostType, { nullable: true })
  sharedPost!: PostType | null;

  @Field(() => StoryReferenceType, { nullable: true })
  story!: StoryReferenceType | null;

  @Field(() => SystemEventInfoType, { nullable: true })
  system!: SystemEventInfoType | null;

  @Field(() => UserSummaryType)
  sender!: UserSummaryType;

  @Field(() => [MessageReactionGroupType])
  reactions!: MessageReactionGroupType[];

  @Field(() => MessageStatus, { nullable: true, description: 'Sólo en los propios: enviado, entregado o leído.' })
  status!: MessageStatus | null;

  @Field(() => Int, { description: 'En los grupos, cuántos lo han leído.' })
  readCount!: number;

  @Field(() => String, { nullable: true })
  editedAt!: string | null;

  @Field({ description: 'Cierto si su autor lo retiró; el hilo lo enseña como eliminado.' })
  deleted!: boolean;

  @Field()
  createdAt!: string;
}

@ObjectType('ConversationMember')
export class ConversationMemberType implements ConversationMember {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field(() => ConversationRole)
  role!: ConversationRole;

  @Field(() => ID, { nullable: true })
  lastReadMessageId!: string | null;

  @Field(() => String, { nullable: true })
  lastReadAt!: string | null;

  @Field()
  joinedAt!: string;
}

@ObjectType('Conversation')
export class ConversationObject implements Conversation {
  @Field(() => ID)
  id!: string;

  @Field(() => ConversationKind)
  type!: ConversationKind;

  @Field(() => String, { nullable: true, description: 'Nombre del grupo.' })
  title!: string | null;

  @Field(() => MediaType, { nullable: true })
  photo!: MediaType | null;

  @Field(() => UserSummaryType, { nullable: true, description: 'La otra persona, en las de dos.' })
  peer!: UserSummaryType | null;

  @Field(() => [ConversationMemberType])
  members!: ConversationMemberType[];

  @Field(() => ConversationRole)
  myRole!: ConversationRole;

  @Field(() => String, { nullable: true })
  lastMessageAt!: string | null;

  @Field(() => String, { nullable: true, description: 'Resumen del último mensaje, para la lista.' })
  lastPreview!: string | null;

  @Field(() => ID, { nullable: true })
  lastSenderId!: string | null;

  @Field(() => Int)
  unreadCount!: number;

  @Field()
  muted!: boolean;

  @Field()
  archived!: boolean;

  @Field()
  pinned!: boolean;

  @Field({ description: 'Cierto si ya no se puede escribir: se salió del grupo o hay un bloqueo.' })
  readOnly!: boolean;

  @Field()
  createdAt!: string;
}

/**
 * Tramo de un hilo.
 *
 * No usa la paginación por número de página del resto de la API: un hilo
 * crece por arriba mientras se lee, y numerar páginas haría que los mensajes
 * se repitieran o se saltaran al llegar uno nuevo. Se pagina por cursor.
 */
@ObjectType('MessagePage')
export class MessagePageType implements MessagePage {
  @Field(() => [MessageType])
  data!: MessageType[];

  @Field(() => ID, { nullable: true, description: 'Id desde el que pedir el siguiente tramo.' })
  nextCursor!: string | null;
}

@ObjectType('ChatEvent', { description: 'Un aviso del chat. `type` dice qué campos vienen rellenos.' })
export class ChatEventObject implements ChatEvent {
  @Field(() => ChatEventType)
  type!: ChatEventType;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => MessageType, { nullable: true })
  message!: MessageType | null;

  @Field(() => ConversationObject, { nullable: true })
  conversation!: ConversationObject | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;

  @Field(() => Boolean, { nullable: true })
  typing!: boolean | null;

  @Field(() => String, { nullable: true })
  at!: string | null;

  @Field(() => ID, { nullable: true })
  lastReadMessageId!: string | null;
}
