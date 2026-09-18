import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import type {
  ChatEvent,
  Conversation,
  ConversationListQuery,
  Media,
  Message,
  MessagePage,
  UserSummary,
} from '@social-network/shared';
import type { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageKey, StorageService } from '../storage/storage.service';
import { CONVERSATION_FRAGMENTS, MESSAGE_FRAGMENTS, gql } from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const CONVERSATIONS = gql(
  `query Conversations($query: ConversationListQueryInput) {
    conversations(query: $query) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const CONVERSATION = gql(
  `query ConversationById($id: ID!) { conversation(id: $id) { ...ConversationFields } }`,
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

const SEARCH_MESSAGES = gql(
  `query SearchMessages($conversationId: ID!, $term: String!) {
    searchMessages(conversationId: $conversationId, term: $term) { ...MessageFields }
  }`,
  ...MESSAGE_FRAGMENTS,
);

const START_CONVERSATION = gql(
  `mutation StartConversation($userId: ID!) { startConversation(userId: $userId) { ...ConversationFields } }`,
  ...CONVERSATION_FRAGMENTS,
);

const CREATE_GROUP = gql(
  `mutation CreateGroup($input: CreateGroupInput!) { createGroup(input: $input) { ...ConversationFields } }`,
  ...CONVERSATION_FRAGMENTS,
);

const ADD_GROUP_MEMBERS = gql(
  `mutation AddGroupMembers($id: ID!, $userIds: [ID!]!) {
    addGroupMembers(id: $id, userIds: $userIds) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const REMOVE_GROUP_MEMBER = gql(
  `mutation RemoveGroupMember($id: ID!, $userId: ID!) {
    removeGroupMember(id: $id, userId: $userId) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const SET_GROUP_ADMIN = gql(
  `mutation SetGroupAdmin($id: ID!, $userId: ID!, $admin: Boolean!) {
    setGroupAdmin(id: $id, userId: $userId, admin: $admin) { ...ConversationFields }
  }`,
  ...CONVERSATION_FRAGMENTS,
);

const RENAME_GROUP = gql(
  `mutation RenameGroup($id: ID!, $title: String!) { renameGroup(id: $id, title: $title) { ...ConversationFields } }`,
  ...CONVERSATION_FRAGMENTS,
);

const SET_GROUP_PHOTO = gql(
  `mutation SetGroupPhoto($id: ID!, $file: Upload!) { setGroupPhoto(id: $id, file: $file) { ...ConversationFields } }`,
  ...CONVERSATION_FRAGMENTS,
);

const LEAVE_GROUP = `mutation LeaveGroup($id: ID!) { leaveGroup(id: $id) }`;

const SEND_MESSAGE = gql(
  `mutation SendMessage($conversationId: ID!, $input: SendMessageInput!, $files: [Upload!]) {
    sendMessage(conversationId: $conversationId, input: $input, files: $files) { ...MessageFields }
  }`,
  ...MESSAGE_FRAGMENTS,
);

const EDIT_MESSAGE = gql(
  `mutation EditMessage($id: ID!, $body: String!) { editMessage(id: $id, body: $body) { ...MessageFields } }`,
  ...MESSAGE_FRAGMENTS,
);

const DELETE_MESSAGE = gql(
  `mutation DeleteMessage($id: ID!) { deleteMessage(id: $id) { ...MessageFields } }`,
  ...MESSAGE_FRAGMENTS,
);

const HIDE_MESSAGE = `mutation HideMessage($id: ID!) { hideMessage(id: $id) }`;

const REACT_TO_MESSAGE = gql(
  `mutation ReactToMessage($id: ID!, $emoji: String!) { reactToMessage(id: $id, emoji: $emoji) { ...MessageFields } }`,
  ...MESSAGE_FRAGMENTS,
);

const MARK_READ = `mutation MarkConversationRead($id: ID!) { markConversationRead(id: $id) }`;
const MARK_DELIVERED = `mutation MarkConversationDelivered($id: ID!) { markConversationDelivered(id: $id) }`;
const SET_TYPING = `mutation SetTyping($conversationId: ID!, $typing: Boolean!) { setTyping(conversationId: $conversationId, typing: $typing) }`;
const MUTE_CONVERSATION = `mutation MuteConversation($id: ID!, $muted: Boolean!) { muteConversation(id: $id, muted: $muted) }`;
const ARCHIVE_CONVERSATION = `mutation ArchiveConversation($id: ID!, $archived: Boolean!) { archiveConversation(id: $id, archived: $archived) }`;
const PIN_CONVERSATION = `mutation PinConversation($id: ID!, $pinned: Boolean!) { pinConversation(id: $id, pinned: $pinned) }`;
const CLEAR_CONVERSATION = `mutation ClearConversation($id: ID!) { clearConversation(id: $id) }`;

const CHAT_EVENTS = gql(
  `subscription ChatEvents {
    chatEvents {
      type
      conversationId
      userId
      typing
      at
      lastReadMessageId
      message { ...MessageFields }
      conversation { ...ConversationFields }
    }
  }`,
  ...MESSAGE_FRAGMENTS,
  ...CONVERSATION_FRAGMENTS,
);

/** Mensajes por tramo del hilo. */
const PAGE_SIZE = 25;
/** Cuánto dura el «escribiendo…» si no llega el aviso de que paró. */
const TYPING_TIMEOUT_MS = 6000;
/** Cada cuánto se repite el aviso de que se sigue escribiendo. */
const TYPING_REPEAT_MS = 3000;
/** Silencio tras el que se avisa de que se dejó de escribir. */
const TYPING_IDLE_MS = 4000;
/** Conversaciones abiertas a la vez en el muelle del escritorio. */
const MAX_DOCK_WINDOWS = 3;

/** Un adjunto que aún no ha subido, con su vista previa local. */
export interface LocalAttachment {
  file: Blob;
  name: string;
  type: Media['type'];
  previewUrl: string | null;
}

/**
 * Un mensaje tal y como lo pinta el hilo.
 *
 * Los que aún no han llegado al servidor llevan `local` con lo necesario para
 * reintentarlos; su `id` es provisional y su estado, `sending` o `failed`.
 */
export type ChatMessage = Message & {
  local?: {
    attachments: LocalAttachment[];
    replyToId: string | null;
    sharedPostId: string | null;
    durationMs: number | null;
  };
};

export interface ThreadState {
  /** Del más antiguo al más reciente. */
  messages: ChatMessage[];
  loaded: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  /** Desde dónde pedir el tramo anterior. */
  cursor: string | null;
}

export interface OutgoingMessage {
  body?: string;
  files?: LocalAttachment[];
  replyTo?: Message | null;
  sharedPostId?: string;
  durationMs?: number;
}

/** Lo que se guarda de un mensaje pendiente para reintentarlo tras cerrar la app. */
interface StoredOutboxEntry {
  conversationId: string;
  clientId: string;
  body: string;
  replyToId: string | null;
  sharedPostId: string | null;
  createdAt: string;
}

const EMPTY_THREAD: ThreadState = {
  messages: [],
  loaded: false,
  loadingOlder: false,
  hasOlder: true,
  cursor: null,
};

/**
 * El chat.
 *
 * Guarda en señales la bandeja, los hilos abiertos y quién escribe, y los
 * mantiene al día con la suscripción `chatEvents`. Lo que aporta sobre una
 * capa de llamadas a secas:
 *
 * - **Envío optimista.** El mensaje aparece en el hilo en el acto, con un
 *   `clientId` propio. Si la red falla se queda marcado para reintentar, y el
 *   reintento usa el mismo `clientId`, así que el servidor no lo duplica
 *   aunque el primer intento sí hubiera llegado. Los de sólo texto sobreviven
 *   a cerrar la aplicación.
 * - **Estados de entrega.** Enviado, entregado y leído, actualizados con los
 *   avisos de la otra parte sin volver a pedir el hilo.
 * - **Reconexión.** Lo que llegó mientras no había conexión se recupera al
 *   volver, pidiendo los mensajes posteriores al último que se tenía.
 * - **Muelle.** En el escritorio las conversaciones se abren en ventanas
 *   sobre la página, como en Facebook; en el móvil, a pantalla completa.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly gql = inject(GraphqlClientService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly conversationsSignal = signal<Conversation[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly typingSignal = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
  private readonly dockSignal = signal<readonly string[]>([]);
  private readonly minimizedSignal = signal<ReadonlySet<string>>(new Set());

  private readonly threads = new Map<string, WritableSignal<ThreadState>>();
  private readonly active = new Map<string, number>();
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly outgoingTyping = new Map<
    string,
    { lastSent: number; idle?: ReturnType<typeof setTimeout> }
  >();
  private readonly pendingRead = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingDelivered = new Map<string, ReturnType<typeof setTimeout>>();
  private subscription: Subscription | null = null;
  private lastEpoch = 0;

  /** La bandeja: fijadas primero y luego por actividad. */
  readonly conversations = computed(() =>
    sortConversations(this.conversationsSignal().filter((item) => !item.archived)),
  );
  readonly archived = computed(() =>
    sortConversations(this.conversationsSignal().filter((item) => item.archived)),
  );
  readonly loaded = this.loadedSignal.asReadonly();

  /** Conversaciones con algo sin leer, para el distintivo del menú. */
  readonly unreadConversations = computed(
    () => this.conversationsSignal().filter((item) => item.unreadCount > 0 && !item.muted).length,
  );

  /** Las ventanas abiertas en el muelle, de izquierda a derecha. */
  readonly dock = this.dockSignal.asReadonly();
  readonly minimized = this.minimizedSignal.asReadonly();

  constructor() {
    // Tras una reconexión se recupera lo que llegó mientras tanto.
    effect(() => {
      const epoch = this.realtime.epoch();

      untracked(() => {
        if (this.subscription && epoch > this.lastEpoch && this.lastEpoch > 0) {
          void this.catchUp();
        }

        this.lastEpoch = epoch;
      });
    });
  }

  /** Empieza a escuchar. La llama el armazón al abrirse la sesión. */
  start(): void {
    if (this.subscription) {
      return;
    }

    this.subscription = this.realtime.subscribe<{ chatEvents: ChatEvent }>(CHAT_EVENTS).subscribe({
      next: ({ chatEvents }) => this.apply(chatEvents),
      error: () => {
        this.subscription = null;
      },
    });

    void this.loadConversations().then(() => this.flushStoredOutbox());
  }

  /** Olvida todo al cerrar la sesión. */
  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.conversationsSignal.set([]);
    this.loadedSignal.set(false);
    this.typingSignal.set(new Map());
    this.dockSignal.set([]);
    this.minimizedSignal.set(new Set());
    this.threads.clear();
    this.active.clear();

    for (const timer of [
      ...this.typingTimers.values(),
      ...this.pendingRead.values(),
      ...this.pendingDelivered.values(),
    ]) {
      clearTimeout(timer);
    }

    this.typingTimers.clear();
    this.pendingRead.clear();
    this.pendingDelivered.clear();
    this.outgoingTyping.clear();
  }

  // --- Bandeja --------------------------------------------------------------

  async loadConversations(query: ConversationListQuery = {}): Promise<Conversation[]> {
    const [inbox, archived] = await Promise.all([
      this.gql.field<Conversation[]>(CONVERSATIONS, { query: { ...query, archived: false } }),
      this.gql.field<Conversation[]>(CONVERSATIONS, { query: { ...query, archived: true } }),
    ]);

    if (!query.search) {
      this.conversationsSignal.set([...inbox, ...archived]);
      this.loadedSignal.set(true);
    }

    return [...inbox, ...archived];
  }

  /** La conversación de la bandeja, o la pide si aún no está. */
  conversation(id: string): Signal<Conversation | null> {
    return computed(() => this.conversationsSignal().find((item) => item.id === id) ?? null);
  }

  async fetchConversation(id: string): Promise<Conversation> {
    const conversation = await this.gql.field<Conversation>(CONVERSATION, { id });
    this.upsert(conversation);

    return conversation;
  }

  async startConversationWith(userId: string): Promise<Conversation> {
    const conversation = await this.gql.field<Conversation>(START_CONVERSATION, { userId });
    this.upsert(conversation);

    return conversation;
  }

  async createGroup(title: string, memberIds: string[]): Promise<Conversation> {
    const conversation = await this.gql.field<Conversation>(CREATE_GROUP, {
      input: { title, memberIds },
    });
    this.upsert(conversation);

    return conversation;
  }

  async addMembers(id: string, userIds: string[]): Promise<void> {
    this.upsert(await this.gql.field<Conversation>(ADD_GROUP_MEMBERS, { id, userIds }));
  }

  async removeMember(id: string, userId: string): Promise<void> {
    this.upsert(await this.gql.field<Conversation>(REMOVE_GROUP_MEMBER, { id, userId }));
  }

  async setAdmin(id: string, userId: string, admin: boolean): Promise<void> {
    this.upsert(await this.gql.field<Conversation>(SET_GROUP_ADMIN, { id, userId, admin }));
  }

  async rename(id: string, title: string): Promise<void> {
    this.upsert(await this.gql.field<Conversation>(RENAME_GROUP, { id, title }));
  }

  async setPhoto(id: string, file: Blob): Promise<void> {
    this.upsert(await this.gql.field<Conversation>(SET_GROUP_PHOTO, { id, file }));
  }

  async leave(id: string): Promise<void> {
    await this.gql.request(LEAVE_GROUP, { id });
    this.forget(id);
  }

  async setMuted(id: string, muted: boolean): Promise<void> {
    this.patch(id, { muted });
    await this.gql.request(MUTE_CONVERSATION, { id, muted });
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    this.patch(id, { archived });
    await this.gql.request(ARCHIVE_CONVERSATION, { id, archived });
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    this.patch(id, { pinned });
    await this.gql.request(PIN_CONVERSATION, { id, pinned });
  }

  /** Vacía el hilo sólo para quien lo pide. */
  async clear(id: string): Promise<void> {
    await this.gql.request(CLEAR_CONVERSATION, { id });
    this.threadSignal(id).set({ ...EMPTY_THREAD, loaded: true, hasOlder: false });
    this.patch(id, { lastPreview: null, unreadCount: 0 });
  }

  // --- Hilos ----------------------------------------------------------------

  /** El estado de un hilo. Lo crea vacío si aún no se había pedido. */
  thread(conversationId: string): Signal<ThreadState> {
    return this.threadSignal(conversationId).asReadonly();
  }

  /** Carga el tramo más reciente, si aún no estaba. */
  async openThread(conversationId: string): Promise<void> {
    const thread = this.threadSignal(conversationId);

    if (thread().loaded) {
      return;
    }

    const page = await this.fetchMessages(conversationId, {});
    thread.update((state) => ({
      ...state,
      loaded: true,
      // Los pendientes que ya hubiera —de la bandeja de salida— se conservan.
      messages: mergeMessages(page.data, state.messages),
      hasOlder: page.nextCursor !== null,
      cursor: page.nextCursor,
    }));
  }

  async loadOlder(conversationId: string): Promise<void> {
    const thread = this.threadSignal(conversationId);
    const state = thread();

    if (state.loadingOlder || !state.hasOlder || !state.cursor) {
      return;
    }

    thread.update((current) => ({ ...current, loadingOlder: true }));

    try {
      const page = await this.fetchMessages(conversationId, { before: state.cursor });
      thread.update((current) => ({
        ...current,
        messages: mergeMessages(page.data, current.messages),
        hasOlder: page.nextCursor !== null,
        cursor: page.nextCursor,
        loadingOlder: false,
      }));
    } catch (error) {
      thread.update((current) => ({ ...current, loadingOlder: false }));
      throw error;
    }
  }

  search(conversationId: string, term: string): Promise<Message[]> {
    return this.gql.field(SEARCH_MESSAGES, { conversationId, term });
  }

  /**
   * Marca un hilo como a la vista.
   *
   * Mientras lo esté, lo que llega se da por leído. Se cuenta cuántas veces se
   * ha abierto porque la misma conversación puede estar a la vez en el muelle
   * y en la pantalla de mensajes.
   */
  focus(conversationId: string): void {
    this.active.set(conversationId, (this.active.get(conversationId) ?? 0) + 1);
    this.scheduleRead(conversationId, 0);
  }

  blur(conversationId: string): void {
    const count = (this.active.get(conversationId) ?? 1) - 1;

    if (count <= 0) {
      this.active.delete(conversationId);
    } else {
      this.active.set(conversationId, count);
    }
  }

  // --- Enviar ---------------------------------------------------------------

  /**
   * Envía un mensaje.
   *
   * No lanza: si falla, el mensaje se queda en el hilo marcado para
   * reintentar, que es lo que espera quien escribe en una red que va y viene.
   */
  async send(conversationId: string, outgoing: OutgoingMessage): Promise<void> {
    const me = this.auth.user();
    const body = outgoing.body?.trim() ?? '';
    const attachments = outgoing.files ?? [];

    if (!me || (!body && attachments.length === 0 && !outgoing.sharedPostId)) {
      return;
    }

    const clientId = newClientId();
    const optimistic: ChatMessage = {
      id: `local:${clientId}`,
      conversationId,
      clientId,
      kind: kindOf(attachments, outgoing.sharedPostId, outgoing.durationMs),
      body: body || null,
      attachments: attachments.map((item, index) => localMedia(item, `${clientId}:${index}`)),
      replyTo: outgoing.replyTo
        ? {
            id: outgoing.replyTo.id,
            kind: outgoing.replyTo.kind,
            body: outgoing.replyTo.body,
            sender: outgoing.replyTo.sender,
            thumbnail: outgoing.replyTo.attachments[0] ?? null,
            deleted: outgoing.replyTo.deleted,
          }
        : null,
      sharedPost: null,
      story: null,
      system: null,
      sender: summaryOf(me),
      reactions: [],
      status: 'sending',
      readCount: 0,
      editedAt: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      local: {
        attachments,
        replyToId: outgoing.replyTo?.id ?? null,
        sharedPostId: outgoing.sharedPostId ?? null,
        durationMs: outgoing.durationMs ?? null,
      },
    };

    this.threadSignal(conversationId).update((state) => ({
      ...state,
      messages: [...state.messages, optimistic],
    }));
    this.stopTyping(conversationId);

    if (attachments.length === 0) {
      await this.storeOutbox(optimistic);
    }

    await this.deliver(optimistic);
  }

  /** Vuelve a intentar un mensaje que falló. */
  async retry(message: ChatMessage): Promise<void> {
    this.replaceInThread(message.conversationId, message.id, { ...message, status: 'sending' });
    await this.deliver({ ...message, status: 'sending' });
  }

  /** Descarta un mensaje que no llegó a salir. */
  async discard(message: ChatMessage): Promise<void> {
    this.threadSignal(message.conversationId).update((state) => ({
      ...state,
      messages: state.messages.filter((item) => item.id !== message.id),
    }));
    await this.removeFromOutbox(message.clientId);
  }

  async edit(message: Message, body: string): Promise<void> {
    const updated = await this.gql.field<Message>(EDIT_MESSAGE, { id: message.id, body });
    this.replaceInThread(message.conversationId, message.id, updated);
  }

  /** Retira un mensaje propio para todos. */
  async deleteForEveryone(message: Message): Promise<void> {
    const updated = await this.gql.field<Message>(DELETE_MESSAGE, { id: message.id });
    this.replaceInThread(message.conversationId, message.id, updated);
  }

  /** Lo quita sólo de la vista propia. */
  async hide(message: Message): Promise<void> {
    await this.gql.request(HIDE_MESSAGE, { id: message.id });
    this.threadSignal(message.conversationId).update((state) => ({
      ...state,
      messages: state.messages.filter((item) => item.id !== message.id),
    }));
  }

  async react(message: Message, emoji: string): Promise<void> {
    const updated = await this.gql.field<Message>(REACT_TO_MESSAGE, { id: message.id, emoji });
    this.replaceInThread(message.conversationId, message.id, updated);
  }

  /**
   * Avisa de que se está escribiendo.
   *
   * Se llama en cada pulsación, pero sólo sale un aviso cada pocos segundos, y
   * otro de «ya no» tras un rato de silencio.
   */
  typing(conversationId: string): void {
    const state = this.outgoingTyping.get(conversationId) ?? { lastSent: 0 };
    const now = Date.now();

    if (now - state.lastSent > TYPING_REPEAT_MS) {
      state.lastSent = now;
      void this.gql.request(SET_TYPING, { conversationId, typing: true }).catch(() => undefined);
    }

    if (state.idle) {
      clearTimeout(state.idle);
    }

    state.idle = setTimeout(() => this.stopTyping(conversationId), TYPING_IDLE_MS);
    this.outgoingTyping.set(conversationId, state);
  }

  /** Quién escribe en una conversación, sin contar a quien mira. */
  typingIn(conversationId: string): Signal<UserSummary[]> {
    return computed(() => {
      const ids = this.typingSignal().get(conversationId);
      const conversation = this.conversationsSignal().find((item) => item.id === conversationId);

      if (!ids?.size || !conversation) {
        return [];
      }

      return conversation.members.map((member) => member.user).filter((user) => ids.has(user.id));
    });
  }

  // --- Muelle ---------------------------------------------------------------

  /**
   * Abre una conversación donde toque.
   *
   * En una pantalla ancha, en una ventana del muelle sin salir de la página;
   * en el móvil, en la pantalla de mensajes.
   */
  async openConversation(conversationId: string): Promise<void> {
    if (!prefersDock()) {
      await this.router.navigate(['/messages', conversationId]);

      return;
    }

    this.minimizedSignal.update((current) => {
      const next = new Set(current);
      next.delete(conversationId);

      return next;
    });

    this.dockSignal.update((current) =>
      current.includes(conversationId)
        ? current
        : [...current, conversationId].slice(-MAX_DOCK_WINDOWS),
    );
  }

  async openWith(userId: string): Promise<void> {
    const conversation = await this.startConversationWith(userId);
    await this.openConversation(conversation.id);
  }

  closeWindow(conversationId: string): void {
    this.dockSignal.update((current) => current.filter((id) => id !== conversationId));
  }

  toggleMinimized(conversationId: string): void {
    this.minimizedSignal.update((current) => {
      const next = new Set(current);

      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }

      return next;
    });
  }

  // --- Avisos en tiempo real ------------------------------------------------

  private apply(event: ChatEvent): void {
    const me = this.auth.user()?.id;

    switch (event.type) {
      case 'message_created': {
        if (!event.message) {
          return;
        }

        const own = event.message.sender.id === me;
        this.addToThread(event.message);
        this.bumpConversation(event.message, own);
        this.clearTyping(event.conversationId, event.message.sender.id);

        if (!own) {
          if (this.isVisible(event.conversationId)) {
            this.scheduleRead(event.conversationId, 400);
          } else {
            this.scheduleDelivered(event.conversationId);
          }
        }

        return;
      }

      case 'message_updated':
      case 'message_deleted':
      case 'reactions_changed':
        if (event.message) {
          this.replaceInThread(event.conversationId, event.message.id, event.message);
        }

        return;

      case 'read':
        if (event.userId && event.at) {
          this.applyRead(
            event.conversationId,
            event.userId,
            event.at,
            event.lastReadMessageId,
            event.userId === me,
          );
        }

        return;

      case 'delivered':
        if (event.userId && event.at && event.userId !== me) {
          this.applyDelivered(event.conversationId, event.at);
        }

        return;

      case 'typing':
        if (event.userId && event.userId !== me) {
          this.applyTyping(event.conversationId, event.userId, event.typing === true);
        }

        return;

      case 'conversation_updated':
        if (event.conversation) {
          this.upsert(event.conversation);
        }

        return;

      case 'conversation_removed':
        this.forget(event.conversationId);

        return;
    }
  }

  private addToThread(message: Message): void {
    const thread = this.threads.get(message.conversationId);

    if (!thread || !thread().loaded) {
      return;
    }

    thread.update((state) => ({ ...state, messages: mergeMessages([message], state.messages) }));

    if (message.clientId) {
      void this.removeFromOutbox(message.clientId);
    }
  }

  private bumpConversation(message: Message, own: boolean): void {
    const existing = this.conversationsSignal().find((item) => item.id === message.conversationId);

    if (!existing) {
      // Una conversación nueva —alguien escribe por primera vez—: se pide
      // entera, que es más fiable que reconstruirla a partir del mensaje.
      void this.fetchConversation(message.conversationId).catch(() => undefined);

      return;
    }

    this.patch(message.conversationId, {
      lastMessageAt: message.createdAt,
      lastPreview: previewOf(message),
      lastSenderId: message.sender.id,
      archived: false,
      unreadCount:
        own || this.isVisible(message.conversationId)
          ? existing.unreadCount
          : existing.unreadCount + 1,
    });
  }

  /**
   * Alguien leyó hasta un momento.
   *
   * En una conversación de dos, lo propio anterior pasa a «leído». En un grupo
   * se suma uno a quienes lo han leído, si esa persona no lo había leído ya.
   */
  private applyRead(
    conversationId: string,
    userId: string,
    at: string,
    lastReadMessageId: string | null,
    byMe: boolean,
  ): void {
    const conversation = this.conversationsSignal().find((item) => item.id === conversationId);

    if (!conversation) {
      return;
    }

    const member = conversation.members.find((item) => item.user.id === userId);
    const previous = member?.lastReadAt ? Date.parse(member.lastReadAt) : 0;
    const until = Date.parse(at);

    this.patch(conversationId, {
      unreadCount: byMe ? 0 : conversation.unreadCount,
      members: conversation.members.map((item) =>
        item.user.id === userId ? { ...item, lastReadAt: at, lastReadMessageId } : item,
      ),
    });

    if (byMe) {
      return;
    }

    const me = this.auth.user()?.id;

    this.threads.get(conversationId)?.update((state) => ({
      ...state,
      messages: state.messages.map((message) => {
        const created = Date.parse(message.createdAt);

        if (
          message.sender.id !== me ||
          message.status === 'sending' ||
          message.status === 'failed' ||
          created > until
        ) {
          return message;
        }

        if (conversation.type === 'direct') {
          return message.status === 'read' ? message : { ...message, status: 'read' };
        }

        return created > previous ? { ...message, readCount: message.readCount + 1 } : message;
      }),
    }));
  }

  private applyDelivered(conversationId: string, at: string): void {
    const me = this.auth.user()?.id;
    const until = Date.parse(at);

    this.threads.get(conversationId)?.update((state) => ({
      ...state,
      messages: state.messages.map((message) =>
        message.sender.id === me &&
        message.status === 'sent' &&
        Date.parse(message.createdAt) <= until
          ? { ...message, status: 'delivered' }
          : message,
      ),
    }));
  }

  private applyTyping(conversationId: string, userId: string, typing: boolean): void {
    const key = `${conversationId}:${userId}`;
    const timer = this.typingTimers.get(key);

    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(key);
    }

    if (!typing) {
      this.clearTyping(conversationId, userId);

      return;
    }

    this.typingSignal.update((current) => {
      const next = new Map(current);
      next.set(conversationId, new Set([...(current.get(conversationId) ?? []), userId]));

      return next;
    });

    // Sin caducidad, cerrar la aplicación a media frase dejaría el aviso
    // colgado para siempre en la pantalla de la otra persona.
    this.typingTimers.set(
      key,
      setTimeout(() => this.clearTyping(conversationId, userId), TYPING_TIMEOUT_MS),
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

      if (updated.size) {
        next.set(conversationId, updated);
      } else {
        next.delete(conversationId);
      }

      return next;
    });
  }

  /** Pide lo que se perdió mientras no había conexión. */
  private async catchUp(): Promise<void> {
    await this.loadConversations().catch(() => undefined);

    for (const [conversationId, thread] of this.threads) {
      const state = thread();
      const last = [...state.messages]
        .reverse()
        .find((message) => !message.id.startsWith('local:'));

      if (!state.loaded || !last) {
        continue;
      }

      try {
        const page = await this.fetchMessages(conversationId, { after: last.id, limit: 100 });
        thread.update((current) => ({
          ...current,
          messages: mergeMessages(page.data, current.messages),
        }));
      } catch {
        // Se reintentará en la siguiente reconexión.
      }
    }

    await this.flushStoredOutbox();
  }

  // --- Interno --------------------------------------------------------------

  private async deliver(message: ChatMessage): Promise<void> {
    const local = message.local;

    try {
      const sent = await this.gql.field<Message>(SEND_MESSAGE, {
        conversationId: message.conversationId,
        input: {
          clientId: message.clientId,
          body: message.body,
          replyToId: local?.replyToId ?? null,
          sharedPostId: local?.sharedPostId ?? null,
          durationMs: local?.durationMs ?? null,
        },
        files: local?.attachments.length ? local.attachments.map((item) => item.file) : null,
      });

      for (const attachment of local?.attachments ?? []) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      }

      this.replaceInThread(message.conversationId, message.id, sent);
      this.bumpConversation(sent, true);
      await this.removeFromOutbox(message.clientId);
    } catch {
      this.replaceInThread(message.conversationId, message.id, { ...message, status: 'failed' });
    }
  }

  /**
   * Cambia un mensaje del hilo por otro.
   *
   * Busca por id y, si no lo encuentra, por `clientId`: así la respuesta del
   * servidor sustituye a la copia optimista, y si el aviso en tiempo real llegó
   * antes que la respuesta no se queda duplicado.
   */
  private replaceInThread(conversationId: string, id: string, next: ChatMessage): void {
    this.threads.get(conversationId)?.update((state) => {
      let found = false;
      const messages = state.messages
        .map((message) => {
          if (
            message.id === id ||
            message.id === next.id ||
            (next.clientId && message.clientId === next.clientId)
          ) {
            if (found) {
              return null;
            }

            found = true;

            return next;
          }

          return message;
        })
        .filter((message): message is ChatMessage => message !== null);

      return { ...state, messages };
    });
  }

  private fetchMessages(
    conversationId: string,
    query: { before?: string; after?: string; limit?: number },
  ): Promise<MessagePage> {
    return this.gql.field(MESSAGES, { conversationId, query: { limit: PAGE_SIZE, ...query } });
  }

  private threadSignal(conversationId: string): WritableSignal<ThreadState> {
    let thread = this.threads.get(conversationId);

    if (!thread) {
      thread = signal<ThreadState>(EMPTY_THREAD);
      this.threads.set(conversationId, thread);
    }

    return thread;
  }

  private upsert(conversation: Conversation): void {
    this.conversationsSignal.update((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
  }

  private patch(id: string, changes: Partial<Conversation>): void {
    this.conversationsSignal.update((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  private forget(id: string): void {
    this.conversationsSignal.update((current) => current.filter((item) => item.id !== id));
    this.threads.delete(id);
    this.closeWindow(id);
  }

  private isVisible(conversationId: string): boolean {
    return this.active.has(conversationId) && document.visibilityState === 'visible';
  }

  private scheduleRead(conversationId: string, delay: number): void {
    clearTimeout(this.pendingRead.get(conversationId));
    this.pendingRead.set(
      conversationId,
      setTimeout(() => {
        this.pendingRead.delete(conversationId);
        const conversation = this.conversationsSignal().find((item) => item.id === conversationId);

        if (conversation && conversation.unreadCount === 0 && delay === 0) {
          return;
        }

        this.patch(conversationId, { unreadCount: 0 });
        void this.gql.request(MARK_READ, { id: conversationId }).catch(() => undefined);
      }, delay),
    );
  }

  private scheduleDelivered(conversationId: string): void {
    if (this.pendingDelivered.has(conversationId)) {
      return;
    }

    this.pendingDelivered.set(
      conversationId,
      setTimeout(() => {
        this.pendingDelivered.delete(conversationId);
        void this.gql.request(MARK_DELIVERED, { id: conversationId }).catch(() => undefined);
      }, 1000),
    );
  }

  private stopTyping(conversationId: string): void {
    const state = this.outgoingTyping.get(conversationId);

    if (!state) {
      return;
    }

    if (state.idle) {
      clearTimeout(state.idle);
    }

    this.outgoingTyping.delete(conversationId);
    void this.gql.request(SET_TYPING, { conversationId, typing: false }).catch(() => undefined);
  }

  private async storeOutbox(message: ChatMessage): Promise<void> {
    if (!message.clientId) {
      return;
    }

    const entries = (await this.storage.get<StoredOutboxEntry[]>(StorageKey.ChatOutbox)) ?? [];
    entries.push({
      conversationId: message.conversationId,
      clientId: message.clientId,
      body: message.body ?? '',
      replyToId: message.local?.replyToId ?? null,
      sharedPostId: message.local?.sharedPostId ?? null,
      createdAt: message.createdAt,
    });
    await this.storage.set(StorageKey.ChatOutbox, entries);
  }

  private async removeFromOutbox(clientId: string | null): Promise<void> {
    if (!clientId) {
      return;
    }

    const entries = (await this.storage.get<StoredOutboxEntry[]>(StorageKey.ChatOutbox)) ?? [];
    const remaining = entries.filter((entry) => entry.clientId !== clientId);

    if (remaining.length !== entries.length) {
      await this.storage.set(StorageKey.ChatOutbox, remaining.length ? remaining : null);
    }
  }

  /**
   * Reintenta lo que quedó sin enviar la última vez que se usó la app.
   *
   * Con el mismo `clientId`: si en realidad sí llegó, el servidor devuelve el
   * mensaje que ya tenía en lugar de crear otro.
   */
  private async flushStoredOutbox(): Promise<void> {
    const entries = (await this.storage.get<StoredOutboxEntry[]>(StorageKey.ChatOutbox)) ?? [];
    const me = this.auth.user();

    if (!me) {
      return;
    }

    for (const entry of entries) {
      const thread = this.threadSignal(entry.conversationId);

      if (thread().messages.some((message) => message.clientId === entry.clientId)) {
        continue;
      }

      const message: ChatMessage = {
        id: `local:${entry.clientId}`,
        conversationId: entry.conversationId,
        clientId: entry.clientId,
        kind: entry.sharedPostId ? 'post_share' : 'text',
        body: entry.body || null,
        attachments: [],
        replyTo: null,
        sharedPost: null,
        story: null,
        system: null,
        sender: summaryOf(me),
        reactions: [],
        status: 'sending',
        readCount: 0,
        editedAt: null,
        deleted: false,
        createdAt: entry.createdAt,
        local: {
          attachments: [],
          replyToId: entry.replyToId,
          sharedPostId: entry.sharedPostId,
          durationMs: null,
        },
      };

      thread.update((state) => ({ ...state, messages: [...state.messages, message] }));
      await this.deliver(message);
    }
  }
}

/** Junta dos tramos de mensajes sin repetir y en orden. */
function mergeMessages(incoming: ChatMessage[], existing: ChatMessage[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();

  for (const message of existing) {
    byKey.set(
      message.clientId && message.id.startsWith('local:') ? `c:${message.clientId}` : message.id,
      message,
    );
  }

  for (const message of incoming) {
    if (message.clientId) {
      byKey.delete(`c:${message.clientId}`);
    }

    byKey.set(message.id, message);
  }

  return [...byKey.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }

    return Date.parse(b.lastMessageAt ?? b.createdAt) - Date.parse(a.lastMessageAt ?? a.createdAt);
  });
}

/** El resumen del último mensaje, como lo escribe el servidor. */
export function previewOf(message: Pick<Message, 'kind' | 'body' | 'deleted'>): string {
  if (message.deleted) {
    return '';
  }

  const icon: Partial<Record<Message['kind'], string>> = {
    image: '📷',
    video: '🎥',
    audio: '🎤',
    file: '📎',
    post_share: '↪️',
  };

  return [icon[message.kind], message.body].filter(Boolean).join(' ');
}

function kindOf(
  attachments: LocalAttachment[],
  sharedPostId?: string,
  durationMs?: number,
): Message['kind'] {
  if (sharedPostId) {
    return 'post_share';
  }

  const first = attachments[0];

  if (!first) {
    return 'text';
  }

  if (first.type === 'audio' || durationMs) {
    return 'audio';
  }

  return first.type === 'image' || first.type === 'video' ? first.type : 'file';
}

function localMedia(attachment: LocalAttachment, id: string): Media {
  return {
    id,
    type: attachment.type,
    url: attachment.previewUrl ?? '',
    alt: attachment.name,
    width: null,
    height: null,
    mimeType: attachment.file.type || null,
    sizeBytes: attachment.file.size,
    durationMs: null,
    posterUrl: null,
    fileName: attachment.name,
  };
}

function summaryOf(user: UserSummary): UserSummary {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar ? { ...user.avatar } : null,
    verified: user.verified,
  };
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Cierto en pantallas donde caben ventanas de chat sin tapar el contenido. */
export function prefersDock(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1200px)').matches;
}

/** Convierte un archivo elegido en un adjunto listo para enviar. */
export function toAttachment(file: File | Blob, name?: string): LocalAttachment {
  const type = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'file';

  return {
    file,
    name: name ?? (file instanceof File ? file.name : 'archivo'),
    type,
    previewUrl:
      type === 'image' || type === 'video' || type === 'audio' ? URL.createObjectURL(file) : null,
  };
}
