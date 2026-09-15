import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Conversation as ConversationDto, Message as MessageDto, MessagePage } from '@respet/shared';
import { ObjectId, isValidObjectId } from '../database/mongoose.js';
import type { Model, Types } from '../database/mongoose.js';

import { AppException, ErrorCode } from '../common/errors.js';
import { toMediaOrNull, toUserSummary } from '../common/mappers.js';
import { Conversation, ConversationMember, Message } from '../database/schemas/chat.schema.js';
import { MessageKind } from '../database/schemas/enums.js';
import { User } from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';

/** Mensajes que devuelve cada tramo del hilo. */
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/** Longitud del resumen que se guarda en la conversación para la lista. */
const PREVIEW_LENGTH = 160;

/** Relaciones que hacen falta para pintar un mensaje entero. */
const POBLAR_MENSAJE = [
  { path: 'sender', populate: { path: 'avatar' } },
  { path: 'media' },
];

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    @InjectModel(ConversationMember.name) private readonly members: Model<ConversationMember>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly media: MediaService,
  ) {}

  /**
   * Conversaciones del usuario, de la más reciente a la más antigua.
   *
   * El número de no leídos se cuenta contra `lastReadAt` del participante, en
   * lugar de guardar un documento por mensaje y persona.
   */
  async listConversations(userId: string): Promise<ConversationDto[]> {
    const membresias = await this.members.find({ userId }).lean();

    if (membresias.length === 0) {
      return [];
    }

    const ids = membresias.map((membresia) => membresia.conversationId);

    const [conversaciones, otros, sinLeer] = await Promise.all([
      this.conversations.find({ _id: { $in: ids } }).sort({ lastMessageAt: -1 }).lean(),
      this.peersOf(ids, userId),
      this.countUnreadByConversation(userId),
    ]);

    const porConversacion = new Map(
      membresias.map((membresia) => [String(membresia.conversationId), membresia]),
    );

    return (
      conversaciones
        // Una conversación cuyo otro participante borró su cuenta se queda sin
        // interlocutor; se omite en lugar de pintar una fila vacía.
        .filter((conversacion) => otros.has(String(conversacion._id)))
        .map((conversacion) => {
          const id = String(conversacion._id);

          return {
            id,
            peer: toUserSummary(otros.get(id) as never),
            lastMessageAt: conversacion.lastMessageAt?.toISOString() ?? null,
            lastPreview: conversacion.lastPreview,
            unreadCount: sinLeer.get(id) ?? 0,
            muted: porConversacion.get(id)?.muted ?? false,
          };
        })
    );
  }

  /** Total de mensajes sin leer, para el distintivo del menú. */
  async countUnread(userId: string): Promise<number> {
    const counts = await this.countUnreadByConversation(userId);
    let total = 0;

    for (const value of counts.values()) {
      total += value;
    }

    return total;
  }

  /**
   * Devuelve la conversación con otra persona, creándola si aún no existe.
   *
   * Es idempotente: pulsar «enviar mensaje» dos veces no abre dos hilos.
   */
  async startConversation(userId: string, peerId: string): Promise<ConversationDto> {
    if (userId === peerId) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'You cannot start a conversation with yourself',
      );
    }

    if (!isValidObjectId(peerId)) {
      throw AppException.notFound('User');
    }

    const peer = await this.users.findById(peerId).populate('avatar').lean();

    if (!peer) {
      throw AppException.notFound('User');
    }

    const existente = await this.findDirectConversation(userId, peerId);

    if (existente) {
      return this.describeConversation(existente, userId, peer);
    }

    const creada = await this.conversations.create({});

    await this.members.insertMany([
      { conversationId: creada._id, userId },
      { conversationId: creada._id, userId: peerId },
    ]);

    return {
      id: String(creada._id),
      peer: toUserSummary(peer),
      lastMessageAt: null,
      lastPreview: null,
      unreadCount: 0,
      muted: false,
    };
  }

  /**
   * Tramo del hilo, del más reciente hacia atrás.
   *
   * Se pagina por cursor y no por número de página: un hilo crece por arriba
   * mientras se lee, y con páginas numeradas los mensajes se repetirían o se
   * saltarían en cuanto llegara uno nuevo. El cursor es el identificador del
   * último mensaje devuelto, que en Mongo crece con el tiempo igual que lo
   * hacía el autoincremental.
   */
  async listMessages(
    conversationId: string,
    userId: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<MessagePage> {
    await this.assertMember(conversationId, userId);

    const take = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE));

    const docs = await this.messages
      .find({
        conversationId,
        ...(options.before && isValidObjectId(options.before)
          ? { _id: { $lt: new ObjectId(options.before) } }
          : {}),
      })
      .sort({ _id: -1 })
      // Se pide uno de más para saber si queda algo por delante sin lanzar una
      // segunda consulta de conteo.
      .limit(take + 1)
      .populate(POBLAR_MENSAJE)
      .lean();

    const hasMore = docs.length > take;
    const page = hasMore ? docs.slice(0, take) : docs;

    return {
      // El hilo se pinta de arriba abajo, así que se devuelve en orden natural.
      data: page.map((doc) => toMessage(doc as never)).reverse(),
      nextCursor: hasMore ? (page.at(-1) ? String(page.at(-1)!._id) : null) : null,
    };
  }

  async sendText(conversationId: string, userId: string, body: string): Promise<MessageDto> {
    await this.assertMember(conversationId, userId);

    const trimmed = body.trim();

    if (!trimmed) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The message is empty');
    }

    const creado = await this.messages.create({
      conversationId,
      senderId: userId,
      kind: MessageKind.Text,
      body: trimmed,
    });

    await this.touchConversation(conversationId, trimmed);

    return this.findMessageOrFail(String(creado._id));
  }

  async sendImage(
    conversationId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<MessageDto> {
    await this.assertMember(conversationId, userId);

    const created = await this.media.createFromUpload(file, 'post', { alt: 'chat' });

    const creado = await this.messages.create({
      conversationId,
      senderId: userId,
      kind: MessageKind.Image,
      mediaId: created.id,
    });

    await this.touchConversation(conversationId, '📷');

    return this.findMessageOrFail(String(creado._id));
  }

  /**
   * Retira un mensaje.
   *
   * No se borra el documento: dejaría un hueco en el hilo de la otra persona.
   * Se marca como eliminado y se vacía el contenido, que es lo que de verdad
   * interesa que desaparezca.
   */
  async deleteMessage(messageId: string, userId: string): Promise<MessageDto> {
    if (!isValidObjectId(messageId)) {
      throw AppException.notFound('Message');
    }

    const message = await this.messages
      .findById(messageId)
      .select('senderId mediaId conversationId')
      .lean();

    if (!message) {
      throw AppException.notFound('Message');
    }

    if (String(message.senderId) !== userId) {
      throw AppException.forbidden('You can only delete your own messages');
    }

    await this.messages.updateOne(
      { _id: messageId },
      { $set: { deletedAt: new Date(), body: null, mediaId: null } },
    );

    if (message.mediaId) {
      await this.media.remove(String(message.mediaId));
    }

    return this.findMessageOrFail(messageId);
  }

  /** Marca como leído hasta ahora y devuelve el instante registrado. */
  async markRead(conversationId: string, userId: string): Promise<string> {
    await this.assertMember(conversationId, userId);

    const readAt = new Date();

    await this.members.updateOne({ conversationId, userId }, { $set: { lastReadAt: readAt } });

    return readAt.toISOString();
  }

  async setMuted(conversationId: string, userId: string, muted: boolean): Promise<void> {
    await this.assertMember(conversationId, userId);

    await this.members.updateOne({ conversationId, userId }, { $set: { muted } });
  }

  /** Identificadores del resto de participantes, para dirigirles los eventos. */
  async peerIdsOf(conversationId: string, exceptUserId: string): Promise<string[]> {
    const docs = await this.members
      .find({ conversationId, userId: { $ne: exceptUserId } })
      .select('userId')
      .lean();

    return docs.map((doc) => String(doc.userId));
  }

  /** Comprueba que el usuario participa en la conversación. */
  async assertMember(conversationId: string, userId: string): Promise<void> {
    const participa =
      isValidObjectId(conversationId) &&
      (await this.members.exists({ conversationId, userId })) !== null;

    if (!participa) {
      // Se responde «no encontrada» en lugar de «prohibida»: confirmar que la
      // conversación existe ya diría más de la cuenta a quien va probando
      // identificadores.
      throw AppException.notFound('Conversation');
    }
  }

  async findConversation(conversationId: string, userId: string): Promise<ConversationDto> {
    await this.assertMember(conversationId, userId);

    const conversacion = await this.conversations.findById(conversationId).lean();

    if (!conversacion) {
      throw AppException.notFound('Conversation');
    }

    const otros = await this.peersOf([conversacion._id], userId);
    const peer = otros.get(String(conversacion._id));

    if (!peer) {
      throw AppException.notFound('Conversation');
    }

    return this.describeConversation(conversacion, userId, peer);
  }

  private async describeConversation(
    conversacion: { _id: unknown; lastMessageAt: Date | null; lastPreview: string | null },
    userId: string,
    peer: unknown,
  ): Promise<ConversationDto> {
    const id = String(conversacion._id);

    const [membresia, sinLeer] = await Promise.all([
      this.members.findOne({ conversationId: id, userId }).select('muted').lean(),
      this.countUnreadByConversation(userId),
    ]);

    return {
      id,
      peer: toUserSummary(peer as never),
      lastMessageAt: conversacion.lastMessageAt?.toISOString() ?? null,
      lastPreview: conversacion.lastPreview,
      unreadCount: sinLeer.get(id) ?? 0,
      muted: membresia?.muted ?? false,
    };
  }

  /**
   * El otro participante de cada conversación.
   *
   * Una sola consulta para todas, en lugar de una por hilo: con veinte
   * conversaciones abiertas, lo segundo serían veinte viajes a la base.
   */
  private async peersOf(
    conversationIds: Types.ObjectId[],
    userId: string,
  ): Promise<Map<string, unknown>> {
    const otros = await this.members
      .find({ conversationId: { $in: conversationIds }, userId: { $ne: userId } })
      .populate({ path: 'user', populate: { path: 'avatar' } })
      .lean();

    const mapa = new Map<string, unknown>();

    for (const miembro of otros) {
      const persona = (miembro as { user?: unknown }).user;

      if (persona) {
        mapa.set(String(miembro.conversationId), persona);
      }
    }

    return mapa;
  }

  /**
   * Mensajes sin leer por conversación.
   *
   * Se resuelve con una agregación en lugar de una consulta por conversación:
   * con veinte hilos abiertos, lo segundo serían veinte viajes a la base.
   */
  private async countUnreadByConversation(userId: string): Promise<Map<string, number>> {
    const membresias = await this.members
      .find({ userId })
      .select('conversationId lastReadAt')
      .lean();

    if (membresias.length === 0) {
      return new Map();
    }

    const filas = await this.messages.aggregate<{ _id: Types.ObjectId; total: number }>([
      {
        $match: {
          senderId: { $ne: new ObjectId(userId) },
          deletedAt: null,
          $or: membresias.map((membresia) => ({
            conversationId: membresia.conversationId,
            ...(membresia.lastReadAt ? { createdAt: { $gt: membresia.lastReadAt } } : {}),
          })),
        },
      },
      { $group: { _id: '$conversationId', total: { $sum: 1 } } },
    ]);

    return new Map(filas.map((fila) => [String(fila._id), fila.total]));
  }

  /**
   * La conversación directa entre dos personas, si existe.
   *
   * Sin uniones, se busca por el otro lado: las conversaciones en las que está
   * cada uno, y la que aparece en ambas listas.
   */
  private async findDirectConversation(
    userId: string,
    peerId: string,
  ): Promise<{ _id: unknown; lastMessageAt: Date | null; lastPreview: string | null } | null> {
    const [mias, suyas] = await Promise.all([
      this.members.find({ userId }).select('conversationId').lean(),
      this.members.find({ userId: peerId }).select('conversationId').lean(),
    ]);

    const suyasSet = new Set(suyas.map((doc) => String(doc.conversationId)));
    const comun = mias.find((doc) => suyasSet.has(String(doc.conversationId)));

    if (!comun) {
      return null;
    }

    return this.conversations.findById(comun.conversationId).lean();
  }

  /** Actualiza el resumen que la lista de conversaciones muestra. */
  private async touchConversation(conversationId: string, preview: string): Promise<void> {
    await this.conversations.updateOne(
      { _id: conversationId },
      { $set: { lastMessageAt: new Date(), lastPreview: preview.slice(0, PREVIEW_LENGTH) } },
    );
  }

  private async findMessageOrFail(messageId: string): Promise<MessageDto> {
    const doc = await this.messages.findById(messageId).populate(POBLAR_MENSAJE).lean();

    if (!doc) {
      throw AppException.notFound('Message');
    }

    return toMessage(doc as never);
  }
}

function toMessage(doc: {
  _id: unknown;
  conversationId: unknown;
  kind: MessageKind;
  body: string | null;
  media?: unknown;
  sender?: unknown;
  deletedAt: Date | null;
  createdAt: Date;
}): MessageDto {
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    kind: doc.kind,
    body: doc.body,
    media: toMediaOrNull((doc.media ?? null) as never),
    sender: toUserSummary(doc.sender as never),
    deleted: doc.deletedAt !== null,
    createdAt: doc.createdAt.toISOString(),
  };
}
