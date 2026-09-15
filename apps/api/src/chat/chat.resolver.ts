import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Conversation, Message, MessagePage } from '@respet/shared';

import { CurrentUser } from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import {
  ConversationType,
  MessagePageType,
  MessageType,
} from '../graphql/types/chat.types.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { MessageListQueryDto, SendMessageDto } from './dto/chat.dto.js';

/**
 * Chat entre usuarios.
 *
 * Las escrituras pasan por aquí y no por el socket: así el mensaje queda
 * guardado antes de anunciarse, y la aplicación funciona —con retraso, pero
 * funciona— aunque el WebSocket esté bloqueado por la red del usuario. El
 * socket sigue siendo socket: los avisos en vivo no son consultas.
 */
@Resolver(() => ConversationType)
export class ChatResolver {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Query(() => [ConversationType], {
    name: 'conversations',
    description: 'Conversaciones del usuario, de la más reciente a la más antigua.',
  })
  async conversations(@CurrentUser('id') userId: string): Promise<Conversation[]> {
    return this.chat.listConversations(userId);
  }

  @Query(() => ConversationType, { name: 'conversation' })
  async conversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Conversation> {
    return this.chat.findConversation(id, userId);
  }

  @Query(() => Int, {
    name: 'unreadMessageCount',
    description: 'Total de mensajes sin leer, para el distintivo del menú.',
  })
  async unread(@CurrentUser('id') userId: string): Promise<number> {
    return this.chat.countUnread(userId);
  }

  /**
   * El tramo del hilo anterior a `before`.
   *
   * Se pagina por cursor y no por número de página: un hilo crece por arriba
   * mientras se lee, y numerar páginas haría que los mensajes se repitieran o
   * se saltaran al llegar uno nuevo.
   */
  @Query(() => MessagePageType, { name: 'messages' })
  async messages(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Args('query', { type: () => MessageListQueryDto, nullable: true })
    query: MessageListQueryDto = {},
  ): Promise<MessagePage> {
    return this.chat.listMessages(conversationId, userId, query);
  }

  @Mutation(() => ConversationType, {
    description: 'Abre una conversación con alguien; si ya existía, devuelve la misma.',
  })
  async startConversation(
    @CurrentUser('id') userId: string,
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) peerId: string,
  ): Promise<Conversation> {
    const conversation = await this.chat.startConversation(userId, peerId);

    // La otra persona ve aparecer el hilo sin tener que recargar.
    this.gateway.emitConversation(conversation, peerId);

    return conversation;
  }

  @Mutation(() => MessageType)
  async sendMessage(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @Args('input') input: SendMessageDto,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    const message = await this.chat.sendText(conversationId, userId, input.body);
    await this.gateway.emitMessage(message, userId);

    return message;
  }

  @Mutation(() => MessageType, { description: 'Retira un mensaje propio.' })
  async deleteMessage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    const message = await this.chat.deleteMessage(id, userId);
    await this.gateway.emitMessageDeleted(message, userId);

    return message;
  }

  @Mutation(() => String, {
    description: 'Marca la conversación como leída y devuelve el momento en que se hizo.',
  })
  async markConversationRead(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<string> {
    const readAt = await this.chat.markRead(id, userId);
    await this.gateway.emitRead(id, userId, readAt);

    return readAt;
  }

  @Mutation(() => Boolean, { description: 'Silencia o reactiva los avisos de una conversación.' })
  async muteConversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('muted') muted: boolean,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.setMuted(id, userId, muted);

    return true;
  }
}
