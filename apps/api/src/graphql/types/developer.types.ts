import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  ApiUsagePoint,
  AppCredentials,
  AuthorizedApp,
  DeveloperApp,
  OAuthAuthorizationPreview,
  OAuthAuthorizeResult,
  OAuthScopeInfo,
  OAuthTokenResponse,
  WebhookConfig,
  WebhookDelivery,
} from '@social-network/shared';

import { OAuthAppStatus, OAuthClientType, WebhookDeliveryStatus } from '../enums.js';
import { MediaType, Paginated } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('OAuthScopeInfo', { description: 'Un permiso con su explicación.' })
export class OAuthScopeInfoType implements OAuthScopeInfo {
  @Field()
  scope!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  sensitive!: boolean;
}

@ObjectType('WebhookConfig')
export class WebhookConfigType implements WebhookConfig {
  @Field(() => String, { nullable: true })
  url!: string | null;

  @Field(() => [String])
  events!: string[];

  @Field()
  active!: boolean;

  @Field(() => String, { nullable: true })
  verifiedAt!: string | null;
}

@ObjectType('DeveloperApp', { description: 'Una aplicación de terceros, vista por su dueño.' })
export class DeveloperAppType implements DeveloperApp {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => String, { nullable: true })
  websiteUrl!: string | null;

  @Field(() => String, { nullable: true })
  privacyPolicyUrl!: string | null;

  @Field(() => MediaType, { nullable: true })
  icon!: MediaType | null;

  @Field()
  clientId!: string;

  @Field(() => String, { nullable: true, description: 'Últimos caracteres del secreto.' })
  clientSecretHint!: string | null;

  @Field(() => OAuthClientType)
  clientType!: OAuthClientType;

  @Field(() => OAuthAppStatus)
  status!: OAuthAppStatus;

  @Field(() => [String])
  redirectUris!: string[];

  @Field(() => [String])
  allowedScopes!: string[];

  @Field(() => [UserSummaryType])
  testers!: UserSummaryType[];

  @Field(() => WebhookConfigType)
  webhook!: WebhookConfigType;

  @Field(() => Int)
  rateLimitPerHour!: number;

  @Field(() => Int, { description: 'Personas que la tienen autorizada.' })
  userCount!: number;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('AppCredentials', { description: 'Secretos recién generados. Sólo se ven esta vez.' })
export class AppCredentialsType implements AppCredentials {
  @Field(() => DeveloperAppType)
  app!: DeveloperAppType;

  @Field(() => String, { nullable: true })
  clientSecret!: string | null;

  @Field(() => String, { nullable: true })
  webhookSecret!: string | null;
}

@ObjectType('OAuthAppPreview')
export class OAuthAppPreviewType {
  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => MediaType, { nullable: true })
  icon!: MediaType | null;

  @Field(() => String, { nullable: true })
  websiteUrl!: string | null;

  @Field(() => String, { nullable: true })
  privacyPolicyUrl!: string | null;

  @Field(() => UserSummaryType)
  owner!: UserSummaryType;

  @Field()
  inDevelopment!: boolean;
}

@ObjectType('OAuthAuthorizationPreview', {
  description: 'La pantalla de «¿Autorizar esta aplicación?».',
})
export class OAuthAuthorizationPreviewType implements OAuthAuthorizationPreview {
  @Field(() => OAuthAppPreviewType)
  app!: OAuthAppPreviewType;

  @Field(() => [OAuthScopeInfoType])
  requestedScopes!: OAuthScopeInfoType[];

  @Field(() => [String])
  alreadyGranted!: string[];

  @Field()
  redirectUri!: string;
}

@ObjectType('OAuthAuthorizeResult')
export class OAuthAuthorizeResultType implements OAuthAuthorizeResult {
  @Field({ description: 'Adónde llevar a la persona.' })
  redirectTo!: string;
}

@ObjectType('OAuthTokenResponse', { description: 'La respuesta de RFC 6749, con sus nombres.' })
export class OAuthTokenResponseType implements OAuthTokenResponse {
  @Field()
  access_token!: string;

  @Field()
  token_type!: 'Bearer';

  @Field(() => Int)
  expires_in!: number;

  @Field(() => String, { nullable: true })
  refresh_token!: string | null;

  @Field()
  scope!: string;
}

@ObjectType('AuthorizedApp', { description: 'Una aplicación que has autorizado.' })
export class AuthorizedAppType implements AuthorizedApp {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  appId!: string;

  @Field()
  name!: string;

  @Field(() => MediaType, { nullable: true })
  icon!: MediaType | null;

  @Field(() => String, { nullable: true })
  websiteUrl!: string | null;

  @Field(() => [OAuthScopeInfoType])
  scopes!: OAuthScopeInfoType[];

  @Field()
  createdAt!: string;

  @Field(() => String, { nullable: true })
  lastUsedAt!: string | null;
}

@ObjectType('ApiUsagePoint')
export class ApiUsagePointType implements ApiUsagePoint {
  @Field()
  hour!: string;

  @Field(() => Int)
  requests!: number;

  @Field(() => Int)
  errors!: number;
}

@ObjectType('WebhookDelivery')
export class WebhookDeliveryType implements WebhookDelivery {
  @Field(() => ID)
  id!: string;

  @Field()
  event!: string;

  @Field(() => WebhookDeliveryStatus)
  status!: WebhookDeliveryStatus;

  @Field(() => Int)
  attempts!: number;

  @Field(() => Int, { nullable: true })
  responseStatus!: number | null;

  @Field(() => String, { nullable: true })
  lastError!: string | null;

  @Field()
  createdAt!: string;

  @Field(() => String, { nullable: true })
  deliveredAt!: string | null;
}

export const WebhookDeliveryPage = Paginated(WebhookDeliveryType, 'WebhookDelivery');
