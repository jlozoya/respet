import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type {
  ApiUsagePoint,
  AppCredentials,
  DeveloperApp,
  Paginated,
  WebhookDelivery as WebhookDeliveryDto,
} from '@respet/shared';
import { WEBHOOK_EVENTS } from '@respet/shared';

import { CryptoService } from '../auth/crypto.service.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { toIso, toMediaOrNull, toUserSummary, type MediaDoc, type UserSummaryDoc } from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { isValidObjectId, type Model, type Types } from '../database/mongoose.js';
import {
  ApiUsage,
  OAuthApp,
  OAuthGrant,
  OAuthRefreshToken,
  WebhookDelivery,
} from '../database/schemas/developer.schema.js';
import { OAuthAppStatus, OAuthClientType } from '../database/schemas/enums.js';
import { User } from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';
import type { PendingUpload } from '../media/upload.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import { assertPublicUrl } from './safe-url.js';
import { isKnownScope } from './scopes.js';

/** Aplicaciones por persona: un límite contra el registro masivo. */
const MAX_APPS_PER_OWNER = 20;
const MAX_TESTERS = 50;

type LeanApp = OAuthApp & {
  _id: Types.ObjectId;
  icon?: (MediaDoc & { _id: Types.ObjectId }) | null;
};

export interface AppInput {
  name?: string;
  description?: string;
  websiteUrl?: string | null;
  privacyPolicyUrl?: string | null;
  clientType?: OAuthClientType;
  redirectUris?: string[];
  allowedScopes?: string[];
}

/**
 * El portal para desarrolladores: las aplicaciones de cada persona.
 *
 * El secreto de una aplicación sólo se ve una vez, al crearla o rotarlo;
 * después sólo se guarda su hash, igual que una contraseña. Quien lo pierde
 * genera otro.
 */
@Injectable()
export class DeveloperAppsService {
  constructor(
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
    @InjectModel(OAuthGrant.name) private readonly grants: Model<OAuthGrant>,
    @InjectModel(OAuthRefreshToken.name) private readonly refreshTokens: Model<OAuthRefreshToken>,
    @InjectModel(WebhookDelivery.name) private readonly deliveries: Model<WebhookDelivery>,
    @InjectModel(ApiUsage.name) private readonly usage: Model<ApiUsage>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly crypto: CryptoService,
    private readonly media: MediaService,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  async listMine(ownerId: string): Promise<DeveloperApp[]> {
    const docs = (await this.apps.find({ ownerId }).sort({ createdAt: -1 }).populate('icon').lean()) as unknown as LeanApp[];

    return Promise.all(docs.map((doc) => this.present(doc)));
  }

  async findMine(appId: string, ownerId: string): Promise<DeveloperApp> {
    return this.present(await this.assertOwner(appId, ownerId));
  }

  async create(ownerId: string, input: AppInput): Promise<AppCredentials> {
    if ((await this.apps.countDocuments({ ownerId })) >= MAX_APPS_PER_OWNER) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, `You cannot have more than ${MAX_APPS_PER_OWNER} apps`);
    }

    const clientType = input.clientType ?? OAuthClientType.Confidential;
    const secret = clientType === OAuthClientType.Confidential ? this.newSecret() : null;

    const created = await this.apps.create({
      ownerId,
      name: input.name,
      description: input.description ?? '',
      websiteUrl: input.websiteUrl ?? null,
      privacyPolicyUrl: input.privacyPolicyUrl ?? null,
      clientId: this.crypto.randomToken(12).replace(/[-_]/g, '').slice(0, 16).padEnd(16, '0'),
      clientSecretHash: secret ? this.crypto.hashToken(secret) : null,
      clientSecretHint: secret ? secret.slice(-4) : null,
      clientType,
      redirectUris: this.validRedirectUris(input.redirectUris ?? []),
      allowedScopes: this.validScopes(input.allowedScopes),
    });

