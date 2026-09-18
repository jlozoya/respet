import { Injectable, inject } from '@angular/core';
import type {
  AuthorizedApp,
  DeviceSession,
  MfaStatus,
  Paginated,
  ReauthRequest,
  RecoveryCodes,
  SecurityEvent,
  TotpSetup,
} from '@social-network/shared';

import {
  DEVICE_FRAGMENTS,
  MEDIA_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  SCOPE_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const MY_SESSIONS = gql(
  `query MySessions {
    mySessions {
      id
      ip
      authMethods
      current
      createdAt
      lastUsedAt
      expiresAt
      revokedAt
      revokedReason
      device { ...DeviceFields }
    }
  }`,
  ...DEVICE_FRAGMENTS,
);

const REVOKE_SESSION = `mutation RevokeSession($id: ID!) { revokeSession(id: $id) }`;
const REVOKE_OTHER_SESSIONS = `mutation RevokeOtherSessions { revokeOtherSessions }`;

const MFA_STATUS = gql(
  `query MfaStatus {
    mfaStatus {
      enabled
      enabledAt
      methods
      recoveryCodesRemaining
      trustedDevices { id ip lastUsedAt expiresAt createdAt device { ...DeviceFields } }
    }
  }`,
  ...DEVICE_FRAGMENTS,
);

const BEGIN_TOTP_SETUP = `
mutation BeginTotpSetup($reauth: ReauthInput) {
  beginTotpSetup(reauth: $reauth) { secret otpauthUrl qrCodeDataUrl }
}`;

const CONFIRM_TOTP_SETUP = `
mutation ConfirmTotpSetup($input: ConfirmTotpInput!) { confirmTotpSetup(input: $input) { codes } }`;

const DISABLE_MFA = `mutation DisableMfa($reauth: ReauthInput!) { disableMfa(reauth: $reauth) }`;

const REGENERATE_RECOVERY_CODES = `
mutation RegenerateRecoveryCodes($reauth: ReauthInput!) { regenerateRecoveryCodes(reauth: $reauth) { codes } }`;

const REVOKE_TRUSTED_DEVICE = `mutation RevokeTrustedDevice($id: ID) { revokeTrustedDevice(id: $id) }`;

const SECURITY_EVENTS = gql(
  `query MySecurityEvents($page: Int, $perPage: Int) {
    mySecurityEvents(page: $page, perPage: $perPage) {
      data { id type ip detail createdAt device { ...DeviceFields } }
      meta { ...PageMetaFields }
    }
  }`,
  ...DEVICE_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const AUTHORIZED_APPS = gql(
  `query AuthorizedApps {
    authorizedApps {
      id
      appId
      name
      websiteUrl
      createdAt
      lastUsedAt
      icon { ...MediaFields }
      scopes { ...ScopeFields }
    }
  }`,
  ...MEDIA_FRAGMENTS,
  ...SCOPE_FRAGMENTS,
);

const REVOKE_AUTHORIZED_APP = `mutation RevokeAuthorizedApp($id: ID!) { revokeAuthorizedApp(id: $id) }`;

/**
 * Seguridad de la cuenta: dónde está abierta, la verificación en dos pasos,
 * lo que ha pasado y qué aplicaciones tienen acceso.
 *
 * Lo delicado —activar o desactivar el segundo factor, sacar códigos nuevos—
 * pide confirmar la identidad. Si la sesión es reciente el servidor no lo
 * exige; si no, responde `SERVER.REAUTH_REQUIRED` y la pantalla pregunta la
 * contraseña o el código antes de repetir.
 */
@Injectable({ providedIn: 'root' })
export class SecurityService {
  private readonly gql = inject(GraphqlClientService);

  sessions(): Promise<DeviceSession[]> {
    return this.gql.field(MY_SESSIONS);
  }

  async revokeSession(id: string): Promise<void> {
    await this.gql.request(REVOKE_SESSION, { id });
  }

  revokeOtherSessions(): Promise<number> {
    return this.gql.field(REVOKE_OTHER_SESSIONS);
  }

  mfaStatus(): Promise<MfaStatus> {
    return this.gql.field(MFA_STATUS);
  }

  beginTotpSetup(reauth?: ReauthRequest): Promise<TotpSetup> {
    return this.gql.field(BEGIN_TOTP_SETUP, { reauth });
  }

  confirmTotpSetup(code: string): Promise<RecoveryCodes> {
    return this.gql.field(CONFIRM_TOTP_SETUP, { input: { code: code.replace(/\s+/g, '') } });
  }

  async disableMfa(reauth: ReauthRequest): Promise<void> {
    await this.gql.request(DISABLE_MFA, { reauth });
  }

  regenerateRecoveryCodes(reauth: ReauthRequest): Promise<RecoveryCodes> {
    return this.gql.field(REGENERATE_RECOVERY_CODES, { reauth });
  }

  /** Deja de confiar en un dispositivo, o en todos sin `id`. */
  async revokeTrustedDevice(id?: string): Promise<void> {
    await this.gql.request(REVOKE_TRUSTED_DEVICE, { id: id ?? null });
  }

  events(page = 1, perPage = 20): Promise<Paginated<SecurityEvent>> {
    return this.gql.field(SECURITY_EVENTS, { page, perPage });
  }

  authorizedApps(): Promise<AuthorizedApp[]> {
    return this.gql.field(AUTHORIZED_APPS);
  }

  async revokeAuthorizedApp(id: string): Promise<void> {
    await this.gql.request(REVOKE_AUTHORIZED_APP, { id });
  }
}
