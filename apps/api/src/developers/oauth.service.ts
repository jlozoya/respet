import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type {
  AuthorizedApp,
  OAuthAuthorizationPreview,
  OAuthAuthorizeRequest,
  OAuthAuthorizeResult,
  OAuthTokenResponse,
} from '@social-network/shared';

import { CryptoService } from '../auth/crypto.service.js';
import { SecurityAlertsService } from '../auth/security/security-alerts.service.js';
import { SecurityEventsService } from '../auth/security/security-events.service.js';
import { TokenService } from '../auth/token.service.js';
import type { ClientInfo } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { toIso, toMediaOrNull, toUserSummary, type MediaDoc } from '../common/mappers.js';
import { isValidObjectId, type Model, type Types } from '../database/mongoose.js';
import {
  OAuthApp,
  OAuthAuthorizationCode,
  OAuthGrant,
  OAuthRefreshToken,
} from '../database/schemas/developer.schema.js';
import { OAuthAppStatus, OAuthClientType, SecurityEventType } from '../database/schemas/enums.js';
import { User } from '../database/schemas/user.schema.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import { describeScopes, isKnownScope, parseScopes } from './scopes.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type LeanApp = OAuthApp & {
  _id: Types.ObjectId;
  icon?: (MediaDoc & { _id: Types.ObjectId }) | null;
};

/**
 * Un error de OAuth con el código que define RFC 6749.
 *
 * Los extremos HTTP lo devuelven como `{ error, error_description }`, que es lo
 * que esperan las bibliotecas de OAuth; por GraphQL viaja como cualquier otro
 * error, con la clave traducible.
 */
export class OAuthError extends AppException {
  constructor(
    readonly oauthCode:
      | 'invalid_request'
      | 'invalid_client'
      | 'invalid_grant'
      | 'unauthorized_client'
      | 'unsupported_grant_type'
      | 'invalid_scope'
      | 'access_denied',
    description: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    const code =
      oauthCode === 'invalid_client'
        ? ErrorCode.InvalidClient
        : oauthCode === 'invalid_scope'
          ? ErrorCode.InvalidScope
          : oauthCode === 'invalid_grant'
            ? ErrorCode.InvalidGrant
            : ErrorCode.ValidationFailed;

    super(code, status, description);
  }
}

/**
 * OAuth 2.0: cómo una aplicación de terceros consigue actuar en nombre de
 * alguien, como con «Iniciar sesión con Facebook».
 *
 * El flujo es el de código de autorización (RFC 6749) con PKCE (RFC 7636):
 *
 * 1. La aplicación manda a la persona a `/oauth/authorize` de la web de
 *    la red con su `client_id`, la dirección de vuelta y los permisos.
 * 2. La persona ve qué pide y aprueba. La red la devuelve a la aplicación con
 *    un código de un solo uso que caduca en diez minutos.
 * 3. La aplicación canjea el código —con su secreto, o con el verificador PKCE
 *    si es una app móvil que no puede guardar secretos— por un access token de
 *    una hora y un refresh token de dos meses.
 *
 * El consentimiento queda guardado: volver a autorizar no pregunta lo ya
 * concedido, y retirarlo desde «Apps y sitios web» corta el acceso en el acto.
 */
