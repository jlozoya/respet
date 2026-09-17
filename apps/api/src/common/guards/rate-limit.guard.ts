import { Injectable, type CanActivate, type ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/index.js';
import { AppException, ErrorCode } from '../errors.js';
import { requestOf, responseOf } from '../execution-context.js';

interface Counter {
  hits: number;
  resetAt: number;
}

/**
 * Limitador de peticiones por ventana fija, en memoria.
 *
 * Sólo actúa sobre las rutas marcadas con `@RateLimit()` —registro, inicio de
 * sesión, recuperación de contraseña y formulario de contacto—, que son las
 * que interesa proteger de fuerza bruta y de spam.
 *
 * El contador vive en el proceso: con varias instancias detrás de un balanceador
 * el límite efectivo se multiplica por el número de instancias. Para este
 * tamaño de proyecto es una contrapartida razonable frente a montar Redis;
 * si algún día hace falta precisión, basta sustituir el `Map` por un contador
 * compartido sin tocar los controladores.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, Counter>();
  private lastSweep = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = requestOf(context);
    const response = responseOf(context);
    const now = Date.now();

    this.sweep(now);

    const key = `${context.getClass().name}.${context.getHandler().name}:${clientIp(request)}`;
    const windowMs = options.windowSeconds * 1000;
    const current = this.counters.get(key);

    if (!current || current.resetAt <= now) {
      this.counters.set(key, { hits: 1, resetAt: now + windowMs });
      this.setHeaders(response, options.limit, options.limit - 1, now + windowMs);

      return true;
    }

    current.hits += 1;

    if (current.hits > options.limit) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      response?.setHeader('Retry-After', retryAfter);
      this.setHeaders(response, options.limit, 0, current.resetAt);

      throw new AppException(
        ErrorCode.TooManyRequests,
        HttpStatus.TOO_MANY_REQUESTS,
        `Rate limit exceeded, retry in ${retryAfter}s`,
      );
    }

    this.setHeaders(response, options.limit, options.limit - current.hits, current.resetAt);

    return true;
  }

  /** Descarta ventanas caducadas para que el `Map` no crezca sin límite. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) {
      return;
    }

    this.lastSweep = now;

    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }

  private setHeaders(response: Response | null, limit: number, remaining: number, resetAt: number): void {
    if (!response) {
      return;
    }

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
