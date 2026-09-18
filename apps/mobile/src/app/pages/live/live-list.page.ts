import { ChangeDetectionStrategy, Component, type OnDestroy, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { LiveStream } from '@social-network/shared';

import { LiveService } from '../../core/api/live.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

/** Cada cuánto se refresca la lista mientras está abierta. */
const REFRESH_MS = 30_000;

/** Los directos en curso de las personas que puedes ver, y el botón de emitir. */
@Component({
  selector: 'app-live-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    AvatarComponent,
    CompactNumberPipe,
    FullNamePipe,
    RelativeTimePipe,
  ],
  template: `
    <app-page-header title="NAV.LIVE" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="rs-container wide">
        <header class="hero rs-card">
          <div>
            <h1>{{ 'LIVE.TITLE' | translate }}</h1>
            <p class="rs-muted">{{ 'LIVE.SUBTITLE' | translate }}</p>
          </div>
          @if (enabled()) {
            <ion-button color="danger" routerLink="/live/new">
              <ion-icon slot="start" name="videocam" /> {{ 'LIVE.GO_LIVE' | translate }}
            </ion-button>
          }
        </header>

        @if (!enabled() && !loading()) {
          <div class="rs-card notice">
            <ion-icon name="information-circle" />
            <span>{{ 'LIVE.DISABLED' | translate }}</span>
          </div>
        }

        <div class="grid">
          @for (stream of streams(); track stream.id) {
            <a class="tile" [routerLink]="['/live', stream.id]">
              <span class="poster">
                <app-avatar [user]="stream.host" [size]="88" ring="live" />
                <span class="badges">
                  <span class="rs-live-badge">{{ 'LIVE.BADGE' | translate }}</span>
                  <span class="viewers"><ion-icon name="eye" /> {{ stream.viewerCount | compactNumber }}</span>
                </span>
              </span>
              <span class="info">
                <span class="rs-strong rs-ellipsis">{{ stream.title || ('LIVE.UNTITLED' | translate) }}</span>
                <span class="rs-small rs-muted rs-ellipsis">{{ stream.host | fullName }} · {{ stream.startedAt | relativeTime }}</span>
              </span>
            </a>
          } @empty {
            @if (loading()) {
              <div class="rs-empty full"><ion-spinner /></div>
            } @else {
              <div class="rs-empty full">
                <ion-icon name="videocam-outline" />
                <h3>{{ 'LIVE.EMPTY_TITLE' | translate }}</h3>
                <p>{{ 'LIVE.EMPTY' | translate }}</p>
              </div>
            }
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .hero {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: space-between;
      padding: 20px;
    }

    h1 {
      font-size: 1.5rem;
    }

    p {
      margin: 4px 0 0;
    }

    .notice {
      align-items: center;
      display: flex;
      gap: 10px;
      padding: 12px 16px;
    }

    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      padding: 0 8px;
    }

    .tile {
      background: var(--rs-surface);
      border-radius: 10px;
      box-shadow: var(--rs-shadow-1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .poster {
      align-items: center;
      aspect-ratio: 9 / 12;
      background: linear-gradient(160deg, #2b2d42 0%, #8a3ab9 60%, #e1306c 100%);
      display: flex;
      justify-content: center;
      position: relative;
    }

    .badges {
      display: flex;
      gap: 6px;
      left: 8px;
      position: absolute;
      top: 8px;
    }

    .viewers {
      align-items: center;
      background: rgb(0 0 0 / 50%);
      border-radius: 4px;
      color: #fff;
      display: inline-flex;
      font-size: 0.75rem;
      gap: 4px;
      padding: 2px 6px;
    }

    .info {
      display: flex;
      flex-direction: column;
      padding: 10px 12px;
    }

    .full {
      grid-column: 1 / -1;
    }
  `,
})
export class LiveListPage implements OnInit, OnDestroy {
  private readonly live = inject(LiveService);

  readonly streams = signal<LiveStream[]>([]);
  readonly enabled = signal(false);
  readonly loading = signal(true);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.load();
    this.timer = setInterval(() => void this.load(), REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.load();
    await (event.target as HTMLIonRefresherElement).complete();
  }

  private async load(): Promise<void> {
    try {
      const [enabled, streams] = await Promise.all([this.live.enabled(), this.live.list()]);
      this.enabled.set(enabled);
      this.streams.set(streams);
    } catch {
      // Se reintenta en el siguiente ciclo.
    } finally {
      this.loading.set(false);
    }
  }
}
