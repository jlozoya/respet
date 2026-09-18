import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, UserRole } from '@social-network/shared';

/** Lo mínimo que hace falta de una cuenta para firmar su token. */
export interface TokenSubject {
  id: string;
  role: UserRole;
}

/** Para qué se emite un access token de terceros. */
export interface AppTokenClaims {
  grantId: string;
  clientId: string;
  scopes: string[];
}

/**
 * Firma y verificación de los access tokens.
 *
 * Son JWT cortos que no se guardan en ninguna parte. Llevan dentro a quién
 * pertenecen y desde dónde se emitieron —la sesión propia o el consentimiento
 * de una aplicación de terceros—, que es lo que cada petición comprueba que
 * siga vigente. Los refresh tokens ya no son JWT: los gestiona
 * `SessionService` como tokens opacos.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Access token de la propia aplicación, atado a una sesión. */
  async signSessionToken(
    subject: TokenSubject,
    sessionId: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = parseDuration(this.config.getOrThrow<string>('jwt.accessTtl'));
    const token = await this.jwt.signAsync(
      { sub: subject.id, sid: sessionId, role: subject.role },
      { secret: this.secret(), expiresIn },
    );

    return { token, expiresIn };
  }

  /** Access token de una aplicación de terceros, atado a un consentimiento. */
  async signAppToken(
    subject: TokenSubject,
    claims: AppTokenClaims,
  ): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = parseDuration(this.config.getOrThrow<string>('oauth.accessTtl'));
    const token = await this.jwt.signAsync(
      {
        sub: subject.id,
        gid: claims.grantId,
        azp: claims.clientId,
        scope: claims.scopes.join(' '),
        role: subject.role,
      },
      { secret: this.secret(), expiresIn },
    );

    return { token, expiresIn };
  }

  /** Verifica la firma y la caducidad. `null` si no vale. */
  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.secret() });
    } catch {
      return null;
    }
  }

  private secret(): string {
    return this.config.getOrThrow<string>('jwt.accessSecret');
  }
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