@Injectable()
export class OAuthService {
  constructor(
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
    @InjectModel(OAuthAuthorizationCode.name) private readonly codes: Model<OAuthAuthorizationCode>,
    @InjectModel(OAuthGrant.name) private readonly grants: Model<OAuthGrant>,
    @InjectModel(OAuthRefreshToken.name) private readonly refreshTokens: Model<OAuthRefreshToken>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly events: SecurityEventsService,
    private readonly alerts: SecurityAlertsService,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  /** Lo que se enseña en la pantalla de consentimiento, ya validado. */
  async preview(
    userId: string,
    request: OAuthAuthorizeRequest,
  ): Promise<OAuthAuthorizationPreview> {
    const { app, scopes, redirectUri } = await this.validateRequest(userId, request);
    const grant = await this.grants
      .findOne({ appId: app._id, userId, revokedAt: null })
      .select('scopes')
      .lean();
    const owner = await this.users
      .findById(app.ownerId)
      .select('name firstName lastName avatarId verified')
      .populate('avatar')
      .lean();

    return {
      app: {
        name: app.name,
        description: app.description,
        icon: toMediaOrNull(app.icon),
        websiteUrl: app.websiteUrl,
        privacyPolicyUrl: app.privacyPolicyUrl,
        owner: toUserSummary(owner),
        inDevelopment: app.status === OAuthAppStatus.Development,
      },
      requestedScopes: describeScopes(scopes),
      alreadyGranted: grant?.scopes.filter((scope) => scopes.includes(scope)) ?? [],
      redirectUri,
    };
  }

  /** La persona aprueba: se guarda el consentimiento y se emite el código. */
  async approve(
    userId: string,
    request: OAuthAuthorizeRequest,
    client: ClientInfo,
  ): Promise<OAuthAuthorizeResult> {
    const { app, scopes, redirectUri } = await this.validateRequest(userId, request);

    const existing = await this.grants.findOne({ appId: app._id, userId }).lean();
    const merged = [
      ...new Set([...(existing && !existing.revokedAt ? existing.scopes : []), ...scopes]),
    ];

    await this.grants.updateOne(
      { appId: app._id, userId },
      { $set: { scopes: merged, revokedAt: null }, $setOnInsert: { appId: app._id, userId } },
      { upsert: true },
    );

    const code = this.crypto.randomToken(32);

    await this.codes.create({
      codeHash: this.crypto.hashToken(code),
      appId: app._id,
      userId,
      redirectUri,
      scopes,
      codeChallenge: request.codeChallenge ?? null,
      codeChallengeMethod: request.codeChallenge
        ? ((request.codeChallengeMethod as 'S256' | 'plain') ?? 'plain')
        : null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    if (!existing || existing.revokedAt) {
      await this.events.record(userId, SecurityEventType.AppAuthorized, client, {
        appName: app.name,
      });
      await this.alerts.send(userId, 'app_authorized', client, [app.name]);
    }

    return { redirectTo: this.redirectWith(redirectUri, { code, state: request.state }) };
  }

  /** La persona rechaza: se vuelve a la aplicación con `access_denied`. */
  async deny(userId: string, request: OAuthAuthorizeRequest): Promise<OAuthAuthorizeResult> {
    const { redirectUri } = await this.validateRequest(userId, request);

    return {
      redirectTo: this.redirectWith(redirectUri, {
        error: 'access_denied',
        error_description: 'The user denied the request',
        state: request.state,
      }),
    };
  }

  /** Canjea un código de autorización por tokens. */
  async exchangeCode(params: {
    clientId: string;
    clientSecret?: string;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenResponse> {
    const app = await this.authenticateClient(
      params.clientId,
      params.clientSecret,
      Boolean(params.codeVerifier),
    );

    const record = await this.codes
      .findOneAndUpdate(
        // Se consume de forma atómica: un código sólo se canjea una vez.
        { codeHash: this.crypto.hashToken(params.code), consumedAt: null },
        { $set: { consumedAt: new Date() } },
        { returnDocument: 'before' },
      )
      .lean();

    if (!record || record.expiresAt <= new Date() || String(record.appId) !== String(app._id)) {
      throw new OAuthError(
        'invalid_grant',
        'The authorization code is invalid, expired or already used',
      );
    }

    if (record.redirectUri !== params.redirectUri) {
      throw new OAuthError(
        'invalid_grant',
        'redirect_uri does not match the one used to authorize',
      );
    }

    if (record.codeChallenge) {
      if (!params.codeVerifier) {
        throw new OAuthError('invalid_grant', 'code_verifier is required');
      }

      const computed =
        record.codeChallengeMethod === 'S256'
          ? this.crypto.sha256Base64Url(params.codeVerifier)
          : params.codeVerifier;

      if (!this.crypto.safeEqual(computed, record.codeChallenge)) {
        throw new OAuthError('invalid_grant', 'code_verifier does not match the challenge');
      }
    } else if (app.clientType === OAuthClientType.Public) {
      throw new OAuthError('invalid_grant', 'Public clients must use PKCE');
    }

    const grant = await this.grants
      .findOne({ appId: app._id, userId: record.userId, revokedAt: null })
      .lean();

    if (!grant) {
      throw new OAuthError('invalid_grant', 'The authorization was revoked');
    }

    return this.issueTokens(app, grant, record.scopes);
  }

  /** Canjea un refresh token de aplicación. Rota en cada uso. */
  async refresh(params: {
    clientId: string;
    clientSecret?: string;
    refreshToken: string;
  }): Promise<OAuthTokenResponse> {
    const app = await this.authenticateClient(params.clientId, params.clientSecret, true);
    const hash = this.crypto.hashToken(params.refreshToken);
    const stored = await this.refreshTokens.findOne({ tokenHash: hash }).lean();

    if (!stored) {
      throw new OAuthError('invalid_grant', 'The refresh token is not valid');
    }

    if (stored.revokedAt || stored.rotatedAt) {
      // Un refresh token ya canjeado que vuelve a aparecer: se cortan todos los
      // de ese consentimiento y la aplicación tendrá que volver a autorizarse.
      await this.refreshTokens.updateMany(
        { grantId: stored.grantId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      throw new OAuthError('invalid_grant', 'The refresh token was already used');
    }

    if (stored.expiresAt <= new Date()) {
      throw new OAuthError('invalid_grant', 'The refresh token has expired');
    }

    const grant = await this.grants.findOne({ _id: stored.grantId, revokedAt: null }).lean();

    if (!grant || String(grant.appId) !== String(app._id)) {
      throw new OAuthError('invalid_grant', 'The authorization was revoked');
    }

    const rotated = await this.refreshTokens.updateOne(
      { _id: stored._id, rotatedAt: null, revokedAt: null },
      { $set: { rotatedAt: new Date() } },
    );

    if (rotated.modifiedCount === 0) {
      throw new OAuthError('invalid_grant', 'The refresh token was already used');
    }

    // Nunca más permisos que los que la persona sigue concediendo.
    const scopes = stored.scopes.filter((scope) => grant.scopes.includes(scope));

    return this.issueTokens(app, grant, scopes);
  }

  /** RFC 7009: revocar un token. Responde igual exista o no. */
  async revokeToken(params: {
    clientId: string;
    clientSecret?: string;
    token: string;
  }): Promise<void> {
    await this.authenticateClient(params.clientId, params.clientSecret, true);
    await this.refreshTokens.updateOne(
      { tokenHash: this.crypto.hashToken(params.token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  /** «Apps y sitios web»: lo que la persona ha autorizado. */
  async authorizedApps(userId: string): Promise<AuthorizedApp[]> {
    const grants = await this.grants
      .find({ userId, revokedAt: null })
      .sort({ updatedAt: -1 })
      .populate({ path: 'app', populate: { path: 'icon' } })
      .lean();

    return grants
      .filter((grant) => (grant as { app?: unknown }).app)
      .map((grant) => {
        const app = (grant as unknown as { app: LeanApp }).app;

        return {
          id: String(grant._id),
          appId: String(app._id),
          name: app.name,
          icon: toMediaOrNull(app.icon),
          websiteUrl: app.websiteUrl,
          scopes: describeScopes(grant.scopes),
          createdAt: toIso(grant.createdAt),
          lastUsedAt: toIso(grant.lastUsedAt),
        };
      });
  }

  async revokeGrant(userId: string, grantId: string, client: ClientInfo): Promise<void> {
    if (!isValidObjectId(grantId)) {
      throw AppException.notFound('Authorization');
    }

    const grant = await this.grants
      .findOneAndUpdate(
        { _id: grantId, userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .populate('app')
      .lean();

    if (!grant) {
      throw AppException.notFound('Authorization');
    }

    await this.refreshTokens.updateMany(
      { grantId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    await this.bus.publish(Topic.grantRevoked, { grantIds: [grantId] });
    await this.events.record(userId, SecurityEventType.AppRevoked, client, {
      appName: (grant as unknown as { app?: { name?: string } }).app?.name,
    });
  }

  /** Apunta el último uso de un consentimiento, a lo sumo una vez por hora. */
  async touchGrant(grantId: string): Promise<void> {
    await this.grants.updateOne(
      {
        _id: grantId,
        $or: [{ lastUsedAt: null }, { lastUsedAt: { $lt: new Date(Date.now() - 3600_000) } }],
      },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  private async issueTokens(
    app: LeanApp,
    grant: OAuthGrant & { _id: Types.ObjectId },
    scopes: string[],
  ): Promise<OAuthTokenResponse> {
    const user = await this.users.findById(grant.userId).select('role').lean();

    if (!user) {
      throw new OAuthError('invalid_grant', 'The account no longer exists');
    }

    const access = await this.tokens.signAppToken(
      { id: String(grant.userId), role: user.role },
      { grantId: String(grant._id), clientId: app.clientId, scopes },
    );

    const refreshToken = this.crypto.randomToken(32);

    await this.refreshTokens.create({
      tokenHash: this.crypto.hashToken(refreshToken),
      grantId: grant._id,
      scopes,
      expiresAt: new Date(
        Date.now() + this.config.getOrThrow<number>('oauth.refreshTtlDays') * DAY_MS,
      ),
    });

    await this.touchGrant(String(grant._id));

    return {
      access_token: access.token,
      token_type: 'Bearer',
      expires_in: access.expiresIn,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  /**
   * Autentica a la aplicación que pide tokens.
   *
   * Una confidencial tiene que presentar su secreto. Una pública no tiene
   * secreto que presentar: su garantía es PKCE, que se comprueba al canjear el
   * código.
   */
  private async authenticateClient(
    clientId: string,
    clientSecret: string | undefined,
    allowPublic: boolean,
  ): Promise<LeanApp> {
    const app = (await this.apps.findOne({ clientId }).lean()) as unknown as LeanApp | null;

    if (!app || app.status === OAuthAppStatus.Suspended) {
      throw new OAuthError(
        'invalid_client',
        'Unknown or suspended client',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (app.clientType === OAuthClientType.Confidential) {
      if (
        !clientSecret ||
        !app.clientSecretHash ||
        !this.crypto.safeEqual(this.crypto.hashToken(clientSecret), app.clientSecretHash)
      ) {
        throw new OAuthError(
          'invalid_client',
          'Client authentication failed',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } else if (!allowPublic) {
      throw new OAuthError(
        'unauthorized_client',
        'Public clients must use PKCE',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return app;
  }

  private async validateRequest(
    userId: string,
    request: OAuthAuthorizeRequest,
  ): Promise<{ app: LeanApp; scopes: string[]; redirectUri: string }> {
    const app = (await this.apps
      .findOne({ clientId: request.clientId })
      .populate('icon')
      .lean()) as unknown as LeanApp | null;

    if (!app || app.status === OAuthAppStatus.Suspended) {
      throw new OAuthError('invalid_client', 'Unknown or suspended client');
    }

    // La dirección de vuelta se valida antes que nada y exacta: si no
    // coincide, no se redirige a ningún sitio, porque redirigir a una dirección
    // no registrada es exactamente lo que buscaría quien intenta robar códigos.
    if (!app.redirectUris.includes(request.redirectUri)) {
      throw AppException.badRequest(
        ErrorCode.InvalidRedirectUri,
        'redirect_uri is not registered for this app',
      );
    }

    if (request.responseType && request.responseType !== 'code') {
      throw new OAuthError('invalid_request', 'Only response_type=code is supported');
    }

    const scopes = parseScopes(request.scope);
    const unknown = scopes.filter((scope) => !isKnownScope(scope));
    const notAllowed = scopes.filter(
      (scope) => !app.allowedScopes.includes(scope) && scope !== 'public_profile',
    );

    if (unknown.length > 0 || notAllowed.length > 0) {
      throw new OAuthError(
        'invalid_scope',
        `Scopes not allowed for this app: ${[...unknown, ...notAllowed].join(', ')}`,
      );
    }

    if (app.clientType === OAuthClientType.Public && !request.codeChallenge) {
      throw new OAuthError('invalid_request', 'Public clients must send a PKCE code_challenge');
    }

    if (request.codeChallengeMethod && !['S256', 'plain'].includes(request.codeChallengeMethod)) {
      throw new OAuthError('invalid_request', 'code_challenge_method must be S256 or plain');
    }

    if (app.status === OAuthAppStatus.Development) {
      const isMember =
        String(app.ownerId) === userId || app.testerIds.some((tester) => String(tester) === userId);

      if (!isMember) {
        throw new OAuthError(
          'access_denied',
          'This app is in development and only its developers and testers can use it',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return { app, scopes, redirectUri: request.redirectUri };
  }

  private redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
    const url = new URL(redirectUri);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }
}
