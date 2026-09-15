import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ChatClientEvent,
  ChatServerEvent,
  type Conversation,
  type Message,
  type MessagePage,
  type PresencePayload,
  type ReadPayload,
  type TypingPayload,
} from '@respet/shared';

import { AuthService } from '../auth/auth.service';
import { SocketService } from '../realtime/socket.service';
import { ApiClientService } from './api-client.service';
import { CONVERSATION_FRAGMENTS, MESSAGE_FRAGMENTS, gql } from './fragments';
import { GraphqlClientService } from './graphql-client.service';

/** Cuánto se mantiene visible «escribiendo…» sin recibir señal nueva. */
const TYPING_TIMEOUT_MS = 4000;

const CONVERSATIONS = gql(
  `query Conversations { conversations { ...ConversationFields } }`,
  ...CONVERSATION_FRAGMENTS,
);

const CONVERSATION = gql(
  `query ConversationById($id: ID!) {
    conversation(id: $id) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const START_CONVERSATION = gql(
  `mutation StartConversation($userId: ID!) {
    startConversation(userId: $userId) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const MESSAGES = gql(
  `query Messages($conversationId: ID!, $query: MessageListQueryInput) {
    messages(conversationId: $conversationId, query: $query) {
      data { ...MessageFields }
      nextCursor
    }
  }`,
  ...MESSAGE_FRAGMENTS,
);

const SEND_MESSAGE = gql(
  `mutation SendMessage($conversationId: ID!, $input: SendMessageInput!) {
    sendMessage(conversationId: $conversationId, input: $input) { ...MessageFields }
  }`,
  ...MESSAGE_FRAGMENTS,
);

const DELETE_MESSAGE = gql(
  `mutation DeleteMessage($id: ID!) {
    deleteMessage(id: $id) { ...MessageFields }
  }`,
  ...MESSAGE_FRAGMENTS,
);

const MARK_READ = `
mutation MarkConversationRead($id: ID!) {
  markConversationRead(id: $id)
}`;

const MUTE_CONVERSATION = `
mutation MuteConversation($id: ID!, $muted: Boolean!) {
  muteConversation(id: $id, muted: $muted)
}`;

/**
 * Chat: datos y estado en vivo.
 *
 * Las escrituras son operaciones del esquema y el socket sólo trae los avisos,
 * así que un mensaje enviado queda guardado aunque la conexión en tiempo real
 * esté caída. El estado —conversaciones, no leídos, quién escribe, quién está
 * en línea— se expone con señales para que las pantallas se actualicen solas.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly gql = inject(GraphqlClientService);
  private readonly api = inject(ApiClientService);
  private readonly socket = inject(SocketService);
  private readonly auth = inject(AuthService);

  private readonly conversationsSignal = signal<readonly Conversation[]>([]);
  private readonly typingSignal = signal<ReadonlyMap<string, Set<string>>>(new Map());
  private readonly onlineSignal = signal<ReadonlySet<string>>(new Set());

  readonly conversations = this.conversationsSignal.asReadonly();
  readonly online = this.onlineSignal.asReadonly();

  /** Total de mensajes sin leer, para el distintivo del menú. */
  readonly unreadCount = computed(() =>
    this.conversationsSignal().reduce((sum, item) => sum + item.unreadCount, 0),
  );

  /** Mensajes que llegan por el socket, para que el hilo abierto los añada. */
  readonly incoming = this.socket.on<Message>(ChatServerEvent.MessageCreated);
  readonly deletions = this.socket.on<Message>(ChatServerEvent.MessageDeleted);
  readonly reads = this.socket.on<ReadPayload>(ChatServerEvent.Read);

  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private started = false;

  /** Abre la conexión y engancha los avisos. Idempotente. */
  async start(): Promise<void> {
    if (this.started || !this.auth.isAuthenticated()) {
      return;
    }

    this.started = true;
    await this.socket.connect();

    this.socket.on<Message>(ChatServerEvent.MessageCreated).subscribe((message) => {
      this.applyIncoming(message);
    });

    this.socket.on<Conversation>(ChatServerEvent.ConversationUpdated).subscribe((conversation) => {
      this.upsertConversation(conversation);
    });

    this.socket.on<TypingPayload>(ChatServerEvent.Typing).subscribe((payload) => {
      this.applyTyping(payload);
    });

    this.socket.on<PresencePayload>(ChatServerEvent.Presence).subscribe((payload) => {
      this.onlineSignal.update((current) => {
        const next = new Set(current);

        if (payload.online) {
          next.add(payload.userId);
        } else {
          next.delete(payload.userId);
        }

        return next;
      });
    });

    await this.loadConversations();
  }

  /** Cierra la conexión y olvida el estado, al cerrar sesión. */
  stop(): void {
    this.socket.disconnect();
    this.conversationsSignal.set([]);
    this.typingSignal.set(new Map());
    this.onlineSignal.set(new Set());
    this.started = false;

    for (const timer of this.typingTimers.values()) {
      clearTimeout(timer);
    }

    this.typingTimers.clear();
  }

  async loadConversations(): Promise<readonly Conversation[]> {
    const { conversations } = await this.gql.request<{ conversations: Conversation[] }>(
      CONVERSATIONS,
    );
    this.conversationsSignal.set(conversations);

    return conversations;
  }

  async findConversation(id: string): Promise<Conversation> {
    const { conversation } = await this.gql.request<{ conversation: Conversation }>(CONVERSATION, {
      id,
    });

    return conversation;
  }

  /** Abre la conversación con alguien; si ya existía, devuelve la misma. */
  async startConversationWith(userId: string): Promise<Conversation> {
    const { startConversation } = await this.gql.request<{ startConversation: Conversation }>(
      START_CONVERSATION,
      { userId },
    );
    this.upsertConversation(startConversation);

    return startConversation;
  }

  async messages(
    conversationId: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<MessagePage> {
    const { messages } = await this.gql.request<{ messages: MessagePage }>(MESSAGES, {
      conversationId,
      query: options,
    });

    return messages;
  }

  async send(conversationId: string, body: string): Promise<Message> {
    const { sendMessage } = await this.gql.request<{ sendMessage: Message }>(SEND_MESSAGE, {
      conversationId,
      input: { body },
    });

    this.bumpConversation(conversationId, sendMessage);

    return sendMessage;
  }

  async sendImage(conversationId: string, file: Blob): Promise<Message> {
    const message = await this.api.upload<Message>(
      `/chat/conversations/${conversationId}/images`,
      file,
      'chat.webp',
    );

    this.bumpConversation(conversationId, message);

    return message;
  }

  async deleteMessage(messageId: string): Promise<Message> {
    const { deleteMessage } = await this.gql.request<{ deleteMessage: Message }>(DELETE_MESSAGE, {
      id: messageId,
    });

    return deleteMessage;
  }

  /** Marca la conversación como leída y pone su contador a cero. */
  async markRead(conversationId: string): Promise<void> {
    await this.gql.request(MARK_READ, { id: conversationId });

    this.conversationsSignal.update((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item)),
    );
  }

  async setMuted(conversationId: string, muted: boolean): Promise<void> {
    await this.gql.request(MUTE_CONVERSATION, { id: conversationId, muted });

    this.conversationsSignal.update((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, muted } : item)),
    );
  }

  // --- Estado en vivo -------------------------------------------------------

  /** Entra en la sala de la conversación para recibir sus eventos efímeros. */
  joinConversation(conversationId: string): void {
    this.socket.emit(ChatClientEvent.Join, { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.socket.emit(ChatClientEvent.Leave, { conversationId });
  }

  notifyTyping(conversationId: string, typing: boolean): void {
    this.socket.emit(ChatClientEvent.Typing, { conversationId, typing });
  }

  /** Cierto si alguien está escribiendo en esa conversación. */
  isTyping(conversationId: string): boolean {
    return (this.typingSignal().get(conversationId)?.size ?? 0) > 0;
  }

  isOnline(userId: string): boolean {
    return this.onlineSignal().has(userId);
  }

  // --- Interno --------------------------------------------------------------

  private applyIncoming(message: Message): void {
    const own = message.sender.id === this.auth.user()?.id;

    this.conversationsSignal.update((current) => {
      const index = current.findIndex((item) => item.id === message.conversationId);

      if (index === -1) {
        // Conversación que aún no está en la lista: se recarga entera, que es
        // más simple que reconstruirla a partir de un mensaje suelto.
        void this.loadConversations();

        return current;
      }

      const existing = current[index];

      if (!existing) {
        return current;
      }

      const updated: Conversation = {
        ...existing,
        lastMessageAt: message.createdAt,
        lastPreview: previewOf(message),
        unreadCount: own ? existing.unreadCount : existing.unreadCount + 1,
      };

      // La conversación con actividad sube al principio, como en cualquier
      // aplicación de mensajería.
      return [updated, ...current.filter((_, i) => i !== index)];
    });

    // Un mensaje nuevo implica que su autor dejó de escribir.
    this.clearTyping(message.conversationId, message.sender.id);
  }

  private bumpConversation(conversationId: string, message: Message): void {
    this.conversationsSignal.update((current) => {
      const index = current.findIndex((item) => item.id === conversationId);

      if (index === -1) {
        return current;
      }

      const existing = current[index];

      if (!existing) {
        return current;
      }

      const updated: Conversation = {
        ...existing,
        lastMessageAt: message.createdAt,
        lastPreview: previewOf(message),
      };

      return [updated, ...current.filter((_, i) => i !== index)];
    });
  }

  private upsertConversation(conversation: Conversation): void {
    this.conversationsSignal.update((current) => {
      const rest = current.filter((item) => item.id !== conversation.id);

      return [conversation, ...rest];
    });
  }

  /**
   * Registra que alguien escribe y programa su caducidad.
   *
   * Sin el temporizador, cerrar la aplicación a media frase dejaría el aviso
   * colgado para siempre en la pantalla de la otra persona.
   */
  private applyTyping(payload: TypingPayload): void {
    const key = `${payload.conversationId}:${payload.userId}`;
    const timer = this.typingTimers.get(key);

    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(key);
    }

    if (!payload.typing) {
      this.clearTyping(payload.conversationId, payload.userId);

      return;
    }

    this.typingSignal.update((current) => {
      const next = new Map(current);
      const set = new Set(next.get(payload.conversationId) ?? []);
      set.add(payload.userId);
      next.set(payload.conversationId, set);

      return next;
    });

    this.typingTimers.set(
      key,
      setTimeout(() => {
        this.clearTyping(payload.conversationId, payload.userId);
      }, TYPING_TIMEOUT_MS),
    );
  }

  private clearTyping(conversationId: string, userId: string): void {
    this.typingSignal.update((current) => {
      const set = current.get(conversationId);

      if (!set?.has(userId)) {
        return current;
      }

      const next = new Map(current);
      const updated = new Set(set);
      updated.delete(userId);

      if (updated.size > 0) {
        next.set(conversationId, updated);
      } else {
        next.delete(conversationId);
      }

      return next;
    });
  }
}

function previewOf(message: Message): string {
  if (message.deleted) {
    return '';
  }

  return message.kind === 'image' ? '📷' : (message.body ?? '');
}
