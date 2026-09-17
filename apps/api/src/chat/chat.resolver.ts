import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { ChatEvent, Conversation, Message, MessagePage } from '@respet/shared';

import { CurrentUser, RateLimit, Scopes } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import type { GraphqlContext } from '../common/execution-context.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import {
  ChatEventObject,
  ConversationObject,
  MessagePageType,
  MessageType,
} from '../graphql/types/chat.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import type { UserChannelMessage } from '../realtime/user-channel.js';
import { personalizeChatEvent } from './chat-presenter.service.js';
import { ChatService } from './chat.service.js';
import {
  ConversationListQueryDto,
  CreateGroupDto,
  MessageListQueryDto,
  SendMessageDto,
} from './dto/chat.dto.js';

/** Un emoji: uno o pocos caracteres gráficos, sin texto. */
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,16}$/u;

/**
 * Chat entre usuarios.
 *
 * Todo pasa por el esquema: las escrituras son mutaciones —los archivos
 * viajan dentro de ellas— y los avisos en vivo llegan por la suscripción
 * `chatEvents`, sobre el mismo WebSocket que el resto del tiempo real.
 */
@Resolver(() => ConversationObject)
export class ChatResolver {
  constructor(
    private readonly chat: ChatService,
    private readonly bus: EventBusService,
  ) {}

  @Scopes('read_messages')
  @Query(() => [ConversationObject], {
    name: 'conversations',
    description: 'La bandeja: fijadas primero y luego de la más reciente a la más antigua.',
  })
  async conversations(
    @CurrentUser('id') userId: string,
    @Args('query', { type: () => ConversationListQueryDto, nullable: true }) query: ConversationListQueryDto = {},
  ): Promise<Conversation[]> {
    return this.chat.listConversations(userId, query);
  }

  @Scopes('read_messages')
  @Query(() => ConversationObject, { name: 'conversation' })
  async conversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Conversation> {
    return this.chat.findConversation(id, userId);
  }

  @Scopes('read_messages')
  @Query(() => Int, { name: 'unreadMessageCount', description: 'Mensajes sin leer, para el distintivo del menú.' })
  async unread(@CurrentUser('id') userId: string): Promise<number> {
    return this.chat.countUnread(userId);
  }

  @Scopes('read_messages')
  @Query(() => MessagePageType, {
    name: 'messages',
    description: 'Un tramo del hilo: con `before` hacia atrás, con `after` lo posterior.',
  })
  async messages(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Args('query', { type: () => MessageListQueryDto, nullable: true }) query: MessageListQueryDto = {},
  ): Promise<MessagePage> {
    return this.chat.listMessages(conversationId, userId, query);
  }

  @Scopes('read_messages')
  @Query(() => [MessageType], { name: 'searchMessages' })
  async searchMessages(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @Args('term') term: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message[]> {
    return this.chat.searchMessages(conversationId, userId, term.slice(0, 100));
  }

  @Scopes('send_messages')
  @Mutation(() => ConversationObject, {
    description: 'Abre una conversación con alguien; si ya existía, devuelve la misma.',
  })
  async startConversation(
    @CurrentUser('id') userId: string,
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) peerId: string,
  ): Promise<Conversation> {
    return this.chat.startDirect(userId, peerId);
  }

  @RateLimit({ limit: 20, windowSeconds: 3600 })
  @Mutation(() => ConversationObject, { description: 'Crea un grupo.' })
  async createGroup(@CurrentUser('id') userId: string, @Args('input') input: CreateGroupDto): Promise<Conversation> {
    return this.chat.createGroup(userId, input.title, input.memberIds);
  }

  @Mutation(() => ConversationObject)
  async addGroupMembers(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('userIds', { type: () => [ID] }) userIds: string[],
    @CurrentUser('id') actorId: string,
  ): Promise<Conversation> {
    return this.chat.addMembers(id, actorId, userIds.slice(0, 250));
  }

  @Mutation(() => ConversationObject)
  async removeGroupMember(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) userId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<Conversation> {
    return this.chat.removeMember(id, actorId, userId);
  }

