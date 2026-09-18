import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { WEBHOOK_EVENTS, type Branding, type WebhookEvent } from '@social-network/shared';
import { createHash, createHmac, randomUUID } from 'node:crypto';

import { CryptoService } from '../auth/crypto.service.js';
import { type Model, type Types } from '../database/mongoose.js';
import { ConversationMember } from '../database/schemas/chat.schema.js';
import { OAuthApp, OAuthGrant, WebhookDelivery } from '../database/schemas/developer.schema.js';
import { WebhookDeliveryStatus } from '../database/schemas/enums.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import { assertPublicUrl } from './safe-url.js';

/** Esperas entre reintentos: un minuto, cinco, media hora, dos horas, seis, un día. */
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 86_400_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const WORK_EVERY_MS = 5000;
const BATCH = 20;

/** Qué permiso tiene que haber concedido la persona para que su aplicación se entere de cada evento. */
const EVENT_SCOPE: Record<WebhookEvent, string> = {
  'post.created': 'user_posts',
  'post.deleted': 'user_posts',
  'comment.created': 'user_posts',
  'reaction.added': 'user_posts',
  'follow.created': 'user_follows',
  'story.created': 'user_stories',
  'live.started': 'live_videos',
  'live.ended': 'live_videos',
  'message.created': 'read_messages',
  'user.updated': 'public_profile',
};

interface DomainPayload {
  userId?: string;
  followerId?: string;
  followeeId?: string;
  senderId?: string;
  memberIds?: string[];
  conversationId?: string;
  [key: string]: unknown;
}

/**
 * Webhooks de las aplicaciones de terceros.
 *
 * Escucha los hechos del dominio y, para cada aplicación suscrita a ese evento
 * y autorizada por alguna de las personas implicadas con el permiso
 * correspondiente, deja una entrega pendiente. Un trabajador las envía con su
 * firma y reintenta con esperas crecientes durante un día.
 *
 * Lo que viaja son identificadores, no contenido: la aplicación pide después
 * lo que necesite por la API, y ahí se vuelven a aplicar los permisos y la
 * privacidad del momento.
 */
