import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  DeviceSession,
  MfaStatus,
  Paginated,
  RecoveryCodes,
  SecurityEvent,
  TotpSetup,
} from '@social-network/shared';

import {
  Client,
  CurrentUser,
  RateLimit,
  type AuthenticatedUser,
  type ClientInfo,
} from '../common/decorators/index.js';
import { AppException } from '../common/errors.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { SecurityEventType, SessionEndReason } from '../database/schemas/enums.js';
import {
  DeviceSessionType,
  MfaStatusType,
  RecoveryCodesType,
  SecurityEventPage,
  TotpSetupType,
} from '../graphql/types/auth.types.js';
import { ConfirmTotpDto, ReauthDto } from './dto/auth.dto.js';
import { MfaService } from './mfa/mfa.service.js';
import { ReauthService } from './reauth.service.js';
import { SecurityAlertsService } from './security/security-alerts.service.js';
import { SecurityEventsService } from './security/security-events.service.js';
import { SessionService } from './session/session.service.js';

/**
 * La pantalla de seguridad de la cuenta: sesiones abiertas, verificación en
 * dos pasos y registro de actividad.
 *
 * Nada de esto está abierto a aplicaciones de terceros —no lleva `@Scopes`—:
 * que una app pueda ver o cerrar tus sesiones, o apagar tu segundo factor,
 * sería darle las llaves de la cuenta.
 */
@Resolver()
export class SecurityResolver {
  constructor(
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly reauth: ReauthService,
    private readonly events: SecurityEventsService,
    private readonly alerts: SecurityAlertsService,
  ) {}

  // --- Sesiones ---------------------------------------------------------------

  @Query(() => [DeviceSessionType], {
    name: 'mySessions',
    description: 'Dispositivos con la sesión abierta, empezando por éste.',
  })
  async mySessions(@CurrentUser() actor: AuthenticatedUser): Promise<DeviceSession[]> {
    return this.sessions.listForUser(actor.id, actor.sessionId);
  }

  @Mutation(() => Boolean, { description: 'Cierra la sesión de otro dispositivo.' })
  async revokeSession(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    const session = await this.sessions.findOwned(id, actor.id);

    if (!session) {
      throw AppException.notFound('Session');
    }

    await this.sessions.revoke(id, SessionEndReason.RevokedByUser);
    await this.events.record(actor.id, SecurityEventType.SessionRevoked, client, {
      device: session.device?.name,
    });

    return true;
  }

  @Mutation(() => Int, { description: 'Cierra todas las demás sesiones. Devuelve cuántas cerró.' })
  async revokeOtherSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Client() client: ClientInfo,
  ): Promise<number> {
    const count = await this.sessions.revokeAllForUser(
      actor.id,
      SessionEndReason.RevokedByUser,
      actor.sessionId,
    );

    if (count > 0) {
      await this.events.record(actor.id, SecurityEventType.SessionRevoked, client, {
        reason: 'others',
      });
    }

    return count;
  }

  // --- Verificación en dos pasos ---------------------------------------------

  @Query(() => MfaStatusType, { name: 'mfaStatus' })
  async mfaStatus(@CurrentUser('id') userId: string): Promise<MfaStatus> {
    return this.mfa.status(userId);
  }

  @RateLimit({ limit: 10, windowSeconds: 900 })
  @Mutation(() => TotpSetupType, {
    description: 'Empieza a activar la app de autenticación. Pide confirmar la identidad.',
  })
  async beginTotpSetup(
    @CurrentUser() actor: AuthenticatedUser,
    @Client() client: ClientInfo,
    @Args('reauth', { type: () => ReauthDto, nullable: true }) reauth?: ReauthDto,
  ): Promise<TotpSetup> {
    await this.reauth.assert(actor, reauth, client);

    return this.mfa.beginTotpSetup(actor.id);
  }

  @RateLimit({ limit: 10, windowSeconds: 900 })
  @Mutation(() => RecoveryCodesType, {
    description:
      'Confirma la app con un código y activa la verificación. Devuelve los códigos de recuperación.',
  })
  async confirmTotpSetup(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input') input: ConfirmTotpDto,
    @Client() client: ClientInfo,
  ): Promise<RecoveryCodes> {
    const codes = await this.mfa.confirmTotpSetup(actor.id, input.code, client);

    // Activar el segundo factor cierra el resto de sesiones: si alguien ya
    // estaba dentro, activarlo no serviría de nada si pudiera seguir ahí.
    await this.sessions.revokeAllForUser(actor.id, SessionEndReason.MfaChanged, actor.sessionId);
    await this.alerts.send(actor.id, 'mfa_enabled', client);

    return codes;
  }

  @RateLimit({ limit: 10, windowSeconds: 900 })
  @Mutation(() => Boolean, { description: 'Desactiva la verificación en dos pasos.' })
  async disableMfa(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('reauth') reauth: ReauthDto,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.reauth.assert(actor, reauth, client);
    await this.mfa.disable(actor.id, client);
    await this.alerts.send(actor.id, 'mfa_disabled', client);

    return true;
  }

  @RateLimit({ limit: 5, windowSeconds: 900 })
  @Mutation(() => RecoveryCodesType, {
    description: 'Genera códigos de recuperación nuevos; los anteriores dejan de valer.',
  })
  async regenerateRecoveryCodes(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('reauth') reauth: ReauthDto,
    @Client() client: ClientInfo,
  ): Promise<RecoveryCodes> {
    await this.reauth.assert(actor, reauth, client);

    return this.mfa.regenerateRecoveryCodes(actor.id, client);
  }

  @Mutation(() => Boolean, {
    description: 'Deja de confiar en un dispositivo, o en todos si no se indica ninguno.',
  })
  async revokeTrustedDevice(
    @CurrentUser('id') userId: string,
    @Client() client: ClientInfo,
    @Args('id', { type: () => ID, nullable: true }) id?: string,
  ): Promise<boolean> {
    await this.mfa.revokeTrustedDevice(userId, id ?? null, client);

    return true;
  }

  // --- Actividad ------------------------------------------------------------

  @Query(() => SecurityEventPage, { name: 'mySecurityEvents' })
  async mySecurityEvents(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page: number,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 20 }) perPage: number,
  ): Promise<Paginated<SecurityEvent>> {
    return this.events.list(userId, page, Math.min(perPage, 50));
  }
}
