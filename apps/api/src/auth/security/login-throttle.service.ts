import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { AppException, ErrorCode } from '../../common/errors.js';
import type { Model } from '../../database/mongoose.js';
import { AuthThrottle } from '../../database/schemas/user.schema.js';

/** Fallos que se toleran antes de empezar a bloquear. */
const FREE_ATTEMPTS = 5;
/** Tras cuánto tiempo sin fallos se olvida la cuenta. */
const RESET_AFTER_MS = 30 * 60 * 1000;
/** Bloqueo máximo. */
const MAX_LOCK_MS = 60 * 60 * 1000;

/**
 * Bloqueo progresivo frente a la fuerza bruta.
 *
 * El límite por IP de `RateLimitGuard` frena a quien prueba desde una sola
 * máquina, pero no a quien reparte los intentos entre cientos de direcciones.
 * Esto cuenta por objetivo —un correo, un reto de segundo factor— y, pasados
 * cinco fallos, bloquea un minuto, luego dos, luego cuatro… hasta una hora.
 *
 * Se aplica igual a un correo que no existe: si sólo se bloquearan las
 * cuentas reales, el bloqueo diría cuáles lo son.
 */
@Injectable()
export class LoginThrottleService {
  constructor(@InjectModel(AuthThrottle.name) private readonly throttles: Model<AuthThrottle>) {}

  /** Falla si la clave está bloqueada ahora mismo. */
  async assertNotLocked(key: string): Promise<void> {
    const doc = await this.throttles.findOne({ key }).select('lockedUntil').lean();

    if (doc?.lockedUntil && doc.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((doc.lockedUntil.getTime() - Date.now()) / 1000);

      throw new AppException(
        ErrorCode.AccountLocked,
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many failed attempts, retry in ${retryAfter}s`,
        { retryAfter: [String(retryAfter)] },
      );
    }
  }

  async registerFailure(key: string): Promise<void> {
    const now = new Date();
    const doc = await this.throttles.findOneAndUpdate(
      { key },
      { $inc: { failures: 1 }, $set: { expiresAt: new Date(now.getTime() + RESET_AFTER_MS) } },
      { upsert: true, returnDocument: 'after' },
    );

    const excess = doc.failures - FREE_ATTEMPTS;

    if (excess > 0) {
      const lockMs = Math.min(MAX_LOCK_MS, 60_000 * 2 ** (excess - 1));

      await this.throttles.updateOne(
        { key },
        {
          $set: {
            lockedUntil: new Date(now.getTime() + lockMs),
            expiresAt: new Date(now.getTime() + lockMs + RESET_AFTER_MS),
          },
        },
      );
    }
  }

  async reset(key: string): Promise<void> {
    await this.throttles.deleteOne({ key });
  }
}
