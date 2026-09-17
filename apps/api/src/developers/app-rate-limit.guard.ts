import {
  HttpStatus,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import { AppException, ErrorCode } from '../common/errors.js';
import { requestOf, responseOf } from '../common/execution-context.js';
import type { Model } from '../database/mongoose.js';
import { ApiUsage, OAuthApp } from '../database/schemas/developer.schema.js';

const FLUSH_EVERY_MS = 30_000;
const LIMIT_CACHE_MS = 60_000;

/**
 * Cuánto puede llamar cada aplicación de terceros.
 *
 * Como la Graph API de Facebook, el tope es por aplicación y persona y por
 * hora: una aplicación con muchos usuarios no se come la cuota de otra, y un
 * usuario muy activo no agota la de toda la aplicación. Cada respuesta lleva
 * `X-App-Usage` con el porcentaje gastado, para que la aplicación frene antes
 * de chocar con el límite.
 *
 * Los contadores viven en memoria por instancia; el uso por hora se vuelca a
 * Mongo cada medio minuto para el panel del desarrollador.
 */
@Injectable()
export class AppRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(AppRateLimitGuard.name);
  private readonly counters = new Map<string, number>();
  private readonly pendingUsage = new Map<string, number>();
  private readonly limits = new Map<string, { value: number; at: number }>();
  private readonly flusher: NodeJS.Timeout;
  private currentHour = hourOf(Date.now());

  constructor(
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
    @InjectModel(ApiUsage.name) private readonly usage: Model<ApiUsage>,
    private readonly config: ConfigService,
  ) {
    this.flusher = setInterval(() => void this.flush(), FLUSH_EVERY_MS);
    this.flusher.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flusher);
    await this.flush();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = requestOf(context).user;

    if (!user?.app) {
      return true;
    }

    const now = Date.now();
    const hour = hourOf(now);

    if (hour !== this.currentHour) {
      this.currentHour = hour;
      this.counters.clear();
    }

    const key = `${user.app.id}:${user.id}`;
    const count = (this.counters.get(key) ?? 0) + 1;
    const limit = await this.limitOf(user.app.id);

    this.counters.set(key, count);
    this.pendingUsage.set(user.app.id, (this.pendingUsage.get(user.app.id) ?? 0) + 1);

    const percent = Math.min(100, Math.round((count / limit) * 100));
    responseOf(context)?.setHeader('X-App-Usage', JSON.stringify({ call_count: percent }));

    if (count > limit) {
      const retryAfter = Math.ceil((hour + 3600_000 - now) / 1000);

      throw new AppException(
        ErrorCode.TooManyRequests,
        HttpStatus.TOO_MANY_REQUESTS,
        `App rate limit reached, retry in ${retryAfter}s`,
        { retryAfter: [String(retryAfter)] },
      );
    }

    return true;
  }

  private async limitOf(appId: string): Promise<number> {
    const cached = this.limits.get(appId);

    if (cached && Date.now() - cached.at < LIMIT_CACHE_MS) {
      return cached.value;
    }

    const app = await this.apps.findById(appId).select('rateLimitPerHour').lean();
    const value = app?.rateLimitPerHour ?? this.config.getOrThrow<number>('oauth.rateLimitPerHour');

    this.limits.set(appId, { value, at: Date.now() });

    return value;
  }

  private async flush(): Promise<void> {
    if (this.pendingUsage.size === 0) {
      return;
    }

    const entries = [...this.pendingUsage.entries()];
    const hour = new Date(this.currentHour);

    this.pendingUsage.clear();

    try {
      await this.usage.bulkWrite(
        entries.map(([appId, requests]) => ({
          updateOne: {
            filter: { appId, hour },
            update: { $inc: { requests } },
            upsert: true,
          },
        })),
      );
    } catch (error) {
      this.logger.warn(`No se pudo guardar el uso de la API: ${String(error)}`);
    }
  }
}

function hourOf(timestamp: number): number {
  return Math.floor(timestamp / 3600_000) * 3600_000;
}
