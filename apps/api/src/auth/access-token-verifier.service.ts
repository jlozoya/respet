import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { isValidObjectId, type Model } from '../database/mongoose.js';
import { OAuthAppStatus } from '../database/schemas/enums.js';
import { OAuthApp, OAuthGrant } from '../database/schemas/developer.schema.js';
import { User } from '../database/schemas/user.schema.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import { SessionService } from './session/session.service.js';
import { TokenService } from './token.service.js';

const GRANT_CACHE_TTL_MS = 30_000;

interface CachedGrant {
  active: boolean;
  appId: string;
  checkedAt: number;
}

export interface GrantRevokedEvent {
  grantIds: string[];
}

/**
 * Convierte un access token en la identidad de quien llama.
 *
 * Lo usan las dos puertas de la API: `JwtStrategy`, para las peticiones HTTP,
 * y la conexión WebSocket de las suscripciones. Además de la firma comprueba
 * tres cosas que un JWT no puede saber por sí solo: que la cuenta existe —y
 * con qué rol, que puede haber cambiado—, que la sesión sigue abierta y, si el
 * token es de una aplicación de terceros, que la persona no le ha retirado el
 * acceso ni la aplicación está suspendida.
 */
@Injectable()
export class AccessTokenVerifierService implements OnModuleDestroy {
  private readonly grants = new Map<string, CachedGrant>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly bus: EventBusService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(OAuthGrant.name) private readonly oauthGrants: Model<OAuthGrant>,
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
  ) {
    this.unsubscribe = this.bus.on<GrantRevokedEvent>(Topic.grantRevoked, (event) => {
      for (const id of event.grantIds) {
        this.grants.delete(id);
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe();
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    const payload = await this.tokens.verify(token);

    if (!payload || !isValidObjectId(payload.sub)) {
      return null;
    }

    const user = await this.users.findById(payload.sub).select('email role').lean();

    if (!user) {
      return null;
    }

    const base = { id: String(user._id), email: user.email, role: user.role };

    if (payload.sid) {
      return (await this.sessions.isActive(payload.sid, base.id))
        ? { ...base, sessionId: payload.sid, app: null }
        : null;
    }

    if (payload.gid && payload.azp) {
      const grant = await this.grantInfo(payload.gid, base.id);

      if (!grant) {
        return null;
      }

      return {
        ...base,
        // Una aplicación de terceros nunca actúa con más rol que el de una
        // persona corriente, aunque quien la autorizó sea administrador.
        role: 'user',
        sessionId: null,
        app: {
          id: grant.appId,
          clientId: payload.azp,
          grantId: payload.gid,
          scopes: (payload.scope ?? '').split(' ').filter(Boolean),
        },
      };
    }

    // Un token sin sesión ni consentimiento es de antes de este sistema: no vale.
    return null;
  }

  private async grantInfo(grantId: string, userId: string): Promise<CachedGrant | null> {
    const now = Date.now();
    const cached = this.grants.get(grantId);

    if (cached && now - cached.checkedAt < GRANT_CACHE_TTL_MS) {
      return cached.active ? cached : null;
    }

    if (!isValidObjectId(grantId)) {
      return null;
    }

    const grant = await this.oauthGrants.findById(grantId).select('userId appId revokedAt').lean();
    let active = grant !== null && grant.revokedAt === null && String(grant.userId) === userId;

    if (active && grant) {
      const app = await this.apps.findById(grant.appId).select('status').lean();
      active = app !== null && app.status !== OAuthAppStatus.Suspended;
    }

    const entry: CachedGrant = { active, appId: grant ? String(grant.appId) : '', checkedAt: now };

    this.grants.set(grantId, entry);

    if (this.grants.size > 10_000) {
      for (const [id, value] of this.grants) {
        if (now - value.checkedAt > GRANT_CACHE_TTL_MS) {
          this.grants.delete(id);
        }
      }
    }

    return active ? entry : null;
  }
}
