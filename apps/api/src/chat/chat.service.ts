import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  ChatEvent,
  Conversation as ConversationDto,
  Message as MessageDto,
  MessagePage,
} from '@social-network/shared';

import { AppException, ErrorCode } from '../common/errors.js';
import { escapeRegex } from '../common/utils/regex.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Conversation, ConversationMember, Message } from '../database/schemas/chat.schema.js';
import { Post } from '../database/schemas/content.schema.js';
import {
  Audience,
  ChatEventType,
  ConversationRole,
  ConversationType,
  MediaType,
  MessageKind,
  SystemMessageAction,
} from '../database/schemas/enums.js';
import { User } from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';
import type { PendingUpload } from '../media/upload.js';
import { PushService } from '../notifications/push.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { PresenceService } from '../realtime/presence.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import type { UserChannelMessage } from '../realtime/user-channel.js';
import { RelationshipService } from '../social/relationship.service.js';
import {
  ChatPresenterService,
  POPULATE_MESSAGE,
  type LeanConversation,
  type LeanMember,
  type LeanMessage,
} from './chat-presenter.service.js';
import {
  MAX_GROUP_MEMBERS,
  type ConversationListQueryDto,
  type SendMessageDto,
} from './dto/chat.dto.js';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
/** Longitud del resumen que se guarda en la conversación para la lista. */
const PREVIEW_LENGTH = 160;
/** Adjuntos por mensaje. */
const MAX_ATTACHMENTS = 10;
/** Cuánto tiempo se puede editar un mensaje después de enviarlo. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const SUMMARY = 'name firstName lastName avatarId verified';

/**
 * Chat: conversaciones de dos y de grupo.
 *
 * Todas las escrituras guardan primero y anuncian después, por el tema
 * privado de cada participante: el mensaje existe aunque la conexión en vivo
 * de quien lo recibe esté caída, y al volver se pone al día pidiendo lo
 * posterior al último que tiene.
 *
 * Tres garantías que un chat serio no puede saltarse:
 *
 * - **Sin duplicados**: el cliente pone un `clientId` a cada mensaje antes de
 *   enviarlo; reintentar tras un corte devuelve el ya guardado.
 * - **Estados fiables**: «entregado» lo confirma el dispositivo que lo recibe y
 *   «visto», quien abre la conversación; nunca se suponen.
 * - **Bloqueos**: con un bloqueo por medio la conversación de dos queda de sólo
 *   lectura, y en los grupos no se puede añadir a quien te bloqueó.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    @InjectModel(ConversationMember.name) private readonly members: Model<ConversationMember>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    private readonly media: MediaService,
    private readonly relationships: RelationshipService,
    private readonly presenter: ChatPresenterService,
    private readonly bus: EventBusService,
    private readonly presence: PresenceService,
    private readonly push: PushService,
  ) {}

  // --- Conversaciones ---------------------------------------------------------

  /** La bandeja: fijadas primero, luego de la más reciente a la más antigua. */
  async listConversations(
    userId: string,
    query: ConversationListQueryDto = {},
  ): Promise<ConversationDto[]> {
    const memberships = await this.members
      .find({ userId, archived: query.archived === true, leftAt: null })
      .select('conversationId')
      .lean();

    if (memberships.length === 0) {
      return [];
    }

    const ids = memberships.map((membership) => membership.conversationId);
    const docs = (await this.conversations
      .find({ _id: { $in: ids } })
      .populate('photo')
      .lean()) as unknown as LeanConversation[];

    const allMembers = await this.loadMembers(ids);
    const blocked = await this.relationships.blockedIds(userId);
    const search = query.search ? new RegExp(escapeRegex(query.search), 'i') : null;

    return (
      docs
        // Una conversación de dos que aún no tiene mensajes sólo la ve quien la abrió.
        .filter((doc) => doc.lastMessageAt !== null || String(doc.createdById) === userId)
        .map((doc) => {
          const members = allMembers.get(String(doc._id)) ?? [];

          return this.presenter.conversation(doc, members, userId, {
            blocked: this.peerBlocked(doc, members, userId, blocked),
          });
        })
        .filter((conversation) => {
          if (!search) {
            return true;
          }

          const names = [
            conversation.title ?? '',
            ...conversation.members.map(
              (m) => `${m.user.firstName} ${m.user.lastName} ${m.user.name}`,
            ),
          ];

          return names.some((name) => search.test(name));
        })
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
        )
    );
  }

  async findConversation(conversationId: string, userId: string): Promise<ConversationDto> {
    await this.assertMember(conversationId, userId, { allowLeft: true });

    return this.describe(conversationId, userId);
  }

  /** Total de mensajes sin leer, para el distintivo del menú. */
  async countUnread(userId: string): Promise<number> {
    const rows = await this.members.aggregate<{ total: number }>([
      { $match: { userId: new ObjectId(userId), leftAt: null, archived: false, muted: false } },
      { $group: { _id: null, total: { $sum: '$unreadCount' } } },
    ]);

    return rows[0]?.total ?? 0;
  }

  /**
   * Devuelve la conversación con otra persona, creándola si aún no existe.
   *
   * Es idempotente incluso con peticiones simultáneas: la clave de la pareja
   * lleva un índice único.
   */
  async startDirect(userId: string, peerId: string): Promise<ConversationDto> {
    if (userId === peerId) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'You cannot start a conversation with yourself',
      );
    }

    if (!isValidObjectId(peerId) || !(await this.users.exists({ _id: peerId }))) {
      throw AppException.notFound('User');
    }

    const directKey = [userId, peerId].sort().join(':');
    const existing = await this.conversations.findOne({ directKey }).select('_id').lean();

    if (existing) {
      return this.describe(String(existing._id), userId);
    }

    // Se comprueba sólo al abrir una nueva: un hilo que ya existe sigue
    // abierto aunque después se cierre la puerta, porque cerrarla es dejar de
    // recibir desconocidos, no callar a quien ya estaba hablando.
    if (!(await this.relationships.canMessage(userId, peerId))) {
      throw AppException.forbidden('This person does not accept messages from you');
    }

    let conversationId: Types.ObjectId;

    try {
      const created = await this.conversations.create({
        type: ConversationType.Direct,
        directKey,
        createdById: userId,
      });
      conversationId = created._id;
    } catch (error) {
      // Otra petición la creó a la vez: se usa la suya.
      const raced = await this.conversations.findOne({ directKey }).select('_id').lean();

      if (!raced) {
        throw error;
      }

      return this.describe(String(raced._id), userId);
    }

    await this.members.insertMany([
      { conversationId, userId, role: ConversationRole.Member },
      { conversationId, userId: peerId, role: ConversationRole.Member },
    ]);

    return this.describe(String(conversationId), userId);
  }

  async createGroup(
    creatorId: string,
    title: string,
    memberIds: string[],
  ): Promise<ConversationDto> {
    const others = [...new Set(memberIds.filter((id) => id !== creatorId))];

    if (others.length === 0) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'A group needs at least one other person',
      );
    }

    await this.assertCanAdd(creatorId, others);

    const conversation = await this.conversations.create({
      type: ConversationType.Group,
      title,
      createdById: creatorId,
    });

    await this.members.insertMany([
      { conversationId: conversation._id, userId: creatorId, role: ConversationRole.Owner },
      ...others.map((id) => ({
        conversationId: conversation._id,
        userId: id,
        role: ConversationRole.Member,
      })),
    ]);

    await this.systemMessage(
      String(conversation._id),
      creatorId,
      SystemMessageAction.Created,
      [],
      title,
    );

    return this.describe(String(conversation._id), creatorId);
  }

  async addMembers(
    conversationId: string,
    actorId: string,
    userIds: string[],
  ): Promise<ConversationDto> {
    const conversation = await this.assertGroupAdmin(conversationId, actorId);
    const candidates = [...new Set(userIds.filter((id) => id !== actorId && isValidObjectId(id)))];

    const active = await this.members.countDocuments({ conversationId, leftAt: null });

    if (active + candidates.length > MAX_GROUP_MEMBERS + 1) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        `A group cannot have more than ${MAX_GROUP_MEMBERS + 1} people`,
      );
    }

    await this.assertCanAdd(actorId, candidates);

    const added: string[] = [];

    for (const userId of candidates) {
      const result = await this.members.updateOne(
        { conversationId, userId },
        {
          $set: { leftAt: null, role: ConversationRole.Member, archived: false },
          $setOnInsert: { conversationId, userId },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        added.push(userId);
      }
    }

    if (added.length > 0) {
      await this.systemMessage(
        String(conversation._id),
        actorId,
        SystemMessageAction.MembersAdded,
        added,
      );
    }

    return this.describe(conversationId, actorId);
  }

  async removeMember(
    conversationId: string,
    actorId: string,
    userId: string,
  ): Promise<ConversationDto> {
    await this.assertGroupAdmin(conversationId, actorId);

    const target = await this.members.findOne({ conversationId, userId, leftAt: null }).lean();

    if (!target) {
      throw AppException.notFound('Member');
    }

    if (target.role === ConversationRole.Owner) {
      throw AppException.forbidden('The owner cannot be removed');
    }

    await this.members.updateOne({ _id: target._id }, { $set: { leftAt: new Date() } });
    await this.systemMessage(conversationId, actorId, SystemMessageAction.MemberRemoved, [userId]);
    await this.emitToUsers([userId], {
      type: ChatEventType.ConversationRemoved,
      conversationId,
      message: null,
      conversation: null,
      userId,
      typing: null,
      at: new Date().toISOString(),
      lastReadMessageId: null,
    });

    return this.describe(conversationId, actorId);
  }

  /**
   * Sale de un grupo.
   *
   * Si se va quien lo creó, la propiedad pasa a un administrador —o, si no hay,
   * a quien más tiempo lleve dentro—: un grupo sin nadie al mando no podría
   * volver a cambiar de nombre ni añadir a nadie.
   */
  async leave(conversationId: string, userId: string): Promise<void> {
    const membership = await this.assertMember(conversationId, userId);
    const conversation = await this.conversations.findById(conversationId).select('type').lean();

    if (conversation?.type !== ConversationType.Group) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'Only groups can be left');
    }

    await this.members.updateOne({ _id: membership._id }, { $set: { leftAt: new Date() } });

    if (membership.role === ConversationRole.Owner) {
      const heir =
        (await this.members
          .findOne({ conversationId, leftAt: null, role: ConversationRole.Admin })
          .sort({ createdAt: 1 })
          .lean()) ??
        (await this.members
          .findOne({ conversationId, leftAt: null })
          .sort({ createdAt: 1 })
          .lean());

      if (heir) {
        await this.members.updateOne({ _id: heir._id }, { $set: { role: ConversationRole.Owner } });
      }
    }

    await this.systemMessage(conversationId, userId, SystemMessageAction.MemberLeft, []);
  }

  async renameGroup(
    conversationId: string,
    actorId: string,
    title: string,
  ): Promise<ConversationDto> {
    await this.assertGroupAdmin(conversationId, actorId);
    await this.conversations.updateOne({ _id: conversationId }, { $set: { title } });
    await this.systemMessage(conversationId, actorId, SystemMessageAction.Renamed, [], title);

    return this.describe(conversationId, actorId);
  }

  async setGroupPhoto(
    conversationId: string,
    actorId: string,
    upload: PendingUpload,
  ): Promise<ConversationDto> {
    const conversation = await this.assertGroupAdmin(conversationId, actorId);
    const stored = await this.media.storeUpload(upload, {
      accept: ['image'],
      preset: 'avatar',
      uploaderId: actorId,
    });

    await this.conversations.updateOne({ _id: conversationId }, { $set: { photoId: stored._id } });

    if (conversation.photoId) {
      await this.media.remove(conversation.photoId);
    }

    await this.systemMessage(conversationId, actorId, SystemMessageAction.PhotoChanged, []);

    return this.describe(conversationId, actorId);
  }

  async setAdmin(
    conversationId: string,
    actorId: string,
    userId: string,
    admin: boolean,
  ): Promise<ConversationDto> {
    await this.assertGroupAdmin(conversationId, actorId);

    const updated = await this.members.updateOne(
      { conversationId, userId, leftAt: null, role: { $ne: ConversationRole.Owner } },
      { $set: { role: admin ? ConversationRole.Admin : ConversationRole.Member } },
    );

    if (updated.matchedCount === 0) {
      throw AppException.notFound('Member');
    }

    if (admin) {
      await this.systemMessage(conversationId, actorId, SystemMessageAction.AdminGranted, [userId]);
    } else {
      await this.broadcastConversation(conversationId);
    }

    return this.describe(conversationId, actorId);
  }

  async setMuted(conversationId: string, userId: string, muted: boolean): Promise<void> {
    await this.assertMember(conversationId, userId, { allowLeft: true });
    await this.members.updateOne({ conversationId, userId }, { $set: { muted } });
  }

  async setArchived(conversationId: string, userId: string, archived: boolean): Promise<void> {
    await this.assertMember(conversationId, userId, { allowLeft: true });
    await this.members.updateOne({ conversationId, userId }, { $set: { archived } });
  }

  async setPinned(conversationId: string, userId: string, pinned: boolean): Promise<void> {
    await this.assertMember(conversationId, userId, { allowLeft: true });
    await this.members.updateOne(
      { conversationId, userId },
      { $set: { pinnedAt: pinned ? new Date() : null } },
    );
  }

  /** Vacía el hilo sólo para quien lo pide: lo anterior deja de verse, para los demás sigue ahí. */
  async clearHistory(conversationId: string, userId: string): Promise<void> {
    await this.assertMember(conversationId, userId, { allowLeft: true });
    await this.members.updateOne(
      { conversationId, userId },
      { $set: { clearedAt: new Date(), unreadCount: 0, lastReadAt: new Date() } },
    );
  }

  // --- Mensajes ---------------------------------------------------------------

  /**
   * Tramo del hilo.
   *
   * Con `before`, lo anterior —para subir—; con `after`, lo posterior —para
   * ponerse al día al reconectar—. Se pagina por el identificador, que en
   * Mongo crece con el tiempo.
   */
  async listMessages(
    conversationId: string,
    userId: string,
    options: { before?: string; after?: string; limit?: number } = {},
  ): Promise<MessagePage> {
    const membership = await this.assertMember(conversationId, userId, { allowLeft: true });
    const take = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));
    const forward = Boolean(options.after && isValidObjectId(options.after));

    const idFilter: Record<string, unknown> = {};

    if (options.before && isValidObjectId(options.before)) {
      idFilter['$lt'] = new ObjectId(options.before);
    }

    if (forward) {
      idFilter['$gt'] = new ObjectId(options.after);
    }

    const createdFilter: Record<string, unknown> = {};

    if (membership.clearedAt) {
      createdFilter['$gt'] = membership.clearedAt;
    }

    if (membership.leftAt) {
      createdFilter['$lte'] = membership.leftAt;
    }

    const docs = (await this.messages
      .find({
        conversationId,
        hiddenFor: { $ne: new ObjectId(userId) },
        ...(Object.keys(idFilter).length > 0 ? { _id: idFilter } : {}),
        ...(Object.keys(createdFilter).length > 0 ? { createdAt: createdFilter } : {}),
      })
      .sort({ _id: forward ? 1 : -1 })
      // Se pide uno de más para saber si queda algo sin lanzar otra consulta.
      .limit(take + 1)
      .populate(POPULATE_MESSAGE)
      .lean()) as unknown as LeanMessage[];

    const hasMore = docs.length > take;
    const page = hasMore ? docs.slice(0, take) : docs;
    // El hilo se pinta de arriba abajo, así que se devuelve en orden natural.
    const ordered = forward ? page : [...page].reverse();
    const members =
      (await this.loadMembers([new ObjectId(conversationId)])).get(conversationId) ?? [];

    return {
      data: await this.presenter.messages(ordered, members, userId),
      nextCursor: hasMore ? String((forward ? page.at(-1) : page.at(-1))?._id ?? '') || null : null,
    };
  }

  /** Busca en el texto de una conversación. */
  async searchMessages(
    conversationId: string,
    userId: string,
    term: string,
  ): Promise<MessageDto[]> {
    await this.assertMember(conversationId, userId, { allowLeft: true });

    const docs = (await this.messages
      .find({
        conversationId,
        deletedAt: null,
        hiddenFor: { $ne: new ObjectId(userId) },
        body: { $regex: escapeRegex(term.trim()), $options: 'i' },
      })
      .sort({ _id: -1 })
      .limit(50)
      .populate(POPULATE_MESSAGE)
      .lean()) as unknown as LeanMessage[];

    const members =
      (await this.loadMembers([new ObjectId(conversationId)])).get(conversationId) ?? [];

    return this.presenter.messages(docs, members, userId);
  }

  /**
   * Envía un mensaje, con o sin adjuntos.
   *
   * El tipo lo decide lo que lleva: una nota de voz, fotos o vídeos, un
   * documento, una publicación compartida o texto. Los archivos se guardan
   * antes que el mensaje y, si alguno falla, se borran los demás.
   */
  async send(
    conversationId: string,
    senderId: string,
    input: SendMessageDto,
    files: PendingUpload[] = [],
  ): Promise<MessageDto> {
    const membership = await this.assertMember(conversationId, senderId);
    const conversation = await this.conversations.findById(conversationId).lean();

    if (!conversation) {
      throw AppException.notFound('Conversation');
    }

    if (input.clientId) {
      const duplicate = await this.messages
        .findOne({ senderId, clientId: input.clientId })
        .select('_id')
        .lean();

      if (duplicate) {
        return this.findMessage(String(duplicate._id), senderId);
      }
    }

    await this.assertCanWriteTo(conversation, senderId);

    const body = input.body?.trim() || null;

    if (!body && files.length === 0 && !input.sharedPostId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The message is empty');
    }

    if (files.length > MAX_ATTACHMENTS) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        `A message cannot have more than ${MAX_ATTACHMENTS} files`,
      );
    }

    if (
      input.replyToId &&
      !(await this.messages.exists({ _id: input.replyToId, conversationId }))
    ) {
      throw AppException.notFound('Message');
    }

    if (input.sharedPostId) {
      const post = await this.posts
        .findById(input.sharedPostId)
        .select('audience authorPrivate userId')
        .lean();

      if (!post || post.audience !== Audience.Public || post.authorPrivate) {
        throw AppException.forbiddenWith(
          ErrorCode.PrivateContent,
          'Only public posts can be shared',
        );
      }
    }

    const attachments = await this.storeAttachments(files, senderId, input.durationMs);

    try {
      const kind = this.kindOf(attachments, Boolean(input.sharedPostId));
      const now = new Date();

      const created = await this.messages.create({
        conversationId,
        senderId,
        clientId: input.clientId ?? null,
        kind,
        body,
        attachmentIds: attachments.map((item) => item._id),
        replyToId: input.replyToId ?? null,
        sharedPostId: input.sharedPostId ?? null,
      });

      await this.afterMessage(
        conversationId,
        senderId,
        created._id,
        previewOf(kind, body),
        now,
        membership._id,
      );

      const message = await this.findMessage(String(created._id), senderId);

      await this.announceMessage(conversationId, senderId, message);

      return message;
    } catch (error) {
      await this.media.removeMany(attachments.map((item) => item._id));

      // El índice único de `clientId` puede saltar si dos reintentos llegan a
      // la vez: se devuelve el que ganó.
      if (input.clientId && isDuplicateKey(error)) {
        const winner = await this.messages
          .findOne({ senderId, clientId: input.clientId })
          .select('_id')
          .lean();

        if (winner) {
          return this.findMessage(String(winner._id), senderId);
        }
      }

      throw error;
    }
  }

  /**
   * Contesta a una historia por privado.
   *
   * Abre —o reutiliza— la conversación con quien la publicó y deja el mensaje
   * con la referencia a la historia, como hace Instagram.
   */
  async sendStoryReply(
    senderId: string,
    authorId: string,
    storyId: Types.ObjectId,
    body: string,
  ): Promise<MessageDto> {
    const directKey = [senderId, authorId].sort().join(':');
    let conversation = await this.conversations.findOne({ directKey }).select('_id').lean();

    if (!conversation) {
      const opened = await this.startDirect(senderId, authorId);
      conversation = { _id: new ObjectId(opened.id) } as never;
    }

    const conversationId = String(conversation?._id);
    const membership = await this.assertMember(conversationId, senderId);
    const now = new Date();

    const created = await this.messages.create({
      conversationId,
      senderId,
      kind: MessageKind.StoryReply,
      body,
      storyId,
    });

    await this.afterMessage(
      conversationId,
      senderId,
      created._id,
      previewOf(MessageKind.StoryReply, body),
      now,
      membership._id,
    );

    const message = await this.findMessage(String(created._id), senderId);

    await this.announceMessage(conversationId, senderId, message);

    return message;
  }

  async edit(messageId: string, userId: string, body: string): Promise<MessageDto> {
    const message = await this.ownMessage(messageId, userId);
    const text = body.trim();

    if (message.deletedAt || message.kind === MessageKind.System) {
      throw AppException.notFound('Message');
    }

    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw AppException.forbidden('Messages can only be edited for 15 minutes');
    }

    if (!text && message.attachmentIds.length === 0) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The message is empty');
    }

    await this.messages.updateOne(
      { _id: messageId },
      { $set: { body: text || null, editedAt: new Date() } },
    );

    const updated = await this.findMessage(messageId, userId);

    await this.emitToMembers(String(message.conversationId), (memberId) => ({
      type: ChatEventType.MessageUpdated,
      conversationId: String(message.conversationId),
      message: this.presenter.forViewer(updated, memberId),
      conversation: null,
      userId,
      typing: null,
      at: null,
      lastReadMessageId: null,
    }));

    return updated;
  }

  /**
   * Retira un mensaje para todos.
   *
   * No se borra el documento: dejaría un hueco en el hilo de los demás. Se
   * marca como eliminado y se vacía el contenido, que es lo que de verdad
   * interesa que desaparezca, incluidos los archivos.
   */
  async deleteForEveryone(messageId: string, userId: string): Promise<MessageDto> {
    const message = await this.ownMessage(messageId, userId);

    if (message.deletedAt) {
      return this.findMessage(messageId, userId);
    }

    await this.messages.updateOne(
      { _id: messageId },
      {
        $set: {
          deletedAt: new Date(),
          body: null,
          attachmentIds: [],
          sharedPostId: null,
          reactions: [],
        },
      },
    );
    await this.media.removeMany(message.attachmentIds);

    const conversationId = String(message.conversationId);
    const conversation = await this.conversations
      .findById(conversationId)
      .select('lastMessageId')
      .lean();

    if (conversation?.lastMessageId && String(conversation.lastMessageId) === messageId) {
      await this.conversations.updateOne({ _id: conversationId }, { $set: { lastPreview: '' } });
    }

    const deleted = await this.findMessage(messageId, userId);

    await this.emitToMembers(conversationId, (memberId) => ({
      type: ChatEventType.MessageDeleted,
      conversationId,
      message: this.presenter.forViewer(deleted, memberId),
      conversation: null,
      userId,
      typing: null,
      at: null,
      lastReadMessageId: null,
    }));

    return deleted;
  }

  /** Quita un mensaje sólo de la vista propia. Vale para mensajes ajenos. */
  async deleteForMe(messageId: string, userId: string): Promise<void> {
    if (!isValidObjectId(messageId)) {
      throw AppException.notFound('Message');
    }

    const message = await this.messages.findById(messageId).select('conversationId').lean();

    if (!message) {
      throw AppException.notFound('Message');
    }

    await this.assertMember(String(message.conversationId), userId, { allowLeft: true });
    await this.messages.updateOne(
      { _id: messageId },
      { $addToSet: { hiddenFor: new ObjectId(userId) } },
    );
  }

  /**
   * Reacciona con un emoji. Repetir el mismo lo quita; elegir otro lo cambia:
   * una reacción por persona y mensaje, como en Messenger.
   */
  async react(messageId: string, userId: string, emoji: string): Promise<MessageDto> {
    if (!isValidObjectId(messageId)) {
      throw AppException.notFound('Message');
    }

    const message = await this.messages
      .findById(messageId)
      .select('conversationId reactions deletedAt kind')
      .lean();

    if (!message || message.deletedAt || message.kind === MessageKind.System) {
      throw AppException.notFound('Message');
    }

    const conversationId = String(message.conversationId);

    await this.assertMember(conversationId, userId);

    const current = message.reactions.find((reaction) => String(reaction.userId) === userId);

    await this.messages.updateOne(
      { _id: messageId },
      { $pull: { reactions: { userId: new ObjectId(userId) } } },
    );

    if (current?.emoji !== emoji) {
      await this.messages.updateOne(
        { _id: messageId },
        { $push: { reactions: { userId: new ObjectId(userId), emoji, createdAt: new Date() } } },
      );
    }

    const updated = await this.findMessage(messageId, userId);

    await this.emitToMembers(conversationId, (memberId) => ({
      type: ChatEventType.ReactionsChanged,
      conversationId,
      message: this.presenter.forViewer(updated, memberId),
      conversation: null,
      userId,
      typing: null,
      at: null,
      lastReadMessageId: null,
    }));

    return updated;
  }

  /** Marca la conversación como leída hasta el último mensaje y lo anuncia. */
  async markRead(conversationId: string, userId: string): Promise<string> {
    await this.assertMember(conversationId, userId, { allowLeft: true });

    const now = new Date();
    const last = await this.messages
      .findOne({ conversationId })
      .sort({ _id: -1 })
      .select('_id')
      .lean();

    await this.members.updateOne(
      { conversationId, userId },
      {
        $set: {
          lastReadAt: now,
          lastDeliveredAt: now,
          lastReadMessageId: last?._id ?? null,
          unreadCount: 0,
        },
      },
    );

    await this.emitToMembers(conversationId, () => ({
      type: ChatEventType.Read,
      conversationId,
      message: null,
      conversation: null,
      userId,
      typing: null,
      at: now.toISOString(),
      lastReadMessageId: last ? String(last._id) : null,
    }));

    return now.toISOString();
  }

  /**
   * Confirma que los mensajes llegaron a un dispositivo.
   *
   * Lo llama el cliente al recibirlos por la suscripción, no el servidor al
   * mandarlos: que el servidor haya publicado un aviso no garantiza que el
   * móvil lo tenga.
   */
  async markDelivered(conversationId: string, userId: string): Promise<void> {
    await this.assertMember(conversationId, userId, { allowLeft: true });

    const now = new Date();

    const updated = await this.members.updateOne(
      {
        conversationId,
        userId,
        $or: [{ lastDeliveredAt: null }, { lastDeliveredAt: { $lt: now } }],
      },
      { $set: { lastDeliveredAt: now } },
    );

    if (updated.modifiedCount > 0) {
      await this.emitToMembers(
        conversationId,
        () => ({
          type: ChatEventType.Delivered,
          conversationId,
          message: null,
          conversation: null,
          userId,
          typing: null,
          at: now.toISOString(),
          lastReadMessageId: null,
        }),
        userId,
      );
    }
  }

  /**
   * Reenvía «escribiendo…» a los demás.
   *
   * No se guarda en ninguna parte: si el aviso se pierde, el indicador
   * simplemente no aparece, que es preferible a persistir un estado efímero.
   */
  async setTyping(conversationId: string, userId: string, typing: boolean): Promise<void> {
    await this.assertMember(conversationId, userId);

    await this.emitToMembers(
      conversationId,
      () => ({
        type: ChatEventType.Typing,
        conversationId,
        message: null,
        conversation: null,
        userId,
        typing,
        at: new Date().toISOString(),
        lastReadMessageId: null,
      }),
      userId,
    );
  }

  // --- Interno ----------------------------------------------------------------

  private async describe(conversationId: string, viewerId: string): Promise<ConversationDto> {
    const conversation = (await this.conversations
      .findById(conversationId)
      .populate('photo')
      .lean()) as unknown as LeanConversation | null;

    if (!conversation) {
      throw AppException.notFound('Conversation');
    }

    const members = (await this.loadMembers([conversation._id])).get(conversationId) ?? [];
    const blocked = await this.relationships.blockedIds(viewerId);

    return this.presenter.conversation(conversation, members, viewerId, {
      blocked: this.peerBlocked(conversation, members, viewerId, blocked),
    });
  }

  private peerBlocked(
    conversation: LeanConversation,
    members: LeanMember[],
    viewerId: string,
    blocked: Set<string>,
  ): boolean {
    if (conversation.type !== ConversationType.Direct) {
      return false;
    }

    const peer = members.find((member) => String(member.userId) !== viewerId);

    return peer ? blocked.has(String(peer.userId)) : false;
  }

  /** Los participantes de varias conversaciones, con su ficha, de una vez. */
  private async loadMembers(ids: Types.ObjectId[]): Promise<Map<string, LeanMember[]>> {
    const docs = (await this.members
      .find({ conversationId: { $in: ids } })
      .sort({ createdAt: 1 })
      .populate({ path: 'user', select: SUMMARY, populate: { path: 'avatar' } })
      .lean()) as unknown as LeanMember[];

    const map = new Map<string, LeanMember[]>();

    for (const doc of docs) {
      const key = String(doc.conversationId);
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }

    return map;
  }

  /**
   * Comprueba que el usuario participa en la conversación.
   *
   * Se responde «no encontrada» en lugar de «prohibida»: confirmar que la
   * conversación existe ya diría más de la cuenta a quien va probando
   * identificadores.
   */
  private async assertMember(
    conversationId: string,
    userId: string,
    options: { allowLeft?: boolean } = {},
  ): Promise<ConversationMember & { _id: Types.ObjectId }> {
    const membership = isValidObjectId(conversationId)
      ? await this.members.findOne({ conversationId, userId }).lean()
      : null;

    if (!membership) {
      throw AppException.notFound('Conversation');
    }

    if (membership.leftAt && !options.allowLeft) {
      throw AppException.forbiddenWith(
        ErrorCode.NotAMember,
        'You are no longer part of this conversation',
      );
    }

    return membership;
  }

  private async assertGroupAdmin(
    conversationId: string,
    actorId: string,
  ): Promise<Conversation & { _id: Types.ObjectId }> {
    const membership = await this.assertMember(conversationId, actorId);
    const conversation = await this.conversations.findById(conversationId).lean();

    if (!conversation || conversation.type !== ConversationType.Group) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'This is not a group');
    }

    if (membership.role === ConversationRole.Member) {
      throw AppException.forbidden('Only group admins can do this');
    }

    return conversation;
  }

  /** En una conversación de dos, un bloqueo la deja en sólo lectura. */
  private async assertCanWriteTo(
    conversation: Conversation & { _id: Types.ObjectId },
    senderId: string,
  ): Promise<void> {
    if (conversation.type !== ConversationType.Direct) {
      return;
    }

    const peer = await this.members
      .findOne({ conversationId: conversation._id, userId: { $ne: senderId } })
      .select('userId')
      .lean();

    if (!peer || (await this.relationships.isBlockedBetween(senderId, String(peer.userId)))) {
      throw AppException.forbiddenWith(ErrorCode.Blocked, 'You cannot write in this conversation');
    }
  }

  /** A un grupo sólo se añade a quien existe, no tiene un bloqueo contigo y admite mensajes tuyos. */
  private async assertCanAdd(actorId: string, userIds: string[]): Promise<void> {
    const existing = await this.users.countDocuments({ _id: { $in: userIds } });

    if (existing !== userIds.length) {
      throw AppException.notFound('User');
    }

    for (const userId of userIds) {
      if (!(await this.relationships.canMessage(actorId, userId))) {
        throw new AppException(
          ErrorCode.NotEnoughRights,
          HttpStatus.FORBIDDEN,
          'Someone in the list does not accept messages from you',
          { memberIds: [userId] },
        );
      }
    }
  }

  private async storeAttachments(
    files: PendingUpload[],
    uploaderId: string,
    durationHintMs: number | undefined,
  ): Promise<Awaited<ReturnType<MediaService['storeUpload']>>[]> {
    const stored: Awaited<ReturnType<MediaService['storeUpload']>>[] = [];

    try {
      for (const [position, file] of files.entries()) {
        stored.push(
          await this.media.storeUpload(file, {
            accept: ['image', 'video', 'audio', 'file'],
            preset: 'chat',
            uploaderId,
            position,
            durationHintMs: files.length === 1 ? durationHintMs : undefined,
            maxDurationMs: 15 * 60 * 1000,
          }),
        );
      }

      return stored;
    } catch (error) {
      await this.media.removeMany(stored.map((item) => item._id));
      throw error;
    }
  }

  private kindOf(attachments: { type: MediaType }[], sharesPost: boolean): MessageKind {
    if (sharesPost) {
      return MessageKind.PostShare;
    }

    if (attachments.length === 0) {
      return MessageKind.Text;
    }

    if (attachments.some((item) => item.type === MediaType.Audio)) {
      return MessageKind.Audio;
    }

    if (attachments.some((item) => item.type === MediaType.File)) {
      return MessageKind.File;
    }

    return attachments.every((item) => item.type === MediaType.Video)
      ? MessageKind.Video
      : MessageKind.Image;
  }

  /** Lo que se actualiza en la conversación y en los contadores con cada mensaje nuevo. */
  private async afterMessage(
    conversationId: string,
    senderId: string,
    messageId: Types.ObjectId,
    preview: string,
    at: Date,
    senderMembershipId: Types.ObjectId,
  ): Promise<void> {
    await Promise.all([
      this.conversations.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessageId: messageId,
            lastMessageAt: at,
            lastPreview: preview.slice(0, PREVIEW_LENGTH),
            lastSenderId: senderId,
          },
        },
      ),
      // Los demás tienen uno más sin leer, y la conversación vuelve a la
      // bandeja si la habían archivado —como en Messenger—.
      this.members.updateMany(
        { conversationId, userId: { $ne: senderId }, leftAt: null },
        { $inc: { unreadCount: 1 }, $set: { archived: false } },
      ),
      // Quien escribe ha leído, como poco, hasta su propio mensaje.
      this.members.updateOne(
        { _id: senderMembershipId },
        {
          $set: {
            lastReadAt: at,
            lastDeliveredAt: at,
            lastReadMessageId: messageId,
            unreadCount: 0,
          },
        },
      ),
    ]);
  }

  private async announceMessage(
    conversationId: string,
    senderId: string,
    message: MessageDto,
  ): Promise<void> {
    const conversation = await this.describe(conversationId, senderId);

    await this.emitToMembers(conversationId, (memberId) => ({
      type: ChatEventType.MessageCreated,
      conversationId,
      message: this.presenter.forViewer(message, memberId),
      conversation: null,
      userId: senderId,
      typing: null,
      at: message.createdAt,
      lastReadMessageId: null,
    }));

    await this.bus.publish(Topic.domain(DomainEvent.MessageCreated), {
      messageId: message.id,
      conversationId,
      senderId,
      memberIds: conversation.members.map((member) => member.user.id),
    });

    await this.pushToOffline(conversationId, senderId, message, conversation.title);
  }

  /** Avisa por push a quien no está conectado y no ha silenciado la conversación. */
  private async pushToOffline(
    conversationId: string,
    senderId: string,
    message: MessageDto,
    groupTitle: string | null,
  ): Promise<void> {
    if (!this.push.enabled) {
      return;
    }

    try {
      const recipients = await this.members
        .find({ conversationId, userId: { $ne: senderId }, leftAt: null, muted: false })
        .select('userId')
        .lean();
      const ids = recipients.map((recipient) => String(recipient.userId));
      const online = await this.presence.onlineAmong(ids);
      const offline = ids.filter((id) => !online.has(id));

      if (offline.length === 0) {
        return;
      }

      const sender = `${message.sender.firstName} ${message.sender.lastName}`.trim();

      await this.push.sendToUsers(offline, {
        title: groupTitle ? `${sender} · ${groupTitle}` : sender,
        body: previewOf(message.kind, message.body),
        data: { type: 'message', conversationId },
        tag: `chat:${conversationId}`,
      });
    } catch (error) {
      this.logger.debug(`No se pudo avisar por push: ${String(error)}`);
    }
  }

  private async systemMessage(
    conversationId: string,
    actorId: string,
    action: SystemMessageAction,
    targetIds: string[],
    value: string | null = null,
  ): Promise<void> {
    const membership = await this.members
      .findOne({ conversationId, userId: actorId })
      .select('_id')
      .lean();
    const now = new Date();

    const created = await this.messages.create({
      conversationId,
      senderId: actorId,
      kind: MessageKind.System,
      system: { action, targetIds, value },
    });

    await this.conversations.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessageId: created._id,
          lastMessageAt: now,
          lastSenderId: actorId,
          lastPreview: '',
        },
      },
    );

    if (membership) {
      await this.members.updateOne(
        { _id: membership._id },
        { $set: { lastReadAt: now, lastReadMessageId: created._id } },
      );
    }

    const message = await this.findMessage(String(created._id), actorId);

    await this.emitToMembers(conversationId, (memberId) => ({
      type: ChatEventType.MessageCreated,
      conversationId,
      message: this.presenter.forViewer(message, memberId),
      conversation: null,
      userId: actorId,
      typing: null,
      at: message.createdAt,
      lastReadMessageId: null,
    }));

    await this.broadcastConversation(conversationId);
  }

  /** Manda a cada participante la conversación tal y como la ve él. */
  private async broadcastConversation(conversationId: string): Promise<void> {
    const members = await this.members
      .find({ conversationId, leftAt: null })
      .select('userId')
      .lean();

    await Promise.all(
      members.map(async (member) => {
        const userId = String(member.userId);
        const conversation = await this.describe(conversationId, userId);

        await this.emitToUsers([userId], {
          type: ChatEventType.ConversationUpdated,
          conversationId,
          message: null,
          conversation,
          userId: null,
          typing: null,
          at: null,
          lastReadMessageId: null,
        });
      }),
    );
  }

  private async emitToMembers(
    conversationId: string,
    build: (memberId: string) => ChatEvent,
    exceptUserId?: string,
  ): Promise<void> {
    const members = await this.members
      .find({
        conversationId,
        leftAt: null,
        ...(exceptUserId ? { userId: { $ne: exceptUserId } } : {}),
      })
      .select('userId')
      .lean();

    await Promise.all(
      members.map((member) => {
        const memberId = String(member.userId);
        const message: UserChannelMessage = { channel: 'chat', event: build(memberId) };

        return this.bus.publish(Topic.user(memberId), message);
      }),
    );
  }

  private async emitToUsers(userIds: string[], event: ChatEvent): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.bus.publish(Topic.user(userId), {
          channel: 'chat',
          event,
        } satisfies UserChannelMessage),
      ),
    );
  }

  private async ownMessage(
    messageId: string,
    userId: string,
  ): Promise<Message & { _id: Types.ObjectId }> {
    if (!isValidObjectId(messageId)) {
      throw AppException.notFound('Message');
    }

    const message = await this.messages.findById(messageId).lean();

    if (!message) {
      throw AppException.notFound('Message');
    }

    if (String(message.senderId) !== userId) {
      throw AppException.forbidden('You can only change your own messages');
    }

    return message;
  }

  private async findMessage(messageId: string, viewerId: string): Promise<MessageDto> {
    const doc = (await this.messages
      .findById(messageId)
      .populate(POPULATE_MESSAGE)
      .lean()) as unknown as LeanMessage | null;

    if (!doc) {
      throw AppException.notFound('Message');
    }

    const conversationId = String(doc.conversationId);
    const members = (await this.loadMembers([doc.conversationId])).get(conversationId) ?? [];
    const [message] = await this.presenter.messages([doc], members, viewerId);

    return message;
  }
}

/** El resumen que se enseña en la bandeja. */
function previewOf(kind: MessageKind, body: string | null): string {
  switch (kind) {
    case MessageKind.Image:
      return body ? `📷 ${body}` : '📷';
    case MessageKind.Video:
      return body ? `🎥 ${body}` : '🎥';
    case MessageKind.Audio:
      return '🎤';
    case MessageKind.File:
      return body ? `📎 ${body}` : '📎';
    case MessageKind.PostShare:
      return body ? `🔗 ${body}` : '🔗';
    case MessageKind.StoryReply:
      return body ?? '';
    default:
      return body ?? '';
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}
