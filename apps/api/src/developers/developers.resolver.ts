import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  ApiUsagePoint,
  AppCredentials,
  AuthorizedApp,
  DeveloperApp,
  OAuthAuthorizationPreview,
  OAuthAuthorizeResult,
  OAuthScopeInfo,
  OAuthTokenResponse,
  Paginated,
  WebhookDelivery,
} from '@respet/shared';

import {
  Client,
  CurrentUser,
  Public,
  RateLimit,
  type ClientInfo,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { OAuthAppStatus } from '../graphql/enums.js';
import {
  ApiUsagePointType,
  AppCredentialsType,
  AuthorizedAppType,
  DeveloperAppType,
  OAuthAuthorizationPreviewType,
  OAuthAuthorizeResultType,
  OAuthScopeInfoType,
  OAuthTokenResponseType,
  WebhookDeliveryPage,
} from '../graphql/types/developer.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import { DeveloperAppsService } from './developer-apps.service.js';
import {
  CreateAppDto,
  OAuthAuthorizeDto,
  OAuthCodeExchangeDto,
  OAuthRefreshDto,
  UpdateAppDto,
  UpdateWebhookDto,
} from './dto/developer.dto.js';
import { OAuthService } from './oauth.service.js';
import { SCOPE_CATALOG } from './scopes.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';

/**
 * El portal para desarrolladores y la autorización de aplicaciones.
 *
 * Nada de esto lleva `@Scopes`: una aplicación de terceros no puede crear
 * otras aplicaciones ni autorizarse a sí misma.
 */
@Resolver()
export class DevelopersResolver {
  constructor(
    private readonly apps: DeveloperAppsService,
    private readonly oauth: OAuthService,
    private readonly webhooks: WebhookDispatcherService,
  ) {}

  // --- Catálogo --------------------------------------------------------------

  @Public()
  @Query(() => [OAuthScopeInfoType], { name: 'oauthScopes', description: 'Los permisos que puede pedir una aplicación.' })
  oauthScopes(): readonly OAuthScopeInfo[] {
    return SCOPE_CATALOG;
  }

  // --- Mis aplicaciones ------------------------------------------------------

  @Query(() => [DeveloperAppType], { name: 'developerApps' })
  async developerApps(@CurrentUser('id') userId: string): Promise<DeveloperApp[]> {
    return this.apps.listMine(userId);
  }

  @Query(() => DeveloperAppType, { name: 'developerApp' })
  async developerApp(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<DeveloperApp> {
    return this.apps.findMine(id, userId);
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => AppCredentialsType, { description: 'Registra una aplicación. El secreto sólo se ve ahora.' })
  async createDeveloperApp(
    @CurrentUser('id') userId: string,
    @Args('input') input: CreateAppDto,
  ): Promise<AppCredentials> {
    return this.apps.create(userId, input);
  }

  @Mutation(() => DeveloperAppType)
  async updateDeveloperApp(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateAppDto,
  ): Promise<DeveloperApp> {
    return this.apps.update(id, userId, input);
  }

  @Mutation(() => DeveloperAppType)
  async setDeveloperAppIcon(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<DeveloperApp> {
    return this.apps.setIcon(id, userId, file);
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => AppCredentialsType, { description: 'Genera un secreto nuevo; el anterior deja de valer.' })
  async rotateDeveloperAppSecret(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AppCredentials> {
    return this.apps.rotateSecret(id, userId);
  }

  @Mutation(() => DeveloperAppType, { description: 'Publica la aplicación o la devuelve a desarrollo.' })
  async setDeveloperAppStatus(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('status', { type: () => OAuthAppStatus }) status: OAuthAppStatus,
    @CurrentUser('id') userId: string,
  ): Promise<DeveloperApp> {
    return this.apps.setStatus(id, userId, status);
  }

  @Mutation(() => Boolean)
  async deleteDeveloperApp(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.apps.remove(id, userId);

    return true;
  }

  @Mutation(() => DeveloperAppType, { description: 'Añade un probador por nombre de usuario.' })
  async addDeveloperAppTester(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('username') username: string,
    @CurrentUser('id') userId: string,
  ): Promise<DeveloperApp> {
    return this.apps.addTester(id, userId, username);
  }

  @Mutation(() => DeveloperAppType)
  async removeDeveloperAppTester(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) testerId: string,
    @CurrentUser('id') userId: string,
  ): Promise<DeveloperApp> {
    return this.apps.removeTester(id, userId, testerId);
  }

  @Mutation(() => AppCredentialsType, { description: 'Configura el webhook. La primera vez devuelve el secreto de firma.' })
  async updateDeveloperAppWebhook(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateWebhookDto,
    @CurrentUser('id') userId: string,
  ): Promise<AppCredentials> {
    return this.apps.updateWebhook(id, userId, input);
  }

  @Mutation(() => AppCredentialsType)
  async rotateDeveloperAppWebhookSecret(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AppCredentials> {
    return this.apps.rotateWebhookSecret(id, userId);
  }

  @RateLimit({ limit: 20, windowSeconds: 3600 })
  @Mutation(() => DeveloperAppType, { description: 'Verifica la dirección del webhook con un reto.' })
  async verifyDeveloperAppWebhook(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<DeveloperApp> {
    return this.apps.verifyWebhook(id, userId);
  }

  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Mutation(() => Boolean, { description: 'Encola una entrega de prueba.' })
  async sendDeveloperAppTestWebhook(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.apps.findMine(id, userId);
    await this.webhooks.sendTest(id);

    return true;
  }

  @Query(() => WebhookDeliveryPage, { name: 'developerAppWebhookDeliveries' })
  async deliveries(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 20 }) perPage = 20,
  ): Promise<Paginated<WebhookDelivery>> {
    return this.apps.listDeliveries(id, userId, page, Math.min(perPage, 100));
  }

  @Query(() => [ApiUsagePointType], { name: 'developerAppUsage', description: 'Peticiones por hora.' })
  async usage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args('hours', { type: () => Int, nullable: true, defaultValue: 24 }) hours = 24,
  ): Promise<ApiUsagePoint[]> {
    return this.apps.usageOf(id, userId, hours);
  }

  // --- Autorización ------------------------------------------------------------

  @Query(() => OAuthAuthorizationPreviewType, {
    name: 'oauthAuthorizationPreview',
    description: 'Valida una petición de autorización y describe lo que pide.',
  })
  async preview(
    @CurrentUser('id') userId: string,
    @Args('input') input: OAuthAuthorizeDto,
  ): Promise<OAuthAuthorizationPreview> {
    return this.oauth.preview(userId, input);
  }

  @RateLimit({ limit: 30, windowSeconds: 300 })
  @Mutation(() => OAuthAuthorizeResultType, { description: 'Aprueba la autorización y devuelve adónde volver con el código.' })
  async approveOAuthAuthorization(
    @CurrentUser('id') userId: string,
    @Args('input') input: OAuthAuthorizeDto,
    @Client() client: ClientInfo,
  ): Promise<OAuthAuthorizeResult> {
    return this.oauth.approve(userId, input, client);
  }

  @Mutation(() => OAuthAuthorizeResultType, { description: 'Rechaza la autorización.' })
  async denyOAuthAuthorization(
    @CurrentUser('id') userId: string,
    @Args('input') input: OAuthAuthorizeDto,
  ): Promise<OAuthAuthorizeResult> {
    return this.oauth.deny(userId, input);
  }

  @Public()
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Mutation(() => OAuthTokenResponseType, {
    description: 'Canjea un código de autorización. Equivale a `POST /oauth/token` con `authorization_code`.',
  })
  async exchangeOAuthCode(@Args('input') input: OAuthCodeExchangeDto): Promise<OAuthTokenResponse> {
    return this.oauth.exchangeCode(input);
  }

  @Public()
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Mutation(() => OAuthTokenResponseType, {
    description: 'Renueva el token de una aplicación. Equivale a `POST /oauth/token` con `refresh_token`.',
  })
  async refreshOAuthToken(@Args('input') input: OAuthRefreshDto): Promise<OAuthTokenResponse> {
    return this.oauth.refresh(input);
  }

  @Query(() => [AuthorizedAppType], { name: 'authorizedApps', description: 'Aplicaciones que tienen acceso a tu cuenta.' })
  async authorizedApps(@CurrentUser('id') userId: string): Promise<AuthorizedApp[]> {
    return this.oauth.authorizedApps(userId);
  }

  @Mutation(() => Boolean, { description: 'Retira el acceso a una aplicación. Surte efecto en el acto.' })
  async revokeAuthorizedApp(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.oauth.revokeGrant(userId, id, client);

    return true;
  }
}