    return { app: await this.findMine(String(created._id), ownerId), clientSecret: secret, webhookSecret: null };
  }

  async update(appId: string, ownerId: string, input: AppInput): Promise<DeveloperApp> {
    await this.assertOwner(appId, ownerId);

    await this.apps.updateOne(
      { _id: appId },
      {
        $set: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
          ...(input.privacyPolicyUrl !== undefined ? { privacyPolicyUrl: input.privacyPolicyUrl } : {}),
          ...(input.redirectUris !== undefined ? { redirectUris: this.validRedirectUris(input.redirectUris) } : {}),
          ...(input.allowedScopes !== undefined ? { allowedScopes: this.validScopes(input.allowedScopes) } : {}),
        },
      },
    );

    return this.findMine(appId, ownerId);
  }

  /**
   * Genera un secreto nuevo. El anterior deja de valer en el acto; los tokens
   * ya emitidos siguen hasta caducar, porque el secreto sólo se usa al pedirlos.
   */
  async rotateSecret(appId: string, ownerId: string): Promise<AppCredentials> {
    const app = await this.assertOwner(appId, ownerId);

    if (app.clientType !== OAuthClientType.Confidential) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'Public clients do not have a secret');
    }

    const secret = this.newSecret();

    await this.apps.updateOne(
      { _id: appId },
      { $set: { clientSecretHash: this.crypto.hashToken(secret), clientSecretHint: secret.slice(-4) } },
    );

    return { app: await this.findMine(appId, ownerId), clientSecret: secret, webhookSecret: null };
  }

  /**
   * Publica la aplicación o la devuelve a desarrollo.
   *
   * Para publicarla hace falta una política de privacidad, como exige Facebook:
   * quien la autorice tiene que poder leer qué se hará con sus datos.
   */
  async setStatus(appId: string, ownerId: string, status: OAuthAppStatus): Promise<DeveloperApp> {
    const app = await this.assertOwner(appId, ownerId);

    if (app.status === OAuthAppStatus.Suspended) {
      throw AppException.forbidden('This app was suspended by the administrators');
    }

    if (status === OAuthAppStatus.Live && !app.privacyPolicyUrl) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'A privacy policy URL is required to go live');
    }

    if (status === OAuthAppStatus.Suspended) {
      throw AppException.forbidden('Only administrators can suspend apps');
    }

    await this.apps.updateOne({ _id: appId }, { $set: { status } });

    return this.findMine(appId, ownerId);
  }

  async remove(appId: string, ownerId: string): Promise<void> {
    const app = await this.assertOwner(appId, ownerId);
    await this.purge(app);
  }

  async setIcon(appId: string, ownerId: string, upload: PendingUpload): Promise<DeveloperApp> {
    const app = await this.assertOwner(appId, ownerId);
    const stored = await this.media.storeUpload(upload, { accept: ['image'], preset: 'icon', uploaderId: ownerId });

    await this.apps.updateOne({ _id: appId }, { $set: { iconId: stored._id } });

    if (app.iconId) {
      await this.media.remove(app.iconId);
    }

    return this.findMine(appId, ownerId);
  }

  async addTester(appId: string, ownerId: string, username: string): Promise<DeveloperApp> {
    const app = await this.assertOwner(appId, ownerId);
    const tester = await this.users.findOne({ name: username.toLowerCase().replace(/^@/, '') }).select('_id').lean();

    if (!tester) {
      throw AppException.notFound('User');
    }

    if (app.testerIds.length >= MAX_TESTERS) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, `An app cannot have more than ${MAX_TESTERS} testers`);
    }

    await this.apps.updateOne({ _id: appId }, { $addToSet: { testerIds: tester._id } });

    return this.findMine(appId, ownerId);
  }

  async removeTester(appId: string, ownerId: string, userId: string): Promise<DeveloperApp> {
    await this.assertOwner(appId, ownerId);
    await this.apps.updateOne({ _id: appId }, { $pull: { testerIds: userId } });

    return this.findMine(appId, ownerId);
  }

  /**
   * Configura el webhook.
   *
   * Cambiar la dirección obliga a verificarla otra vez. La primera vez se
   * genera el secreto de firma, que se devuelve para que la aplicación lo
   * guarde.
   */
  async updateWebhook(
    appId: string,
    ownerId: string,
    input: { url: string | null; events: string[]; active: boolean },
  ): Promise<AppCredentials> {
    const app = await this.assertOwner(appId, ownerId);
    const events = [...new Set(input.events)].filter((event) => (WEBHOOK_EVENTS as readonly string[]).includes(event));

    if (input.url) {
      try {
        await assertPublicUrl(input.url, !this.config.getOrThrow<boolean>('isProduction'));
      } catch (error) {
        throw AppException.badRequest(ErrorCode.ValidationFailed, error instanceof Error ? error.message : 'Invalid URL');
      }
    }

    let webhookSecret: string | null = null;
    let secretCiphertext = app.webhook?.secretCiphertext ?? null;

    if (!secretCiphertext) {
      webhookSecret = this.newSecret();
      secretCiphertext = this.crypto.encrypt(webhookSecret);
    }

    const urlChanged = (app.webhook?.url ?? null) !== input.url;

    await this.apps.updateOne(
      { _id: appId },
      {
        $set: {
          'webhook.url': input.url,
          'webhook.events': events,
          'webhook.active': input.active && Boolean(input.url),
          'webhook.secretCiphertext': secretCiphertext,
          ...(urlChanged ? { 'webhook.verifiedAt': null } : {}),
        },
      },
    );

    return { app: await this.findMine(appId, ownerId), clientSecret: null, webhookSecret };
  }

  async rotateWebhookSecret(appId: string, ownerId: string): Promise<AppCredentials> {
    await this.assertOwner(appId, ownerId);

    const webhookSecret = this.newSecret();

    await this.apps.updateOne(
      { _id: appId },
      { $set: { 'webhook.secretCiphertext': this.crypto.encrypt(webhookSecret) } },
    );

    return { app: await this.findMine(appId, ownerId), clientSecret: null, webhookSecret };
  }

  /**
   * Verifica la dirección del webhook con un reto, como hace Facebook.
   *
   * Se hace un `GET` con `hub.mode=subscribe`, `hub.challenge` y
   * `hub.verify_token` —el `client_id` de la aplicación—, y la respuesta tiene
   * que devolver el reto tal cual. Así se demuestra que quien controla esa
   * dirección es quien registró la aplicación.
   */
  async verifyWebhook(appId: string, ownerId: string): Promise<DeveloperApp> {
    const app = await this.assertOwner(appId, ownerId);

    if (!app.webhook?.url) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'Set a webhook URL first');
    }

    const url = await assertPublicUrl(app.webhook.url, !this.config.getOrThrow<boolean>('isProduction')).catch(
      (error: unknown) => {
        throw AppException.badRequest(ErrorCode.ValidationFailed, error instanceof Error ? error.message : 'Invalid URL');
      },
    );
    const challenge = this.crypto.randomToken(16);

    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.challenge', challenge);
    url.searchParams.set('hub.verify_token', app.clientId);

    const body = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
      .then(async (response) => (await response.text()).trim())
      .catch(() => '');

    if (body !== challenge) {
      throw new AppException(
        ErrorCode.ValidationFailed,
        HttpStatus.BAD_REQUEST,
        'The webhook did not echo the challenge',
      );
    }

    await this.apps.updateOne({ _id: appId }, { $set: { 'webhook.verifiedAt': new Date() } });

    return this.findMine(appId, ownerId);
  }

  async listDeliveries(appId: string, ownerId: string, page: number, perPage: number): Promise<Paginated<WebhookDeliveryDto>> {
    await this.assertOwner(appId, ownerId);

    const pagination = toPage({ page, perPage });
    const [docs, total] = await Promise.all([
      this.deliveries.find({ appId }).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.take).lean(),
      this.deliveries.countDocuments({ appId }),
    ]);

    return paginate(
      docs.map((doc) => ({
        id: String(doc._id),
        event: doc.event,
        status: doc.status,
        attempts: doc.attempts,
        responseStatus: doc.responseStatus,
        lastError: doc.lastError,
        createdAt: toIso(doc.createdAt),
        deliveredAt: toIso(doc.deliveredAt),
      })),
      total,
      pagination.page,
      pagination.perPage,
    );
  }

  /** Peticiones por hora de las últimas `hours` horas, con los huecos a cero. */
  async usageOf(appId: string, ownerId: string, hours: number): Promise<ApiUsagePoint[]> {
    await this.assertOwner(appId, ownerId);

    const span = Math.min(Math.max(hours, 1), 24 * 30);
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    const since = new Date(now.getTime() - (span - 1) * 3600_000);

    const docs = await this.usage.find({ appId, hour: { $gte: since } }).lean();
    const byHour = new Map(docs.map((doc) => [doc.hour.getTime(), doc]));

    return Array.from({ length: span }, (_, index) => {
      const hour = new Date(since.getTime() + index * 3600_000);
      const row = byHour.get(hour.getTime());

      return { hour: hour.toISOString(), requests: row?.requests ?? 0, errors: row?.errorCount ?? 0 };
    });
  }

  /** Borra una aplicación y todo lo que cuelga de ella, cortando el acceso en el acto. */
  private async purge(app: LeanApp): Promise<void> {
    const grants = await this.grants.find({ appId: app._id }).select('_id').lean();
    const grantIds = grants.map((grant) => grant._id);

    await Promise.all([
      this.apps.deleteOne({ _id: app._id }),
      this.grants.deleteMany({ appId: app._id }),
      this.refreshTokens.deleteMany({ grantId: { $in: grantIds } }),
      this.deliveries.deleteMany({ appId: app._id }),
      this.usage.deleteMany({ appId: app._id }),
    ]);

    if (app.iconId) {
      await this.media.remove(app.iconId);
    }

    await this.bus.publish(Topic.grantRevoked, { grantIds: grantIds.map(String) });
  }

  private async assertOwner(appId: string, ownerId: string): Promise<LeanApp> {
    if (!isValidObjectId(appId)) {
      throw AppException.notFound('App');
    }

    const app = (await this.apps.findOne({ _id: appId, ownerId }).populate('icon').lean()) as unknown as LeanApp | null;

    if (!app) {
      throw AppException.notFound('App');
    }

    return app;
  }

  private async present(doc: LeanApp): Promise<DeveloperApp> {
    const [testers, userCount] = await Promise.all([
      this.users.find({ _id: { $in: doc.testerIds } }).select('name firstName lastName avatarId verified').populate('avatar').lean(),
      this.grants.countDocuments({ appId: doc._id, revokedAt: null }),
    ]);

    return {
      id: String(doc._id),
      name: doc.name,
      description: doc.description,
      websiteUrl: doc.websiteUrl,
      privacyPolicyUrl: doc.privacyPolicyUrl,
      icon: toMediaOrNull(doc.icon),
      clientId: doc.clientId,
      clientSecretHint: doc.clientSecretHint,
      clientType: doc.clientType,
      status: doc.status,
      redirectUris: doc.redirectUris,
      allowedScopes: doc.allowedScopes,
      testers: testers.map((tester) => toUserSummary(tester as unknown as UserSummaryDoc & { _id: Types.ObjectId })),
      webhook: {
        url: doc.webhook?.url ?? null,
        events: doc.webhook?.events ?? [],
        active: doc.webhook?.active ?? false,
        verifiedAt: toIso(doc.webhook?.verifiedAt ?? null),
      },
      rateLimitPerHour: doc.rateLimitPerHour ?? this.config.getOrThrow<number>('oauth.rateLimitPerHour'),
      userCount,
      createdAt: toIso(doc.createdAt),
      updatedAt: toIso(doc.updatedAt),
    };
  }

  private newSecret(): string {
    return this.crypto.randomToken(32);
  }

  /**
   * Las direcciones de vuelta admitidas.
   *
   * Se comparan exactas al autorizar, sin comodines: un comodín es la forma
   * clásica de que un código de autorización acabe en manos ajenas. Se aceptan
   * HTTPS, `http://localhost` para desarrollo y esquemas propios de apps
   * móviles (`miapp://callback`).
   */
  private validRedirectUris(uris: string[]): string[] {
    const clean = [...new Set(uris.map((uri) => uri.trim()).filter(Boolean))];

    if (clean.length > 10) {
      throw AppException.badRequest(ErrorCode.InvalidRedirectUri, 'An app cannot have more than 10 redirect URIs');
    }

    for (const uri of clean) {
      let parsed: URL;

      try {
        parsed = new URL(uri);
      } catch {
        throw AppException.badRequest(ErrorCode.InvalidRedirectUri, `Invalid redirect URI: ${uri}`);
      }

      const isLocal = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      const isCustomScheme = !['http:', 'https:', 'javascript:', 'data:', 'file:'].includes(parsed.protocol);

      if (parsed.hash || !(parsed.protocol === 'https:' || isLocal || isCustomScheme)) {
        throw AppException.badRequest(ErrorCode.InvalidRedirectUri, `Invalid redirect URI: ${uri}`);
      }
    }

    return clean;
  }

  private validScopes(scopes: string[] | undefined): string[] {
    const list = [...new Set(['public_profile', ...(scopes ?? [])])];
    const unknown = list.filter((scope) => !isKnownScope(scope));

    if (unknown.length > 0) {
      throw AppException.badRequest(ErrorCode.InvalidScope, `Unknown scopes: ${unknown.join(', ')}`);
    }

    return list;
  }
}
