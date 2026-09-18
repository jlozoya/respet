import { DestroyRef, ChangeDetectionStrategy, Component, type OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Notification } from '@social-network/shared';

import { NotificationsService, notificationLink } from '../../core/api/notifications.service';
import { NotificationItemComponent } from './notification-item.component';

/** Una hora: lo que llegó antes pasa a «Anteriores». */
const RECENT_MS = 24 * 60 * 60 * 1000;

/**
 * La lista de avisos, igual en el desplegable de la campana y en su pantalla.
 *
 * Se mantiene al día sola: un aviso nuevo, o uno que se agrupa con otro ya
 * existente, sube arriba en cuanto llega por la suscripción.
 */
@Component({
  selector: 'app-notifications-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonButton, IonIcon, IonSpinner, NotificationItemComponent],
  template: `
    <div class="head">
      <h2>{{ 'NOTIFICATIONS.TITLE' | translate }}</h2>
      @if (hasUnread()) {
        <button type="button" class="rs-text-btn mark" (click)="markAll()">
          <ion-icon name="checkmark-done" /> {{ 'NOTIFICATIONS.MARK_ALL_READ' | translate }}
        </button>
      }
    </div>

    <div class="rs-chips filters">
      <button type="button" class="rs-chip" [class.active]="filter() === 'all'" (click)="filter.set('all')">
        {{ 'NOTIFICATIONS.ALL' | translate }}
      </button>
      <button type="button" class="rs-chip" [class.active]="filter() === 'unread'" (click)="filter.set('unread')">
        {{ 'NOTIFICATIONS.UNREAD' | translate }}
      </button>
    </div>

    @if (recent().length) {
      <h3 class="section">{{ 'NOTIFICATIONS.NEW' | translate }}</h3>
      @for (item of recent(); track item.id) {
        <app-notification-item [notification]="item" [compact]="compact()" (selected)="open($event)" />
      }
    }

    @if (earlier().length) {
      <h3 class="section">{{ 'NOTIFICATIONS.EARLIER' | translate }}</h3>
      @for (item of earlier(); track item.id) {
        <app-notification-item [notification]="item" [compact]="compact()" (selected)="open($event)" />
      }
    }

    @if (loading()) {
      <div class="rs-empty"><ion-spinner /></div>
    } @else if (!visible().length) {
      <div class="rs-empty">
        <ion-icon name="notifications-outline" />
        <h3>{{ 'NOTIFICATIONS.EMPTY_TITLE' | translate }}</h3>
        <p>{{ 'NOTIFICATIONS.EMPTY' | translate }}</p>
      </div>
    }

    @if (cursor() && !loading()) {
      <ion-button class="rs-soft more" expand="block" (click)="loadMore()">
        {{ 'NOTIFICATIONS.SEE_PREVIOUS' | translate }}
      </ion-button>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 8px;
    }

    .head {
      align-items: center;
      display: flex;
      justify-content: space-between;
      padding: 4px 8px 8px;
    }

    h2 {
      font-size: 1.5rem;
    }

    .mark {
      align-items: center;
      color: var(--ion-color-primary);
      display: inline-flex;
      gap: 4px;
    }

    .filters {
      padding: 0 8px 4px;
    }

    .section {
      font-size: 1.0625rem;
      padding: 12px 8px 4px;
    }

    .more {
      margin: 8px;
    }
  `,
})
export class NotificationsPanelComponent implements OnInit {
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly compact = input(false);
  /** Se emite al abrir un aviso, para que el desplegable se cierre. */
  readonly navigated = output<void>();

  readonly items = signal<Notification[]>([]);
  readonly loading = signal(true);
  readonly cursor = signal<string | null>(null);
  readonly filter = signal<'all' | 'unread'>('all');

  readonly visible = computed(() =>
    this.filter() === 'unread' ? this.items().filter((item) => !item.read) : this.items(),
  );
  readonly recent = computed(() => this.visible().filter((item) => Date.now() - Date.parse(item.updatedAt) < RECENT_MS));
  readonly earlier = computed(() => this.visible().filter((item) => Date.now() - Date.parse(item.updatedAt) >= RECENT_MS));
  readonly hasUnread = computed(() => this.notifications.unreadCount() > 0);

  constructor() {
    this.notifications.incoming.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.type === 'all_read') {
        this.items.update((items) => items.map((item) => ({ ...item, read: true })));

        return;
      }

      const incoming = event.notification;

      if (incoming) {
        this.items.update((items) => [incoming, ...items.filter((item) => item.id !== incoming.id)]);
      }
    });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetch(null);
  }

  async loadMore(): Promise<void> {
    await this.fetch(this.cursor());
  }

  async open(item: Notification): Promise<void> {
    if (!item.read) {
      this.items.update((items) => items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
      void this.notifications.markRead([item.id]).catch(() => undefined);
    }

    this.navigated.emit();
    await this.router.navigateByUrl(notificationLink(item));
  }

  async markAll(): Promise<void> {
    this.items.update((items) => items.map((item) => ({ ...item, read: true })));
    await this.notifications.markAllRead().catch(() => undefined);
  }

  private async fetch(cursor: string | null): Promise<void> {
    this.loading.set(true);

    try {
      const page = await this.notifications.list(cursor);
      this.items.update((items) => (cursor ? [...items, ...page.data] : page.data));
      this.cursor.set(page.nextCursor);
    } catch {
      this.cursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
