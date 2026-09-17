import type { OAuthAppStatus, OAuthClientType, WebhookDeliveryStatus } from './enums.js';
import type { Media, UserSummary } from './models.js';

/** Un permiso con su explicación, para la pantalla de consentimiento y el portal. */
export interface OAuthScopeInfo {
  scope: string;
  title: string;
  description: string;
  /** Los que dan acceso a datos privados o permiten actuar en nombre de alguien. */
  sensitive: boolean;
}

export interface WebhookConfig {
  url: string | null;
  events: string[];
  active: boolean;
  verifiedAt: string | null;
}

/** Una aplicación de terceros, vista por su dueño en el portal. */
export interface DeveloperApp {
  id: string;
  name: string;
  description: string;
  websiteUrl: string | null;
  privacyPolicyUrl: string | null;
  icon: Media | null;
  clientId: string;
  /** Últimos caracteres del secreto, para reconocerlo. */
  clientSecretHint: string | null;
  clientType: OAuthClientType;
  status: OAuthAppStatus;
  redirectUris: string[];
  allowedScopes: string[];
  testers: UserSummary[];
  webhook: WebhookConfig;
  rateLimitPerHour: number;
  /** Cuántas personas la tienen autorizada. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** El secreto recién generado. Es la única vez que se ve en claro. */
export interface AppCredentials {
  app: DeveloperApp;
  clientSecret: string | null;
  /** El secreto del webhook, cuando se acaba de generar. */
  webhookSecret: string | null;
}

export interface CreateAppRequest {
  name: string;
  description?: string;
  websiteUrl?: string;
  privacyPolicyUrl?: string;
  clientType?: OAuthClientType;
  redirectUris: string[];
  allowedScopes?: string[];
}

export interface UpdateAppRequest {
  name?: string;
  description?: string;
  websiteUrl?: string | null;
  privacyPolicyUrl?: string | null;
  redirectUris?: string[];
  allowedScopes?: string[];
}

export interface UpdateWebhookRequest {
  url: string | null;
  events: string[];
  active: boolean;
}

/** Lo que ve la persona en la pantalla de «¿Autorizar esta aplicación?». */
export interface OAuthAuthorizationPreview {
  app: {
    name: string;
    description: string;
    icon: Media | null;
    websiteUrl: string | null;
    privacyPolicyUrl: string | null;
    owner: UserSummary;
    /** Cierto si aún está en desarrollo: sólo la pueden usar su dueño y sus probadores. */
    inDevelopment: boolean;
  };
  requestedScopes: OAuthScopeInfo[];
  /** Los que ya había concedido: no hace falta volver a preguntarlos. */
  alreadyGranted: string[];
  redirectUri: string;
}

export interface OAuthAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  /** Permisos separados por espacios o comas. */
  scope?: string;
  state?: string;
  responseType?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/** Adónde volver tras aprobar o rechazar. */
export interface OAuthAuthorizeResult {
  redirectTo: string;
}

/** Respuesta del intercambio de un código o un refresh token, como la define RFC 6749. */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string | null;
  scope: string;
}

/** Una aplicación que la persona ha autorizado, en «Apps y sitios web». */
export interface AuthorizedApp {
  id: string;
  appId: string;
  name: string;
  icon: Media | null;
  websiteUrl: string | null;
  scopes: OAuthScopeInfo[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiUsagePoint {
  hour: string;
  requests: number;
  errors: number;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}
