import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  ChatClientEvent,
  ChatServerEvent,
  type AccessTokenPayload,
  type Conversation,
  type Message,
  type PresencePayload,
  type ReadPayload,
  type TypingPayload,
} from '@respet/shared';
import type { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service.js';

/** Sala privada de cada usuario, donde recibe lo que le concierne. */
const userRoom = (userId: string): string => `user:${userId}`;
/** Sala de una conversación, para los eventos efímeros como «escribiendo». */
const conversationRoom = (conversationId: string): string => `conversation:${conversationId}`;

interface AuthenticatedSocket extends Socket {
  data: { userId?: string };
}

/**
 * Canal en tiempo real del chat.
 *
 * Cada conexión se autentica con el mismo access token que la API REST y se
 * mete en una sala propia, `user:<id>`. Los mensajes se emiten a esas salas y
 * no a sockets sueltos, de modo que quien tenga la aplicación abierta en el
 * móvil y en el navegador los recibe en ambos sitios.
 *
 * Los eventos son avisos, no la fuente de la verdad: el mensaje se guarda por
 * REST y sólo después se difunde. Si el socket está caído, al recargar el hilo
 * está todo.
 */
// El CORS lo fija `ConfiguredIoAdapter` a partir de la configuración, ya que
// el decorador sólo admite valores literales.
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /**
   * Conexiones abiertas por usuario.
   *
   * Se cuentan porque la misma persona puede tener varias pestañas: sólo se
   * anuncia que se ha desconectado cuando se cierra la última.
   */
  private readonly connections = new Map<string, number>();

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const userId = await this.authenticate(client);

    if (!userId) {
      // Sin identidad no hay a qué sala meterlo, así que se cierra en lugar de
      // dejar una conexión anónima consumiendo recursos.
      client.disconnect(true);

      return;
    }

    client.data.userId = userId;
    await client.join(userRoom(userId));

    const previous = this.connections.get(userId) ?? 0;
    this.connections.set(userId, previous + 1);

    if (previous === 0) {
      this.broadcastPresence(userId, true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data.userId;

    if (!userId) {
      return;
    }

    const remaining = (this.connections.get(userId) ?? 1) - 1;

    if (remaining > 0) {
      this.connections.set(userId, remaining);

      return;
    }

    this.connections.delete(userId);
    this.broadcastPresence(userId, false);
  }

  /** Entra en la sala de una conversación para recibir sus eventos efímeros. */
  @SubscribeMessage(ChatClientEvent.Join)
  async onJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const userId = client.data.userId;

    if (!userId || !Number.isInteger(payload?.conversationId)) {
      return;
    }

    try {
      // Se comprueba la pertenencia también aquí: sin esto, cualquiera podría
      // entrar en la sala de una conversación ajena y leer quién escribe.
      await this.chat.assertMember(payload.conversationId, userId);
      await client.join(conversationRoom(payload.conversationId));
    } catch {
      this.logger.warn(`El usuario ${userId} intentó entrar en una conversación ajena`);
    }
  }

  @SubscribeMessage(ChatClientEvent.Leave)
  async onLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    if (Number.isInteger(payload?.conversationId)) {
      await client.leave(conversationRoom(payload.conversationId));
    }
  }

  /**
   * Reenvía el indicador de «escribiendo…».
   *
   * No se guarda en ninguna parte: si el aviso se pierde, el indicador
   * simplemente no aparece, que es preferible a persistir un estado efímero.
   */
  @SubscribeMessage(ChatClientEvent.Typing)
  onTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string; typing: boolean },
  ): void {
    const userId = client.data.userId;

    if (!userId || !Number.isInteger(payload?.conversationId)) {
      return;
    }

    const event: TypingPayload = {
      conversationId: payload.conversationId,
      userId,
      typing: payload.typing === true,
    };

    // `client.to(...)` excluye al propio emisor, que no necesita verse a sí
    // mismo escribiendo.
    client.to(conversationRoom(payload.conversationId)).emit(ChatServerEvent.Typing, event);
  }

  // --- Difusión desde el servicio ------------------------------------------

  /** Anuncia un mensaje nuevo a los demás participantes. */
  async emitMessage(message: Message, senderId: string): Promise<void> {
    const peerIds = await this.chat.peerIdsOf(message.conversationId, senderId);

    for (const peerId of peerIds) {
      this.server.to(userRoom(peerId)).emit(ChatServerEvent.MessageCreated, message);
    }
  }

  async emitMessageDeleted(message: Message, senderId: string): Promise<void> {
    const peerIds = await this.chat.peerIdsOf(message.conversationId, senderId);

    for (const peerId of peerIds) {
      this.server.to(userRoom(peerId)).emit(ChatServerEvent.MessageDeleted, message);
    }
  }

  async emitRead(conversationId: string, userId: string, readAt: string): Promise<void> {
    const peerIds = await this.chat.peerIdsOf(conversationId, userId);
    const event: ReadPayload = { conversationId, userId, readAt };

    for (const peerId of peerIds) {
      this.server.to(userRoom(peerId)).emit(ChatServerEvent.Read, event);
    }
  }

  /** Avisa de una conversación nueva para que aparezca sin recargar. */
  emitConversation(conversation: Conversation, toUserId: string): void {
    this.server.to(userRoom(toUserId)).emit(ChatServerEvent.ConversationUpdated, conversation);
  }

  /**
   * Comprueba el token de la conexión.
   *
   * Se acepta en `auth.token` —lo natural en Socket.IO— y también en la
   * cabecera `Authorization`, para que el mismo cliente sirva donde el
   * transporte sea long-polling.
   */
  private async authenticate(client: Socket): Promise<string | null> {
    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    const header = client.handshake.headers.authorization;
    const token =
      typeof fromAuth === 'string' && fromAuth
        ? fromAuth
        : header?.startsWith('Bearer ')
          ? header.slice('Bearer '.length)
          : null;

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });

      return payload.sub;
    } catch {
      return null;
    }
  }

  private broadcastPresence(userId: string, online: boolean): void {
    const event: PresencePayload = {
      userId,
      online,
      lastSeenAt: online ? null : new Date().toISOString(),
    };

    // La presencia se difunde a todo el espacio de nombres: sólo dice si
    // alguien está conectado, que es lo que ya se ve en cualquier hilo abierto.
    this.server.emit(ChatServerEvent.Presence, event);
  }
}
