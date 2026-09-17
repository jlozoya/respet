import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';
import type { PostFeed } from '@respet/shared';

import { ComposerCardComponent } from '../../components/feed/composer-card.component';
import { PostFeedComponent } from '../../components/feed/post-feed.component';
import { BrandComponent } from '../../components/shell/brand.component';
import { LeftRailComponent } from '../../components/shell/left-rail.component';
import { RightRailComponent } from '../../components/shell/right-rail.component';
import { StoriesTrayComponent } from '../../components/stories/stories-tray.component';
import { NotificationsService } from '../../core/api/notifications.service';
import { StoriesService } from '../../core/api/stories.service';

/**
 * El inicio: historias, «¿Qué estás pensando?» y el muro.
 *
 * En el escritorio, con los atajos a la izquierda y contactos y sugerencias a
 * la derecha, como Facebook; en el móvil, una sola columna con la cabecera de
 * Instagram —la marca, crear y los avisos—.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonIcon,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    BrandComponent,
    ComposerCardComponent,
    PostFeedComponent,
    StoriesTrayComponent,
    LeftRailComponent,
    RightRailComponent,
  ],
  template: `
    <ion-header class="rs-mobile-only">
      <ion-toolbar>
        <app-brand slot="start" class="brand" [wordmark]="true" />
        <ion-buttons slot="end">
          <a routerLink="/notifications" class="rs-icon-btn plain" [attr.aria-label]="'NAV.NOTIFICATIONS' | translate">
            <ion-icon name="heart-outline" />
            @if (notifications.unreadCount() > 0) {
              <span class="rs-badge">{{ notifications.unreadCount() > 99 ? '99+' : notifications.unreadCount() }}</span>
            }
          </a>
          <a routerLink="/menu" class="rs-icon-btn plain" [attr.aria-label]="'NAV.MENU' | translate">
            <ion-icon name="menu" />
          </a>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="layout">
        <aside class="left">
          <app-left-rail />
        </aside>

        <main class="center">
          <div class="rs-card tray-card">
            <app-stories-tray />
          </div>

          <app-composer-card />

          <div class="tabs rs-card">
            <button type="button" class="rs-chip" [class.active]="feed() === 'home'" (click)="feed.set('home')">
              {{ 'FEED.FOR_YOU' | translate }}
            </button>
            <button type="button" class="rs-chip" [class.active]="feed() === 'following'" (click)="feed.set('following')">
              {{ 'FEED.FOLLOWING' | translate }}
            </button>
            <button type="button" class="rs-chip" [class.active]="feed() === 'discover'" (click)="feed.set('discover')">
              {{ 'FEED.DISCOVER' | translate }}
            </button>
          </div>

          <app-post-feed
            [query]="{ feed: feed() }"
            emptyTitle="FEED.EMPTY_TITLE"
            emptyText="FEED.EMPTY"
          />
        </main>

        <aside class="right">
          <app-right-rail />
        </aside>
      </div>
    </ion-content>
  `,
  styles: `
    .brand {
      padding-inline-start: 12px;
    }

    .brand ::ng-deep .mark {
      height: 32px;
      width: 32px;
    }

    /* Una columna en el móvil; muro y derecha desde 1100 px; las tres desde 1260 px. */
    .layout {
      display: grid;
      gap: 32px;
      grid-template-columns: minmax(0, 1fr);
      justify-content: center;
      margin: 0 auto;
      max-width: 1440px;
    }

    .left,
    .right {
      display: none;
    }

    .center {
      margin: 0 auto;
      max-width: 590px;
      padding: 16px 0 48px;
      width: 100%;
    }

    @media (max-width: 991.98px) {
      .center {
        padding-top: 0;
      }
    }

    @media (min-width: 1100px) {
      .layout {
        grid-template-columns: minmax(0, 590px) minmax(280px, 340px);
      }

      .right {
        display: block;
      }
    }

    @media (min-width: 1260px) {
      .layout {
        grid-template-columns: minmax(280px, 1fr) 590px minmax(280px, 1fr);
      }

      .left {
        display: block;
      }
    }

    .left,
    .right {
      align-self: start;
      max-height: calc(100vh - var(--rs-topbar-height));
      overflow-y: auto;
      position: sticky;
      scrollbar-width: thin;
      top: 0;
    }

    .left {
      max-width: 360px;
    }

    .right {
      justify-self: end;
      max-width: 340px;
      width: 100%;
    }

    .tray-card {
      overflow: hidden;
    }

    .tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px 12px;
    }
  `,
})
export class HomePage {
  readonly notifications = inject(NotificationsService);
  private readonly stories = inject(StoriesService);

  readonly feed = signal<PostFeed>('home');
  private readonly feedComponent = viewChild(PostFeedComponent);

  async refresh(event: CustomEvent): Promise<void> {
    await Promise.all([this.feedComponent()?.reload(), this.stories.loadFeed().catch(() => undefined)]);
    await (event.target as HTMLIonRefresherElement).complete();
  }
}
