import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Bulletin, Hashtag, LiveStream, UserSuggestion } from '@social-network/shared';

import { ChatService } from '../../core/api/chat.service';
import { BulletinsService } from '../../core/api/content.service';
import { LiveService } from '../../core/api/live.service';
import { SocialService } from '../../core/api/social.service';
import { PresenceService } from '../../core/realtime/presence.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FollowButtonComponent } from '../../shared/components/follow-button.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/**
 * La columna derecha del escritorio.
 *
 * Los directos en curso, los avisos de la administración, personas que quizá
 * conozcas, lo que es tendencia y, abajo del todo, los contactos con su punto
 * verde: tocar uno abre la conversación en una ventana, como en Facebook.
 */
@Component({
  selector: 'app-right-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonIcon,
    AvatarComponent,
    FollowButtonComponent,
    CompactNumberPipe,
    FullNamePipe,
  ],
  template: `
    <aside class="rail">
      @if (lives().length) {
        <section>
          <h3 class="rs-section-title">{{ 'LIVE.NOW' | translate }}</h3>
          @for (stream of lives(); track stream.id) {
            <a class="rs-row" [routerLink]="['/live', stream.id]">
              <app-avatar [user]="stream.host" [size]="36" ring="live" />
              <span class="rs-row-text">
                <span class="title">{{ stream.host | fullName }}</span>
                <span class="subtitle">{{ stream.title || ('LIVE.UNTITLED' | translate) }}</span>
              </span>
              <span class="rs-live-badge">{{ 'LIVE.BADGE' | translate }}</span>
            </a>
          }
        </section>
      }

      @if (bulletins().length) {
        <section>
          <h3 class="rs-section-title">{{ 'BULLETIN.TITLE' | translate }}</h3>
          @for (bulletin of bulletins(); track bulletin.id) {
            <div class="bulletin">
              @if (bulletin.media) {
                <img [src]="bulletin.media.url" [alt]="bulletin.title" loading="lazy" />
              }
              <span class="rs-strong">{{ bulletin.title }}</span>
              <span class="rs-small rs-muted clamp">{{ bulletin.description }}</span>
            </div>
          }
        </section>
      }

      @if (suggestions().length) {
        <section>
          <h3 class="rs-section-title">{{ 'SUGGESTIONS.TITLE' | translate }}</h3>
          @for (suggestion of suggestions(); track suggestion.user.id) {
            <div class="rs-row suggestion">
              <a [routerLink]="['/profile', suggestion.user.name]"
                ><app-avatar [user]="suggestion.user" [size]="40"
              /></a>
              <a class="rs-row-text" [routerLink]="['/profile', suggestion.user.name]">
                <span class="title">{{ suggestion.user | fullName }}</span>
                <span class="subtitle">
                  @if (suggestion.mutualCount) {
                    {{ 'SUGGESTIONS.MUTUALS' | translate: { count: suggestion.mutualCount } }}
                  } @else {
                    {{ 'SUGGESTIONS.NEW' | translate }}
                  }
                </span>
              </a>
              <app-follow-button [userId]="suggestion.user.id" followState="none" />
            </div>
          }
        </section>
      }

      @if (trending().length) {
        <section>
          <h3 class="rs-section-title">{{ 'TRENDING.TITLE' | translate }}</h3>
          @for (tag of trending(); track tag.tag) {
            <a class="rs-row" [routerLink]="['/hashtag', tag.tag]">
              <span class="rs-row-icon hash">#</span>
              <span class="rs-row-text">
                <span class="title">#{{ tag.tag }}</span>
                <span class="subtitle">{{
                  'SEARCH_PAGE.POST_COUNT' | translate: { count: (tag.postCount | compactNumber) }
                }}</span>
              </span>
            </a>
          }
        </section>
      }

      <section>
        <h3 class="rs-section-title contacts-title">
          {{ 'CONTACTS.TITLE' | translate }}
          <a
            routerLink="/messages"
            class="rs-icon-btn plain"
            [attr.aria-label]="'NAV.MESSAGES' | translate"
            ><ion-icon name="create-outline"
          /></a>
        </h3>
        @for (contact of presence.contacts(); track contact.user.id) {
          <button type="button" class="rs-row" (click)="chat.openWith(contact.user.id)">
            <app-avatar [user]="contact.user" [size]="36" [online]="contact.online" />
            <span class="rs-row-text"
              ><span class="title">{{ contact.user | fullName }}</span></span
            >
          </button>
        } @empty {
          <p class="rs-small rs-muted empty">{{ 'CONTACTS.EMPTY' | translate }}</p>
        }
      </section>
    </aside>
  `,
  styles: `
    .rail {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
    }

    section {
      border-bottom: 1px solid var(--rs-divider);
      padding-bottom: 8px;
    }

    section:last-child {
      border-bottom: 0;
    }

    .suggestion .rs-row-text {
      color: inherit;
    }

    .hash {
      font-weight: 800;
    }

    .bulletin {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 8px 8px;
    }

    .bulletin img {
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      margin-bottom: 4px;
      object-fit: cover;
      width: 100%;
    }

    .clamp {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .contacts-title {
      align-items: center;
      display: flex;
      justify-content: space-between;
    }

    .empty {
      padding: 0 8px;
    }
  `,
})
export class RightRailComponent implements OnInit {
  readonly chat = inject(ChatService);
  readonly presence = inject(PresenceService);
  private readonly social = inject(SocialService);
  private readonly live = inject(LiveService);
  private readonly bulletinsService = inject(BulletinsService);

  readonly suggestions = signal<UserSuggestion[]>([]);
  readonly trending = signal<Hashtag[]>([]);
  readonly lives = signal<LiveStream[]>([]);
  readonly bulletins = signal<Bulletin[]>([]);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    // Cada bloque va por su cuenta: si uno falla, los demás se pintan igual.
    await Promise.all([
      this.social.suggestedUsers(4).then(
        (items) => this.suggestions.set(items),
        () => undefined,
      ),
      this.social.trendingHashtags(5).then(
        (items) => this.trending.set(items),
        () => undefined,
      ),
      this.live.list().then(
        (items) => this.lives.set(items.slice(0, 3)),
        () => undefined,
      ),
      this.bulletinsService.list({ perPage: 2 }).then(
        (page) => this.bulletins.set(page.data),
        () => undefined,
      ),
    ]);
  }
}