  @Mutation(() => ConversationObject)
  async setGroupAdmin(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) userId: string,
    @Args('admin') admin: boolean,
    @CurrentUser('id') actorId: string,
  ): Promise<Conversation> {
    return this.chat.setAdmin(id, actorId, userId, admin);
  }

  @Mutation(() => ConversationObject)
  async renameGroup(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('title', { type: () => String }) title: string,
    @CurrentUser('id') actorId: string,
  ): Promise<Conversation> {
    const clean = title.trim();

    return this.chat.renameGroup(id, actorId, clean.slice(0, 80) || 'Grupo');
  }

  @Mutation(() => ConversationObject)
  async setGroupPhoto(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
    @CurrentUser('id') actorId: string,
  ): Promise<Conversation> {
    return this.chat.setGroupPhoto(id, actorId, file);
  }

  @Mutation(() => Boolean, { description: 'Sale de un grupo.' })
  async leaveGroup(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.leave(id, userId);

    return true;
  }

  /**
   * Envía un mensaje, con adjuntos opcionales en la misma operación.
   *
   * Con `clientId`, reintentar no duplica: si el mensaje ya se guardó se
   * devuelve el mismo.
   */
  @Scopes('send_messages')
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Mutation(() => MessageType)
  async sendMessage(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @Args('input') input: SendMessageDto,
    @CurrentUser('id') userId: string,
    @Args({ name: 'files', type: () => [GraphQLUpload], nullable: true }) files?: PendingUpload[],
  ): Promise<Message> {
    return this.chat.send(conversationId, userId, input, files ?? []);
  }

  @Scopes('send_messages')
  @Mutation(() => MessageType, { description: 'Edita un mensaje propio durante los 15 minutos siguientes a enviarlo.' })
  async editMessage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('body') body: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    return this.chat.edit(id, userId, body.slice(0, 4000));
  }

  @Scopes('send_messages')
  @Mutation(() => MessageType, { description: 'Retira un mensaje propio para todos.' })
  async deleteMessage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    return this.chat.deleteForEveryone(id, userId);
  }

  @Mutation(() => Boolean, { description: 'Quita un mensaje sólo de tu vista.' })
  async hideMessage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.deleteForMe(id, userId);

    return true;
  }

  @RateLimit({ limit: 300, windowSeconds: 60 })
  @Mutation(() => MessageType, { description: 'Reacciona con un emoji. Repetir el mismo lo quita.' })
  async reactToMessage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    const clean = emoji.trim();

    if (!EMOJI.test(clean)) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'emoji must be a single emoji');
    }

    return this.chat.react(id, userId, clean);
  }

  @Scopes('read_messages')
  @Mutation(() => String, { description: 'Marca la conversación como leída y devuelve el momento.' })
  async markConversationRead(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<string> {
    return this.chat.markRead(id, userId);
  }

  @Mutation(() => Boolean, { description: 'Confirma que los mensajes llegaron a este dispositivo.' })
  async markConversationDelivered(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.markDelivered(id, userId);

    return true;
  }

  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Mutation(() => Boolean, { description: 'Anuncia «escribiendo…» a los demás participantes.' })
  async setTyping(
    @Args('conversationId', { type: () => ID }, ParseObjectIdPipe) conversationId: string,
    @Args('typing') typing: boolean,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.setTyping(conversationId, userId, typing);

    return true;
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

  @Mutation(() => Boolean)
  async archiveConversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('archived') archived: boolean,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.setArchived(id, userId, archived);

    return true;
  }

  @Mutation(() => Boolean)
  async pinConversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('pinned') pinned: boolean,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.setPinned(id, userId, pinned);

    return true;
  }

  @Mutation(() => Boolean, { description: 'Vacía el hilo sólo para ti.' })
  async clearConversation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.chat.clearHistory(id, userId);

    return true;
  }

  /**
   * Todo lo que pasa en las conversaciones de quien escucha: mensajes,
   * reacciones, lecturas, «escribiendo…» y cambios en los grupos.
   */
  @Scopes('read_messages')
  @Subscription(() => ChatEventObject, {
    name: 'chatEvents',
    resolve: (message: UserChannelMessage, _args: unknown, context: GraphqlContext): ChatEvent | null => {
      if (message.channel !== 'chat') {
        return null;
      }

      const viewerId = context.req.user?.id;

      return viewerId ? personalizeChatEvent(message.event, viewerId) : message.event;
    },
  })
  chatEvents(@CurrentUser('id') userId: string): AsyncIterableIterator<UserChannelMessage> {
    return this.bus.subscribe<UserChannelMessage>(Topic.user(userId), (message) => message.channel === 'chat');
  }
}
