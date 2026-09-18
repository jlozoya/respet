import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { SearchResults } from '@social-network/shared';

import { PostCardComponent } from '../../components/feed/post-card.component';
import { SocialService } from '../../core/api/social.service';
import { StorageKey, StorageService } from '../../core/storage/storage.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FollowButtonComponent } from '../../shared/components/follow-button.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { UserNameComponent } from '../../shared/components/user-name.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';

type Filter = 'all' | 'people' | 'posts' | 'hashtags';

/** Cuántas búsquedas recientes se recuerdan. */
const MAX_RECENT = 8;

/**
 * Resultados de búsqueda: personas, etiquetas y publicaciones, con filtros
 * como los de Facebook. Sin término enseña las búsquedas recientes.
 */
@Component({
  selector: 'app-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonIcon,
    IonSpinner,
    PageHeaderComponent,
    PostCardComponent,
    AvatarComponent,
    FollowButtonComponent,
    UserNameComponent,
    CompactNumberPipe,
  ],
  template: `
    <app-page-header title="SEARCH" backTo="/explore">
      <form class="search-form" (submit)="submit($event, box.value)">
        <label class="rs-pill-input">
          <ion-icon name="search" />
          <input
            #box
            type="search"
            [value]="q() ?? ''"
            [placeholder]="'SEARCH_PAGE.PLACEHOLDER' | translate"
            [attr.aria-label]="'SEARCH' | translate"
          />
        </label>
      </form>
    </app-page-header>

    <ion-content>
      <div class="rs-container">
        @if (q()) {
          <div class="rs-chips filters">
            @for (option of filters; track option.value) {
              <button
                type="button"
                class="rs-chip"
                [class.active]="filter() === option.value"
                (click)="filter.set(option.value)"
              >
                {{ option.label | translate }}
              </button>
            }
          </div>

          @if (loading()) {
            <div class="rs-empty"><ion-spinner /></div>
          } @else if (results(); as found) {
            @if (showPeople() && found.users.length) {
              <section class="rs-card">
                <h2 class="rs-card-title">{{ 'SEARCH_PAGE.PEOPLE' | translate }}</h2>
                @for (user of found.users; track user.id) {
                  <div class="rs-row person">
                    <a [routerLink]="['/profile', user.name]"
                      ><app-avatar
                        [user]="user"
                        [size]="56"
                        [ring]="user.hasUnseenStory ? 'unseen' : 'none'"
                    /></a>
                    <a class="rs-row-text" [routerLink]="['/profile', user.name]">
                      <app-user-name class="title" [user]="user" [link]="false" />
                      <span class="subtitle">
                        &#64;{{ user.name }} ·
                        {{
                          'SEARCH_PAGE.FOLLOWERS'
                            | translate: { count: (user.followerCount | compactNumber) }
                        }}
                      </span>
                      @if (user.mutualFollowerCount) {
                        <span class="subtitle">{{
                          'PROFILE.MUTUALS' | translate: { count: user.mutualFollowerCount }
                        }}</span>
                      }
                    </a>
                    <app-follow-button [userId]="user.id" [followState]="user.followState" />
                  </div>
                }
              </section>
            }

            @if (showHashtags() && found.hashtags.length) {
              <section class="rs-card">
                <h2 class="rs-card-title">{{ 'SEARCH_PAGE.HASHTAGS' | translate }}</h2>
                @for (tag of found.hashtags; track tag.tag) {
                  <a class="rs-row" [routerLink]="['/hashtag', tag.tag]">
                    <span class="rs-row-icon hash">#</span>
                    <span class="rs-row-text">
                      <span class="title">#{{ tag.tag }}</span>
                      <span class="subtitle">{{
                        'SEARCH_PAGE.POST_COUNT'
                          | translate: { count: (tag.postCount | compactNumber) }
                      }}</span>
                    </span>
                  </a>
                }
              </section>
            }

            @if (showPosts()) {
              @for (post of found.posts; track post.id) {
                <app-post-card [post]="post" />
              }
            }

            @if (isEmpty()) {
              <div class="rs-empty">
                <ion-icon name="search-outline" />
                <h3>{{ 'SEARCH_PAGE.NO_RESULTS_TITLE' | translate }}</h3>
                <p>{{ 'SEARCH_PAGE.NO_RESULTS' | translate }}</p>
              </div>
            }
          }
        } @else {
          <section class="rs-card">
            <h2 class="rs-card-title">
              {{ 'SEARCH_PAGE.RECENT' | translate }}
              @if (recent().length) {
                <button type="button" class="rs-text-btn" (click)="clearRecent()">
                  {{ 'SEARCH_PAGE.CLEAR' | translate }}
                </button>
              }
            </h2>
            @for (term of recent(); track term) {
              <a class="rs-row" [routerLink]="['/search']" [queryParams]="{ q: term }">
                <span class="rs-row-icon"><ion-icon name="time-outline" /></span>
                <span class="rs-row-text"
                  ><span class="title">{{ term }}</span></span
                >
              </a>
            } @empty {
              <p class="rs-card-body rs-muted">{{ 'SEARCH_PAGE.NO_RECENT' | translate }}</p>
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .search-form {
      padding: 0 12px 8px;
    }

    .filters {
      padding: 0 8px 12px;
    }

    .rs-card {
      padding-bottom: 8px;
    }

    .rs-card .rs-row {
      margin: 0 8px;
      width: auto;
    }

    .hash {
      font-weight: 800;
    }

    .person .rs-row-text {
      color: inherit;
    }
  `,
})
export class SearchPage {
  private readonly social = inject(SocialService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  readonly q = input<string | null>(null);

  readonly filters: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'SEARCH_PAGE.ALL' },
    { value: 'people', label: 'SEARCH_PAGE.PEOPLE' },
    { value: 'posts', label: 'SEARCH_PAGE.POSTS' },
    { value: 'hashtags', label: 'SEARCH_PAGE.HASHTAGS' },
  ];

  readonly filter = signal<Filter>('all');
  readonly results = signal<SearchResults | null>(null);
  readonly loading = signal(false);
  readonly recent = signal<string[]>([]);

  readonly showPeople = computed(() => this.filter() === 'all' || this.filter() === 'people');
  readonly showPosts = computed(() => this.filter() === 'all' || this.filter() === 'posts');
  readonly showHashtags = computed(() => this.filter() === 'all' || this.filter() === 'hashtags');
  readonly isEmpty = computed(() => {
    const found = this.results();

    if (!found) {
      return false;
    }

    return (
      (!this.showPeople() || !found.users.length) &&
      (!this.showPosts() || !found.posts.length) &&
      (!this.showHashtags() || !found.hashtags.length)
    );
  });

  constructor() {
    void this.storage
      .get<string[]>(StorageKey.RecentSearches)
      .then((terms) => this.recent.set(terms ?? []));

    effect(() => {
      const term = this.q()?.trim();
      untracked(() => void this.run(term));
    });
  }

  submit(event: Event, term: string): void {
    event.preventDefault();

    if (term.trim()) {
      void this.router.navigate(['/search'], { queryParams: { q: term.trim() }, replaceUrl: true });
    }
  }

  async clearRecent(): Promise<void> {
    this.recent.set([]);
    await this.storage.remove(StorageKey.RecentSearches);
  }

  private async run(term: string | undefined): Promise<void> {
    if (!term) {
      this.results.set(null);

      return;
    }

    this.loading.set(true);
    this.filter.set(term.startsWith('#') ? 'hashtags' : 'all');

    try {
      this.results.set(await this.social.search(term, 10));
      const recent = [term, ...this.recent().filter((item) => item !== term)].slice(0, MAX_RECENT);
      this.recent.set(recent);
      await this.storage.set(StorageKey.RecentSearches, recent);
    } catch {
      this.results.set({ users: [], hashtags: [], posts: [] });
    } finally {
      this.loading.set(false);
    }
  }
}
