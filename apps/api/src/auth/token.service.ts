import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { AuthTokens, UserRole } from '@respet/shared';
import type { Model } from '../database/mongoose.js';
import { createHash, randomBytes } from 'node:crypto';

import { AppException, ErrorCode } from '../common/errors.js';
import { RefreshToken } from '../database/schemas/user.schema.js';

/** Lo mínimo que hace falta de una cuenta para firmar sus tokens. */
export interface TokenSubject {
  id: string;
  email: string;
  role: UserRole;
}

export interface TokenContext {
  userAgent?: string;
  ip?: string;
}

interface RefreshPayload {
  sub: string;
  jti: string;
}

/**
 * Emisión y rotación de tokens.
 *
 * El access token es un JWT corto que no se guarda en ninguna parte. El refresh
 * token sí se registra, pero sólo su hash SHA-256: si alguien se lleva una copia
 * de la base de datos no obtiene tokens utilizables.
 *
 * Cada uso rota el refresh token y deja apuntado cuál lo sustituye. Si más
 * tarde llega otra vez un token ya rotado es que se ha filtrado, así que se
 * revoca la familia entera y se obliga a iniciar sesión de nuevo.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(RefreshToken.name) private readonly refreshTokens: Model<RefreshToken>,
  ) {}

  async issue(user: TokenSubject, context: TokenContext = {}): Promise<AuthTokens> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, context);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /**
   * Canjea un refresh token por un par nuevo.
   *
   * @throws AppException si el token es inválido, ha caducado o se está
   * reutilizando uno ya rotado.
   */
  async rotate(refreshToken: string, context: TokenContext = {}): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const stored = await this.refreshTokens
      .findOne({ tokenHash })
      .populate<{ user: TokenSubject | null }>({
        path: 'user',
        select: 'email role',
      })
      .lean();

    if (!stored || String(stored.userId) !== payload.sub) {
      throw AppException.badToken('Refresh token not recognised');
    }

    const userId = String(stored.userId);

    if (stored.revokedAt) {
      // Un token ya rotado que vuelve a aparecer sólo se explica por un robo:
      // cortamos todas las sesiones del usuario.
      await this.revokeAllForUser(userId);
      throw AppException.badToken('Refresh token was already used; all sessions were revoked');
    }

    if (stored.expiresAt <= new Date()) {
      throw AppException.badToken('Refresh token has expired');
    }

    const user = stored.user;

    if (!user) {
      throw AppException.badToken('Refresh token belongs to an account that no longer exists');
    }

    const nextToken = await this.createRefreshToken(userId, context);

    await this.refreshTokens.updateOne(
      { _id: stored._id },
      { $set: { revokedAt: new Date(), replacedByHash: hashToken(nextToken) } },
    );

    return {
      accessToken: await this.signAccessToken({ ...user, id: userId }),
      refreshToken: nextToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /** Cierra una sesión concreta. No falla si el token ya no existe. */
  async revoke(refreshToken: string): Promise<void> {
    await this.refreshTokens.updateMany(
      { tokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Cierra todas las sesiones abiertas del usuario. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** Borra los tokens caducados. Pensado para una tarea programada. */
  async purgeExpired(): Promise<number> {
    const { deletedCount } = await this.refreshTokens.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return deletedCount;
  }

  private async signAccessToken(user: TokenSubject): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        // En segundos: el tipo de `expiresIn` para cadenas es una plantilla
        // literal del paquete `ms`, y un `string` cualquiera no encaja en ella.
        expiresIn: this.accessTtlSeconds(),
      },
    );
  }

  private async createRefreshToken(userId: string, context: TokenContext): Promise<string> {
    const jti = randomBytes(32).toString('hex');
    const days = this.config.getOrThrow<number>('jwt.refreshTtlDays');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const token = await this.jwt.signAsync(
      { sub: userId, jti } satisfies RefreshPayload,
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: days * 24 * 60 * 60,
      },
    );

    await this.refreshTokens.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ip: context.ip?.slice(0, 45) ?? null,
    });

    return token;
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new AppException(ErrorCode.BadToken, 400, 'Refresh token is invalid or expired');
    }
  }

  private accessTtlSeconds(): number {
    return parseDuration(this.config.getOrThrow<string>('jwt.accessTtl'));
  }
}

/**
 * Hash de un token para guardarlo.
 *
 * SHA-256 sin sal basta: el token es una cadena aleatoria de 256 bits, así que
 * no hay diccionario que atacar, y una función rápida permite buscarlo por
 * índice en cada petición de refresco.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Convierte duraciones estilo `15m`, `2h` o `7d` a segundos. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());

  if (!match) {
    const seconds = Number(value);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`Duración inválida: "${value}"`);
    }

    return seconds;
  }

  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

  return amount * multipliers[unit];
}
