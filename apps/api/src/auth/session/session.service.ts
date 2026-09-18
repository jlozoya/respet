import { HttpStatus, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { DeviceSession } from '@social-network/shared';

import type { ClientInfo } from '../../common/decorators/index.js';
import { AppException, ErrorCode } from '../../common/errors.js';
import { toIso } from '../../common/mappers.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../../database/mongoose.js';
import {
  SecurityEventType,
  SessionEndReason,
  type AuthMethod,
} from '../../database/schemas/enums.js';
import { Session } from '../../database/schemas/user.schema.js';
import { EventBusService } from '../../realtime/event-bus.service.js';
import { Topic } from '../../realtime/topics.js';
import { CryptoService } from '../crypto.service.js';
import { SecurityEventsService } from '../security/security-events.service.js';
import { parseUserAgent } from './device.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Margen en el que un refresh token recién canjeado todavía se reconoce sin
 * dar la alarma.
 *
 * Dos pestañas pueden pedir la renovación a la vez con el mismo token; la
 * segunda llega cuando el servidor ya lo ha rotado. No es un robo: se le pide
 * que reintente con el token que la primera acaba de guardar.
 */
const RACE_GRACE_MS = 30_000;

/** Cuántos tokens usados se recuerdan por sesión para detectar reutilizaciones. */
const RETIRED_HISTORY = 10;

/** Cada cuánto se apunta la última actividad de una sesión, como mucho. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

/** Cuánto se fía la caché de que una sesión sigue abierta. */
const CACHE_TTL_MS = 30_000;

export interface SessionRevokedEvent {
  sessionIds: string[];
  userId: string;
  reason: SessionEndReason;
}

/** Lo que resulta de abrir o renovar una sesión. */
export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  userId: string;
}

interface CachedSession {
  active: boolean;
  userId: string;
  checkedAt: number;
  lastUsedAt: number;
}

/**
 * Sesiones por dispositivo.
 *
 * El refresh token es opaco —`<id de sesión>.<secreto>`— y no un JWT: no hay
 * nada que leer dentro, sólo algo que comparar. El identificador delante
 * permite encontrar la sesión aunque el secreto ya no sea el vigente, que es
 * justo lo que hace falta para detectar un token reutilizado y cerrar esa
 * sesión concreta en lugar de todas las de la persona.
 *
 * El access token lleva el id de la sesión, y cada petición comprueba que
 * siga abierta. Cerrar sesión surte efecto en el acto, no cuando caduque el
 * token un cuarto de hora después. La comprobación se cachea medio minuto por
 * instancia; cerrar una sesión vacía esa caché en todas a través del bus.
 */
