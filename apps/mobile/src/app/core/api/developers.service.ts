import { Injectable, inject } from '@angular/core';
import type {
  ApiUsagePoint,
  AppCredentials,
  CreateAppRequest,
  DeveloperApp,
  OAuthAppStatus,
  OAuthAuthorizationPreview,
  OAuthAuthorizeRequest,
  OAuthAuthorizeResult,
  OAuthScopeInfo,
  Paginated,
  UpdateAppRequest,
  UpdateWebhookRequest,
  WebhookDelivery,
} from '@social-network/shared';

import {
  DEVELOPER_APP_FRAGMENTS,
  MEDIA_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  SCOPE_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const CREDENTIALS_FIELDS = `clientSecret webhookSecret app { ...DeveloperAppFields }`;

const DEVELOPER_APPS = gql(
  `query DeveloperApps { developerApps { ...DeveloperAppFields } }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const DEVELOPER_APP = gql(
  `query DeveloperApp($id: ID!) { developerApp(id: $id) { ...DeveloperAppFields } }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const CREATE_APP = gql(
  `mutation CreateDeveloperApp($input: CreateDeveloperAppInput!) {
    createDeveloperApp(input: $input) { ${CREDENTIALS_FIELDS} }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const UPDATE_APP = gql(
  `mutation UpdateDeveloperApp($id: ID!, $input: UpdateDeveloperAppInput!) {
    updateDeveloperApp(id: $id, input: $input) { ...DeveloperAppFields }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const DELETE_APP = `mutation DeleteDeveloperApp($id: ID!) { deleteDeveloperApp(id: $id) }`;

const SET_APP_ICON = gql(
  `mutation SetDeveloperAppIcon($id: ID!, $file: Upload!) {
    setDeveloperAppIcon(id: $id, file: $file) { ...DeveloperAppFields }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const SET_APP_STATUS = gql(
  `mutation SetDeveloperAppStatus($id: ID!, $status: OAuthAppStatus!) {
    setDeveloperAppStatus(id: $id, status: $status) { ...DeveloperAppFields }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const ROTATE_SECRET = gql(
  `mutation RotateDeveloperAppSecret($id: ID!) { rotateDeveloperAppSecret(id: $id) { ${CREDENTIALS_FIELDS} } }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const ROTATE_WEBHOOK_SECRET = gql(
  `mutation RotateDeveloperAppWebhookSecret($id: ID!) {
    rotateDeveloperAppWebhookSecret(id: $id) { ${CREDENTIALS_FIELDS} }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const UPDATE_WEBHOOK = gql(
  `mutation UpdateDeveloperAppWebhook($id: ID!, $input: UpdateWebhookInput!) {
    updateDeveloperAppWebhook(id: $id, input: $input) { ${CREDENTIALS_FIELDS} }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const VERIFY_WEBHOOK = gql(
  `mutation VerifyDeveloperAppWebhook($id: ID!) { verifyDeveloperAppWebhook(id: $id) { ...DeveloperAppFields } }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const TEST_WEBHOOK = `mutation SendDeveloperAppTestWebhook($id: ID!) { sendDeveloperAppTestWebhook(id: $id) }`;

const ADD_TESTER = gql(
  `mutation AddDeveloperAppTester($id: ID!, $username: String!) {
    addDeveloperAppTester(id: $id, username: $username) { ...DeveloperAppFields }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const REMOVE_TESTER = gql(
  `mutation RemoveDeveloperAppTester($id: ID!, $userId: ID!) {
    removeDeveloperAppTester(id: $id, userId: $userId) { ...DeveloperAppFields }
  }`,
  ...DEVELOPER_APP_FRAGMENTS,
);

const APP_USAGE = `
query DeveloperAppUsage($id: ID!, $hours: Int) { developerAppUsage(id: $id, hours: $hours) { hour requests errors } }`;

const WEBHOOK_DELIVERIES = gql(
  `query DeveloperAppWebhookDeliveries($id: ID!, $page: Int, $perPage: Int) {
    developerAppWebhookDeliveries(id: $id, page: $page, perPage: $perPage) {
      data { id event status attempts responseStatus lastError createdAt deliveredAt }
      meta { ...PageMetaFields }
    }
  }`,
  ...PAGE_META_FRAGMENTS,
);

const OAUTH_SCOPES = gql(
  `query OAuthScopes { oauthScopes { ...ScopeFields } }`,
  ...SCOPE_FRAGMENTS,
);

const AUTHORIZATION_PREVIEW = gql(
  `query OAuthAuthorizationPreview($input: OAuthAuthorizeInput!) {
    oauthAuthorizationPreview(input: $input) {
      alreadyGranted
      redirectUri
      requestedScopes { ...ScopeFields }
      app {
        name
        description
        websiteUrl
        privacyPolicyUrl
        inDevelopment
        icon { ...MediaFields }
        owner { ...UserSummaryFields }
      }
    }
  }`,
  ...SCOPE_FRAGMENTS,
  ...MEDIA_FRAGMENTS,
  ...USER_SUMMARY_FRAGMENTS,
);

const APPROVE_AUTHORIZATION = `
mutation ApproveOAuthAuthorization($input: OAuthAuthorizeInput!) {
  approveOAuthAuthorization(input: $input) { redirectTo }
}`;

const DENY_AUTHORIZATION = `
mutation DenyOAuthAuthorization($input: OAuthAuthorizeInput!) {
  denyOAuthAuthorization(input: $input) { redirectTo }
}`;

/**
 * La plataforma para desarrolladores: las aplicaciones de terceros que usan la
 * API en nombre de las personas, como las de Facebook.
 *
 * Aquí conviven los dos lados. El del desarrollador, que registra su
 * aplicación, guarda sus credenciales y configura el webhook; y el de la
 * persona, que ve la pantalla de «¿Autorizar esta aplicación?» y decide.
 */
@Injectable({ providedIn: 'root' })
export class DevelopersService {
  private readonly gql = inject(GraphqlClientService);

  apps(): Promise<DeveloperApp[]> {
    return this.gql.field(DEVELOPER_APPS);
  }

  app(id: string): Promise<DeveloperApp> {
    return this.gql.field(DEVELOPER_APP, { id });
  }

  create(request: CreateAppRequest): Promise<AppCredentials> {
    return this.gql.field(CREATE_APP, { input: request });
  }

  update(id: string, request: UpdateAppRequest): Promise<DeveloperApp> {
    return this.gql.field(UPDATE_APP, { id, input: request });
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_APP, { id });
  }

  setIcon(id: string, file: Blob): Promise<DeveloperApp> {
    return this.gql.field(SET_APP_ICON, { id, file });
  }

  setStatus(id: string, status: OAuthAppStatus): Promise<DeveloperApp> {
    return this.gql.field(SET_APP_STATUS, { id, status });
  }

  rotateSecret(id: string): Promise<AppCredentials> {
    return this.gql.field(ROTATE_SECRET, { id });
  }

  rotateWebhookSecret(id: string): Promise<AppCredentials> {
    return this.gql.field(ROTATE_WEBHOOK_SECRET, { id });
  }

  updateWebhook(id: string, request: UpdateWebhookRequest): Promise<AppCredentials> {
    return this.gql.field(UPDATE_WEBHOOK, { id, input: request });
  }

  verifyWebhook(id: string): Promise<DeveloperApp> {
    return this.gql.field(VERIFY_WEBHOOK, { id });
  }

  async sendTestWebhook(id: string): Promise<void> {
    await this.gql.request(TEST_WEBHOOK, { id });
  }

  addTester(id: string, username: string): Promise<DeveloperApp> {
    return this.gql.field(ADD_TESTER, { id, username });
  }

  removeTester(id: string, userId: string): Promise<DeveloperApp> {
    return this.gql.field(REMOVE_TESTER, { id, userId });
  }

  usage(id: string, hours = 24): Promise<ApiUsagePoint[]> {
    return this.gql.field(APP_USAGE, { id, hours });
  }

  deliveries(id: string, page = 1, perPage = 20): Promise<Paginated<WebhookDelivery>> {
    return this.gql.field(WEBHOOK_DELIVERIES, { id, page, perPage });
  }

  scopes(): Promise<OAuthScopeInfo[]> {
    return this.gql.field(OAUTH_SCOPES);
  }

  authorizationPreview(request: OAuthAuthorizeRequest): Promise<OAuthAuthorizationPreview> {
    return this.gql.field(AUTHORIZATION_PREVIEW, { input: request });
  }

  approve(request: OAuthAuthorizeRequest): Promise<OAuthAuthorizeResult> {
    return this.gql.field(APPROVE_AUTHORIZATION, { input: request });
  }

  deny(request: OAuthAuthorizeRequest): Promise<OAuthAuthorizeResult> {
    return this.gql.field(DENY_AUTHORIZATION, { input: request });
  }
}
