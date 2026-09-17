import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Context } from 'graphql-ws';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

import { AccessTokenVerifierService } from '../../auth/access-token-verifier.service.js';
import type { SessionRevokedEvent } from '../../auth/session/session.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';
import type { RequestWithUser } from '../../common/execution-context.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { PresenceService } from '../../realtime/presence.service.js';
import { Topic } from '../../realtime/topics.js';

/** Lo que se guarda de cada conexión WebSocket entre un aviso y el siguiente. */
export interface ConnectionExtra {
  socket: WebSocket;
  request: IncomingMessage;
  user?: AuthenticatedUser;
  presenceId?: string;
  /** La petición que ven los guards y los decoradores en cada operación. */
  pseudoRequest?: RequestWithUser;
}

export type SubscriptionContext = Context<Record<string, unknown> | undefined, ConnectionExtra>;

/** Código de cierre para una sesión que ya no vale: el cliente debe renovar y reconectar. */
export const CLOSE_UNAUTHORIZED = 4401;

/**
 * Las conexiones WebSocket de las suscripciones.
 *
 * La conexión se autentica una vez, al abrirse, con el token que manda el
 * cliente en `connectionParams`. A partir de ahí cada operación que viaja por
 * ella lleva ese usuario sin volver a comprobar nada, así que hay que cerrarla
 * en cuanto la sesión deje de valer: este servicio recuerda qué sockets
 * pertenecen a qué sesión y los tira cuando el bus anuncia que se cerró, en
 * cualquier instancia.
 */
@Injectable()
export class SubscriptionConnectionsService implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionConnectionsService.name);
  private readonly bySession = new Map<string, Set<WebSocket>>();
  private readonly byGrant = new Map<string, Set<WebSocket>>();
  private readonly unsubscribers: (() => void)[] = [];

  constructor(
    private readonly verifier: AccessTokenVerifierService,
    private readonly presence: PresenceService,
    bus: EventBusService,
  ) {
    this.unsubscribers.push(
      bus.on<SessionRevokedEvent>(Topic.sessionRevoked, (event) => {
        for (const id of event.sessionIds) {
          this.closeAll(this.bySession.get(id), 'Session revoked');
        }
      }),
      bus.on<{ grantIds: string[] }>(Topic.grantRevoked, (event) => {
        for (const id of event.grantIds) {
          this.closeAll(this.byGrant.get(id), 'Access revoked');
        }
      }),
    );
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
  }

  /**
   * Autentica una conexión nueva. Devolver `false` la cierra con 4403.
   *
   * El token se acepta como `authorization: "Bearer …"` —lo habitual con
   * graphql-ws— o como `token` a secas.
   */
  async onConnect(context: SubscriptionContext): Promise<boolean> {
    const params = context.connectionParams ?? {};
    const raw =
      typeof params['authorization'] === 'string'
        ? params['authorization']
        : typeof params['Authorization'] === 'string'
          ? params['Authorization']
          : typeof params['token'] === 'string'
            ? `Bearer ${params['token']}`
            : null;

    const token = raw?.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : null;
    const user = token ? await this.verifier.verify(token) : null;

    if (!user) {
      return false;
    }

    const extra = context.extra;
    const forwarded = extra.request.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
      extra.request.socket.remoteAddress ??
      undefined;

    extra.user = user;
    extra.pseudoRequest = {
      headers: { 'user-agent': extra.request.headers['user-agent'] },
      ip,
      user,
    } as unknown as RequestWithUser;

    this.track(user, extra.socket);

    // Las aplicaciones de terceros no cuentan como «en línea»: que un
    // servidor ajeno esté escuchando no significa que la persona esté aquí.
    if (!user.app) {
      extra.presenceId = await this.presence.connect(user.id);
    }

    return true;
  }

  async onClose(context: SubscriptionContext): Promise<void> {
    const { user, presenceId, socket } = context.extra;

    if (!user) {
      return;
    }

    this.untrack(user, socket);

    if (presenceId) {
      await this.presence.disconnect(user.id, presenceId).catch((error: unknown) => {
        this.logger.warn(`No se pudo dar de baja la presencia de ${user.id}: ${String(error)}`);
      });
    }
  }

  private track(user: AuthenticatedUser, socket: WebSocket): void {
    const key = user.sessionId ?? user.app?.grantId;
    const map = user.sessionId ? this.bySession : this.byGrant;

    if (!key) {
      return;
    }

    const set = map.get(key) ?? new Set<WebSocket>();
    set.add(socket);
    map.set(key, set);
  }

  private untrack(user: AuthenticatedUser, socket: WebSocket): void {
    const key = user.sessionId ?? user.app?.grantId;
    const map = user.sessionId ? this.bySession : this.byGrant;

    if (!key) {
      return;
    }

    const set = map.get(key);
    set?.delete(socket);

    if (set?.size === 0) {
      map.delete(key);
    }
  }

  private closeAll(sockets: Set<WebSocket> | undefined, reason: string): void {
    for (const socket of sockets ?? []) {
      socket.close(CLOSE_UNAUTHORIZED, reason);
    }
  }
}
