import { Injectable, inject, signal } from '@angular/core';
import type { Notification, NotificationEvent, NotificationPage } from '@social-network/shared';
import { Subject, type Subscription } from 'rxjs';

import { RealtimeService } from '../realtime/realtime.service';
import { NOTIFICATION_FRAGMENTS, gql } from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const NOTIFICATIONS = gql(
  `query Notifications($cursor: String, $limit: Int) {
    notifications(cursor: $cursor, limit: $limit) {
      data { ...NotificationFields }
      nextCursor
      unreadCount
    }
  }`,
  ...NOTIFICATION_FRAGMENTS,
);

const UNREAD_COUNT = `query UnreadNotificationCount { unreadNotificationCount }`;
const MARK_READ = `mutation MarkNotificationsRead($ids: [ID!]!) { markNotificationsRead(ids: $ids) }`;
const MARK_ALL_READ = `mutation MarkAllNotificationsRead { markAllNotificationsRead }`;

const REGISTER_PUSH_DEVICE = `
mutation RegisterPushDevice($input: RegisterPushDeviceInput!) { registerPushDevice(input: $input) }`;

const UNREGISTER_PUSH_DEVICE = `
mutation UnregisterPushDevice($token: String!) { unregisterPushDevice(token: $token) }`;

const NOTIFICATION_EVENTS = gql(
  `subscription NotificationEvents {
    notificationEvents {
      type
      unreadCount
      notification { ...NotificationFields }
    }
  }`,
  ...NOTIFICATION_FRAGMENTS,
);

/**
 * Los avisos: quién reaccionó, comentó, empezó a seguirte o está en directo.
 *
 * El contador de la campana vive aquí, en una señal, y se mantiene al día con
 * la suscripción: el servidor manda el número ya calculado en cada aviso, así
 * que dos pestañas abiertas nunca enseñan cifras distintas.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly gql = inject(GraphqlClientService);
  private readonly realtime = inject(RealtimeService);

  private readonly unreadSignal = signal(0);
  private readonly incomingSubject = new Subject<NotificationEvent>();
  private subscription: Subscription | null = null;

  readonly unreadCount = this.unreadSignal.asReadonly();
  /** Los avisos según llegan, para la lista abierta y el aviso emergente. */
  readonly incoming = this.incomingSubject.asObservable();

  /** Empieza a escuchar. La llama el armazón al abrirse la sesión. */
  start(): void {
    if (this.subscription) {
      return;
    }

    void this.refreshCount();

    this.subscription = this.realtime
      .subscribe<{ notificationEvents: NotificationEvent }>(NOTIFICATION_EVENTS)
      .subscribe({
        next: ({ notificationEvents }) => {
          this.unreadSignal.set(notificationEvents.unreadCount);
          this.incomingSubject.next(notificationEvents);
        },
        error: () => {
          this.subscription = null;
        },
      });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.unreadSignal.set(0);
  }

  async refreshCount(): Promise<void> {
    try {
      this.unreadSignal.set(await this.gql.field<number>(UNREAD_COUNT));
    } catch {
      // El contador es un adorno: si falla, se queda como estaba.
    }
  }

  async list(cursor?: string | null, limit = 20): Promise<NotificationPage> {
    const page = await this.gql.field<NotificationPage>(NOTIFICATIONS, { cursor, limit });
    this.unreadSignal.set(page.unreadCount);

    return page;
  }

  async markRead(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    this.unreadSignal.set(await this.gql.field<number>(MARK_READ, { ids }));
  }

  async markAllRead(): Promise<void> {
    await this.gql.request(MARK_ALL_READ);
    this.unreadSignal.set(0);
  }

  async registerPushDevice(token: string, platform: 'android' | 'ios' | 'web'): Promise<void> {
    await this.gql.request(REGISTER_PUSH_DEVICE, { input: { token, platform } });
  }

  async unregisterPushDevice(token: string): Promise<void> {
    await this.gql.request(UNREGISTER_PUSH_DEVICE, { token });
  }
}

/** Adónde lleva un aviso al tocarlo. */
export function notificationLink(notification: Notification): string {
  const actor = notification.actors[0];

  switch (notification.type) {
    case 'follow':
    case 'follow_accepted':
      return actor ? `/profile/${actor.name}` : '/notifications';
    case 'follow_request':
      return '/follow-requests';
    case 'story_reaction':
      return notification.storyId ? `/stories/archive` : '/notifications';
    case 'live_started':
      return notification.liveStreamId ? `/live/${notification.liveStreamId}` : '/live';
    case 'security_alert':
      return '/settings/security';
    default:
      return notification.postId ? `/post/${notification.postId}` : '/notifications';
  }
}