@Injectable()
export class WebhookDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private readonly unsubscribers: (() => void)[] = [];
  private worker?: NodeJS.Timeout;
  private working = false;

  constructor(
    @InjectModel(OAuthApp.name) private readonly apps: Model<OAuthApp>,
    @InjectModel(OAuthGrant.name) private readonly grants: Model<OAuthGrant>,
    @InjectModel(WebhookDelivery.name) private readonly deliveries: Model<WebhookDelivery>,
    @InjectModel(ConversationMember.name) private readonly members: Model<ConversationMember>,
    private readonly bus: EventBusService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  /** El nombre de la instalación, que viaja en la cabecera y en la entrega de prueba. */
  private brandName(): string {
    return this.config.getOrThrow<Branding>('branding').name;
  }

  onModuleInit(): void {
    for (const event of WEBHOOK_EVENTS) {
      this.unsubscribers.push(
        this.bus.on<DomainPayload>(Topic.domain(event), (payload) => {
          void this.enqueue(event, payload);
        }),
      );
    }

    this.worker = setInterval(() => void this.work(), WORK_EVERY_MS);
    this.worker.unref();
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    if (this.worker) {
      clearInterval(this.worker);
    }
  }

  /** Una entrega de prueba, a petición del desarrollador. */
  async sendTest(appId: string): Promise<void> {
    await this.deliveries.create({
      appId,
      event: 'test',
      dedupeKey: randomUUID(),
      payload: { message: `This is a test delivery from ${this.brandName()}` },
      nextAttemptAt: new Date(),
    });
  }

  private async enqueue(event: WebhookEvent, payload: DomainPayload): Promise<void> {
    try {
      const userIds = await this.usersInvolved(event, payload);

      if (userIds.length === 0) {
        return;
      }

      const apps = await this.apps
        .find({
          'webhook.active': true,
          'webhook.verifiedAt': { $ne: null },
          'webhook.events': event,
          status: { $ne: 'suspended' },
        })
        .select('_id')
        .lean();

      if (apps.length === 0) {
        return;
      }

      const grants = await this.grants
        .find({
          appId: { $in: apps.map((app) => app._id) },
          userId: { $in: userIds },
          revokedAt: null,
          scopes: EVENT_SCOPE[event],
        })
        .select('appId userId')
        .lean();

      const dedupeKey = createHash('sha256')
        .update(`${event}:${JSON.stringify(payload)}`)
        .digest('hex');
      const byApp = new Map<string, Types.ObjectId[]>();

      for (const grant of grants) {
        const list = byApp.get(String(grant.appId)) ?? [];
        list.push(grant.userId);
        byApp.set(String(grant.appId), list);
      }

      for (const [appId, users] of byApp) {
        await this.deliveries
          .create({
            appId,
            event,
            dedupeKey,
            payload: { ...this.publicFields(payload), userIds: users.map(String) },
            nextAttemptAt: new Date(),
          })
          // Otra instancia ya la encoló: el índice único lo dice.
          .catch((error: unknown) => {
            if ((error as { code?: number }).code !== 11000) {
              throw error;
            }
          });
      }
    } catch (error) {
      this.logger.warn(`No se pudo encolar el webhook ${event}: ${String(error)}`);
    }
  }

  private async work(): Promise<void> {
    if (this.working) {
      return;
    }

    this.working = true;

    try {
      for (let index = 0; index < BATCH; index += 1) {
        // Se reserva de forma atómica: con varias instancias, cada entrega la
        // envía una sola.
        const delivery = await this.deliveries
          .findOneAndUpdate(
            { status: WebhookDeliveryStatus.Pending, nextAttemptAt: { $lte: new Date() } },
            { $set: { nextAttemptAt: new Date(Date.now() + 120_000) }, $inc: { attempts: 1 } },
            { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
          )
          .lean();

        if (!delivery) {
          break;
        }

        await this.deliver(delivery);
      }
    } finally {
      this.working = false;
    }
  }

  private async deliver(delivery: WebhookDelivery & { _id: Types.ObjectId }): Promise<void> {
    const app = await this.apps.findById(delivery.appId).select('webhook').lean();

    if (!app?.webhook?.url || !app.webhook.secretCiphertext) {
      await this.deliveries.updateOne(
        { _id: delivery._id },
        {
          $set: { status: WebhookDeliveryStatus.Failed, lastError: 'Webhook no longer configured' },
        },
      );

      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: String(delivery._id),
      event: delivery.event,
      createdAt: delivery.createdAt.toISOString(),
      data: delivery.payload,
    });
    const secret = this.crypto.decrypt(app.webhook.secretCiphertext);
    // La marca de tiempo va dentro de lo firmado para que una entrega
    // interceptada no se pueda reenviar días después.
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    let status: number | null = null;
    let error: string;

    try {
      const url = await assertPublicUrl(
        app.webhook.url,
        !this.config.getOrThrow<boolean>('isProduction'),
      );
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'content-type': 'application/json',
          'user-agent': `${this.brandName().replace(/\s+/g, '-')}-Webhooks/1.0`,
          'x-webhook-event': delivery.event,
          'x-webhook-delivery': String(delivery._id),
          'x-webhook-timestamp': String(timestamp),
          'x-webhook-signature-256': `sha256=${signature}`,
        },
        body,
      });

      status = response.status;

      if (response.ok) {
        await this.deliveries.updateOne(
          { _id: delivery._id },
          {
            $set: {
              status: WebhookDeliveryStatus.Delivered,
              responseStatus: status,
              deliveredAt: new Date(),
              lastError: null,
            },
          },
        );

        return;
      }

      error = `HTTP ${status}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message.slice(0, 200) : 'Request failed';
    }

    const exhausted = delivery.attempts >= MAX_ATTEMPTS;

    await this.deliveries.updateOne(
      { _id: delivery._id },
      {
        $set: {
          status: exhausted ? WebhookDeliveryStatus.Failed : WebhookDeliveryStatus.Pending,
          responseStatus: status,
          lastError: error,
          nextAttemptAt: new Date(
            Date.now() + (BACKOFF_MS[delivery.attempts - 1] ?? BACKOFF_MS.at(-1) ?? 60_000),
          ),
        },
      },
    );
  }

  /** Las personas cuya autorización permite a una aplicación enterarse de este hecho. */
  private async usersInvolved(event: WebhookEvent, payload: DomainPayload): Promise<string[]> {
    switch (event) {
      case 'follow.created':
        return [payload.followerId, payload.followeeId].filter((id): id is string => Boolean(id));
      case 'message.created':
        if (payload.memberIds) {
          return payload.memberIds;
        }

        return (
          await this.members
            .find({ conversationId: payload.conversationId, leftAt: null })
            .select('userId')
            .lean()
        ).map((member) => String(member.userId));
      default:
        return payload.userId ? [payload.userId] : [];
    }
  }

  /** Sólo identificadores: nada de contenido que haya que proteger por el camino. */
  private publicFields(payload: DomainPayload): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) =>
          key !== 'memberIds' && (typeof value === 'string' || typeof value === 'number'),
      ),
    );
  }
}
