import { ChangeDetectionStrategy, Component, type OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { FollowState, UserSummary } from '@respet/shared';

import { AvatarComponent } from './avatar.component';
import { FollowButtonComponent } from './follow-button.component';
import { UserNameComponent } from './user-name.component';

/** Una persona de la lista, con lo que se enseña a su lado. */
export interface UserListEntry {
  user: UserSummary;
  /** Un emoji o una reacción, pegado al avatar. */
  badge?: string | null;
  subtitle?: string | null;
  followState?: FollowState | null;
}

export interface UserListPage {
  entries: UserListEntry[];
  hasMore: boolean;
}

/**
 * Una lista de personas en una ventana: seguidores, seguidos, quién reaccionó
 * o quién vio una historia.
 *
 * Quien la abre pasa cómo pedir cada página; la ventana se encarga de pintar,
 * del desplazamiento infinito y de llevar al perfil.
 */
@Component({
  selector: 'app-user-list-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    AvatarComponent,
    UserNameComponent,
    FollowButtonComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title() | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="list">
        @for (entry of entries(); track entry.user.id) {
          <div class="rs-row" role="button" tabindex="0" (click)="openProfile(entry.user)" (keydown.enter)="openProfile(entry.user)">
            <span class="avatar">
              <app-avatar [user]="entry.user" [size]="44" />
              @if (entry.badge) {
                <span class="badge">{{ entry.badge }}</span>
              }
            </span>
            <span class="rs-row-text">
              <app-user-name class="title" [user]="entry.user" [link]="false" />
              <span class="subtitle">{{ entry.subtitle ?? '@' + entry.user.name }}</span>
            </span>
            @if (showFollow()) {
              <app-follow-button [userId]="entry.user.id" [followState]="entry.followState ?? null" />
            }
          </div>
        } @empty {
          @if (loading()) {
            <div class="rs-empty"><ion-spinner /></div>
          } @else {
            <div class="rs-empty">{{ emptyText() | translate }}</div>
          }
        }
      </div>

      <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="loadMore($event)">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: `
    .list {
      padding: 8px;
    }

    .avatar {
      position: relative;
    }

    .badge {
      bottom: -4px;
      font-size: 16px;
      position: absolute;
      right: -4px;
    }
  `,
})
export class UserListModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  readonly title = input.required<string>();
  readonly emptyText = input('COMMON.NOTHING_HERE');
  readonly showFollow = input(true);
  readonly load = input.required<(page: number) => Promise<UserListPage>>();

  readonly entries = signal<UserListEntry[]>([]);
  readonly loading = signal(true);
  readonly hasMore = signal(false);
  private page = 1;

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetch();
  }

  async loadMore(event: CustomEvent): Promise<void> {
    this.page++;
    await this.fetch();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  async openProfile(user: UserSummary): Promise<void> {
    await this.modalCtrl.dismiss();
    await this.router.navigate(['/profile', user.name]);
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }

  private async fetch(): Promise<void> {
    try {
      const result = await this.load()(this.page);
      this.entries.update((current) => [...current, ...result.entries]);
      this.hasMore.set(result.hasMore);
    } finally {
      this.loading.set(false);
    }
  }
}
