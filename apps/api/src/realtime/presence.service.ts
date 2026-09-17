import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

import type { Model } from '../database/mongoose.js';
import { User, UserPermissions } from '../database/schemas/user.schema.js';
import { EventBusService } from './event-bus.service.js';
import { Topic } from './topics.js';

/** Lo que se anuncia cuando alguien se conecta o se va. */
export interface PresenceChange {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
}

/** Cada cuánto se confirma que una conexión sigue viva. */
const HEARTBEAT_MS = 30_000;
/** Tras cuánto silencio se da por muerta una conexión de otra instancia. */
const STALE_AFTER_MS = HEARTBEAT_MS * 3;

/**
 * Quién está conectado.
 *
 * Se cuentan conexiones, no personas: la misma cuenta puede tener abierta la
 * aplicación en el móvil y en dos pestañas, y sólo deja de estar en línea
 * cuando se cierra la última.
 *
 * Sin Redis la cuenta vive en la memoria del proceso. Con Redis cada conexión
 * se apunta con su hora de caducidad, que la instancia que la sostiene
 * renueva cada medio minuto; si esa instancia muere sin despedirse, sus
 * conexiones caducan solas en lugar de dejar a nadie «en línea» para siempre.
 *
 * Quien ha desactivado el estado en línea en su privacidad no se anuncia
 * nunca y siempre figura desconectado.
 */
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly instanceId = randomUUID();
  private readonly redis?: Redis;
  /** Conexiones de este proceso, por persona. */
  private readonly local = new Map<string, Set<string>>();
  private readonly heartbeat?: NodeJS.Timeout;

  constructor(
    config: ConfigService,
    private readonly bus: EventBusService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
  ) {
    const url = config.get<string>('redis.url');

    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 3 });
      this.redis.on('error', (error: Error) => this.logger.warn(`Redis: ${error.message}`));
      this.heartbeat = setInterval(() => void this.renewLocal(), HEARTBEAT_MS);
      this.heartbeat.unref();
    }
  }

  /** Registra una conexión. Devuelve su identificador, para darla de baja después. */
  async connect(userId: string): Promise<string> {
    const connectionId = `${this.instanceId}:${randomUUID()}`;
    const wasOnline = await this.isOnline(userId);

    const set = this.local.get(userId) ?? new Set<string>();
    set.add(connectionId);
    this.local.set(userId, set);

    if (this.redis) {
      await this.redis.hset(keyOf(userId), connectionId, String(Date.now() + STALE_AFTER_MS));
    }

    if (!wasOnline) {
      await this.announce(userId, true);
    }

    return connectionId;
  }

  async disconnect(userId: string, connectionId: string): Promise<void> {
    const set = this.local.get(userId);
    set?.delete(connectionId);

    if (set?.size === 0) {
      this.local.delete(userId);
    }

    if (this.redis) {
      await this.redis.hdel(keyOf(userId), connectionId).catch(() => 0);
    }

    if (!(await this.isOnline(userId))) {
      const lastSeenAt = new Date();

      await this.users.updateOne({ _id: userId }, { $set: { lastSeenAt } });
      await this.announce(userId, false, lastSeenAt);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    return (await this.onlineAmong([userId])).has(userId);
  }

  /** De esta lista, quiénes están conectados ahora. */
  async onlineAmong(userIds: readonly string[]): Promise<Set<string>> {
    const online = new Set<string>();

    if (!this.redis) {
      for (const userId of userIds) {
        if (this.local.has(userId)) {
          online.add(userId);
        }
      }

      return online;
    }

    const pipeline = this.redis.pipeline();

    for (const userId of userIds) {
      pipeline.hvals(keyOf(userId));
    }

    const results = (await pipeline.exec()) ?? [];
    const now = Date.now();

    results.forEach(([error, values], index) => {
      const userId = userIds[index];

      if (!error && userId && (values as string[]).some((expiry) => Number(expiry) > now)) {
        online.add(userId);
      }
    });

    return online;
  }

  /**
   * Como `onlineAmong`, pero respetando a quien ha pedido no aparecer.
   *
   * Es la que deben usar las respuestas que ve otra persona.
   */
  async visibleOnlineAmong(userIds: readonly string[]): Promise<Set<string>> {
    const online = await this.onlineAmong(userIds);

    if (online.size === 0) {
      return online;
    }

    const hidden = await this.permissions
      .find({ userId: { $in: [...online] }, showOnlineStatus: false })
      .select('userId')
      .lean();

    for (const doc of hidden) {
      online.delete(String(doc.userId));
    }

    return online;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }

    // Al apagar se dan de baja las conexiones propias en lugar de esperar a
    // que caduquen: un despliegue no debe dejar a todo el mundo «en línea»
    // durante minuto y medio.
    if (this.redis) {
      const pipeline = this.redis.pipeline();

      for (const [userId, connections] of this.local) {
        pipeline.hdel(keyOf(userId), ...connections);
      }

      await pipeline.exec().catch(() => undefined);
      await this.redis.quit().catch(() => undefined);
    }
  }

  private async renewLocal(): Promise<void> {
    if (!this.redis || this.local.size === 0) {
      return;
    }

    const expiry = String(Date.now() + STALE_AFTER_MS);
    const pipeline = this.redis.pipeline();

    for (const [userId, connections] of this.local) {
      for (const connectionId of connections) {
        pipeline.hset(keyOf(userId), connectionId, expiry);
      }

      pipeline.pexpire(keyOf(userId), STALE_AFTER_MS * 2);
    }

    await pipeline.exec().catch((error: unknown) => {
      this.logger.warn(`No se pudo renovar la presencia: ${String(error)}`);
    });
  }

  private async announce(userId: string, online: boolean, lastSeenAt?: Date): Promise<void> {
    const permissions = await this.permissions
      .findOne({ userId })
      .select('showOnlineStatus')
      .lean();

    if (permissions?.showOnlineStatus === false) {
      return;
    }

    const change: PresenceChange = {
      userId,
      online,
      lastSeenAt: online ? null : (lastSeenAt ?? new Date()).toISOString(),
    };

    await this.bus.publish(Topic.presence, change);
  }
}

function keyOf(userId: string): string {
  return `presence:${userId}`;
}