@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private readonly cache = new Map<string, CachedSession>();
  private readonly unsubscribe: () => void;

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    private readonly crypto: CryptoService,
    private readonly events: SecurityEventsService,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
  ) {
    this.unsubscribe = this.bus.on<SessionRevokedEvent>(Topic.sessionRevoked, (event) => {
      for (const id of event.sessionIds) {
        this.cache.delete(id);
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe();
  }

  async create(
    userId: string,
    authMethods: AuthMethod[],
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const id = new ObjectId();
    const refreshToken = this.composeToken(id);
    const now = new Date();

    await this.sessions.create({
      _id: id,
      userId,
      refreshTokenHash: this.crypto.hashToken(refreshToken),
      lastUsedAt: now,
      idleExpiresAt: this.idleExpiry(now, this.absoluteExpiry(now)),
      expiresAt: this.absoluteExpiry(now),
      authMethods: [...new Set(authMethods)],
      device: parseUserAgent(client.userAgent),
      userAgent: client.userAgent,
      ip: client.ip,
    });

    return { sessionId: String(id), refreshToken, userId };
  }

  /**
   * Canjea un refresh token por otro.
   *
   * @throws AppException si el token no vale. Si era uno ya canjeado —y no
   * por una carrera entre pestañas— la sesión queda cerrada.
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedSession> {
    const sessionId = refreshToken.split('.')[0] ?? '';

    if (!isValidObjectId(sessionId)) {
      throw AppException.badToken('Refresh token not recognised');
    }

    const session = await this.sessions.findById(sessionId).lean();

    if (!session) {
      throw AppException.badToken('Refresh token not recognised');
    }

    const hash = this.crypto.hashToken(refreshToken);
    const now = new Date();

    if (session.revokedAt) {
      throw new AppException(
        ErrorCode.SessionRevoked,
        HttpStatus.UNAUTHORIZED,
        'This session was closed',
      );
    }

    if (session.expiresAt <= now || session.idleExpiresAt <= now) {
      await this.revoke(sessionId, SessionEndReason.Expired);
      throw AppException.badToken('Refresh token has expired');
    }

    if (!this.crypto.safeEqual(hash, session.refreshTokenHash)) {
      if (session.retiredTokenHashes.includes(hash)) {
        const rotatedRecently =
          session.retiredTokenHashes.at(-1) === hash &&
          session.rotatedAt !== null &&
          now.getTime() - session.rotatedAt.getTime() < RACE_GRACE_MS;

        if (rotatedRecently) {
          throw new AppException(
            ErrorCode.RefreshRace,
            HttpStatus.CONFLICT,
            'The refresh token was just rotated; retry with the latest one',
          );
        }

        // Un token ya canjeado que vuelve a aparecer sólo se explica si alguien
        // lo ha copiado. Se cierra esta sesión: quien lo robó pierde el acceso
        // y el dueño tendrá que volver a entrar en ese dispositivo.
        await this.revoke(sessionId, SessionEndReason.ReuseDetected);
        await this.events.record(String(session.userId), SecurityEventType.RefreshReuseDetected, client, {
          device: session.device?.name,
        });

        throw new AppException(
          ErrorCode.SessionRevoked,
          HttpStatus.UNAUTHORIZED,
          'Refresh token was already used; the session was closed',
        );
      }

      throw AppException.badToken('Refresh token not recognised');
    }

    const nextToken = this.composeToken(session._id);

    const updated = await this.sessions.updateOne(
      // La condición sobre el hash vigente hace la rotación atómica: si dos
      // peticiones llegan a la vez, sólo una la consigue.
      { _id: session._id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
      {
        $set: {
          refreshTokenHash: this.crypto.hashToken(nextToken),
          rotatedAt: now,
          lastUsedAt: now,
          idleExpiresAt: this.idleExpiry(now, session.expiresAt),
          ip: client.ip,
          userAgent: client.userAgent,
        },
        $push: { retiredTokenHashes: { $each: [hash], $slice: -RETIRED_HISTORY } },
      },
    );

    if (updated.modifiedCount === 0) {
      throw new AppException(
        ErrorCode.RefreshRace,
        HttpStatus.CONFLICT,
        'The refresh token was just rotated; retry with the latest one',
      );
    }

    this.cache.delete(sessionId);

    return { sessionId, refreshToken: nextToken, userId: String(session.userId) };
  }

  /**
   * Comprueba que la sesión sigue abierta, de paso que apunta la actividad.
   *
   * Lo llama cada petición autenticada, así que se cachea.
   */
  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.cache.get(sessionId);

    if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
      this.touch(sessionId, cached, now);

      return cached.active && cached.userId === userId;
    }

    if (!isValidObjectId(sessionId)) {
      return false;
    }

    const session = await this.sessions
      .findById(sessionId)
      .select('userId revokedAt expiresAt idleExpiresAt lastUsedAt')
      .lean();

    const active =
      session !== null &&
      session.revokedAt === null &&
      session.expiresAt.getTime() > now &&
      session.idleExpiresAt.getTime() > now;

    const entry: CachedSession = {
      active,
      userId: session ? String(session.userId) : '',
      checkedAt: now,
      lastUsedAt: session?.lastUsedAt.getTime() ?? now,
    };

    this.cache.set(sessionId, entry);
    this.sweepCache(now);
    this.touch(sessionId, entry, now);

    return active && entry.userId === userId;
  }

  async listForUser(userId: string, currentSessionId: string | null): Promise<DeviceSession[]> {
    const now = new Date();
    const docs = await this.sessions
      .find({ userId, revokedAt: null, expiresAt: { $gt: now }, idleExpiresAt: { $gt: now } })
      .sort({ lastUsedAt: -1 })
      .lean();

    return docs
      .map((doc) => ({
        id: String(doc._id),
        device: doc.device ?? parseUserAgent(null),
        ip: doc.ip,
        authMethods: doc.authMethods,
        current: String(doc._id) === currentSessionId,
        createdAt: toIso(doc.createdAt),
        lastUsedAt: toIso(doc.lastUsedAt),
        expiresAt: toIso(doc.idleExpiresAt < doc.expiresAt ? doc.idleExpiresAt : doc.expiresAt),
        revokedAt: toIso(doc.revokedAt),
        revokedReason: doc.revokedReason,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  async findOwned(sessionId: string, userId: string): Promise<(Session & { _id: Types.ObjectId }) | null> {
    if (!isValidObjectId(sessionId)) {
      return null;
    }

    return this.sessions.findOne({ _id: sessionId, userId }).lean();
  }

  /** Cierra una sesión. No falla si ya estaba cerrada. */
  async revoke(sessionId: string, reason: SessionEndReason): Promise<void> {
    const session = await this.sessions
      .findOneAndUpdate(
        { _id: sessionId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: reason } },
      )
      .select('userId')
      .lean();

    if (session) {
      await this.announce([sessionId], String(session.userId), reason);
    }
  }

  /**
   * Cierra todas las sesiones de alguien, salvo la indicada.
   *
   * Es lo que pasa al cambiar la contraseña: quien la cambió sigue dentro y
   * cualquier otro que la conociera queda fuera.
   */
  async revokeAllForUser(
    userId: string,
    reason: SessionEndReason,
    exceptSessionId: string | null = null,
  ): Promise<number> {
    const filter = {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { _id: { $ne: new ObjectId(exceptSessionId) } } : {}),
    };

    const ids = (await this.sessions.find(filter).select('_id').lean()).map((doc) => String(doc._id));

    if (ids.length === 0) {
      return 0;
    }

    await this.sessions.updateMany(
      { _id: { $in: ids }, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );

    await this.announce(ids, userId, reason);

    return ids.length;
  }

  /** Cuándo empezó la sesión, para decidir si una operación delicada exige volver a identificarse. */
  async startedAt(sessionId: string): Promise<Date | null> {
    const doc = await this.sessions.findById(sessionId).select('createdAt').lean();

    return doc?.createdAt ?? null;
  }

  /** Si esta persona ya había entrado antes desde un dispositivo parecido. */
  async isKnownDevice(userId: string, userAgent: string | null, exceptSessionId: string): Promise<boolean> {
    const device = parseUserAgent(userAgent);

    const match = await this.sessions.exists({
      userId,
      _id: { $ne: new ObjectId(exceptSessionId) },
      'device.name': device.name,
      createdAt: { $gt: new Date(Date.now() - 180 * DAY_MS) },
    });

    return match !== null;
  }

  private async announce(sessionIds: string[], userId: string, reason: SessionEndReason): Promise<void> {
    for (const id of sessionIds) {
      this.cache.delete(id);
    }

    const event: SessionRevokedEvent = { sessionIds, userId, reason };

    await this.bus.publish(Topic.sessionRevoked, event);
  }

  private touch(sessionId: string, entry: CachedSession, now: number): void {
    if (!entry.active || now - entry.lastUsedAt < TOUCH_EVERY_MS) {
      return;
    }

    entry.lastUsedAt = now;

    void this.sessions
      .updateOne({ _id: sessionId, revokedAt: null }, { $set: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) => {
        this.logger.debug(`No se pudo apuntar la actividad de ${sessionId}: ${String(error)}`);
      });
  }

  private sweepCache(now: number): void {
    if (this.cache.size < 10_000) {
      return;
    }

    for (const [id, entry] of this.cache) {
      if (now - entry.checkedAt > CACHE_TTL_MS) {
        this.cache.delete(id);
      }
    }
  }

  private composeToken(sessionId: Types.ObjectId | string): string {
    return `${String(sessionId)}.${this.crypto.randomToken(32)}`;
  }

  private absoluteExpiry(from: Date): Date {
    return new Date(from.getTime() + this.config.getOrThrow<number>('session.absoluteTtlDays') * DAY_MS);
  }

  private idleExpiry(from: Date, absolute: Date): Date {
    const idle = new Date(from.getTime() + this.config.getOrThrow<number>('session.idleTtlDays') * DAY_MS);

    return idle < absolute ? idle : absolute;
  }
}
