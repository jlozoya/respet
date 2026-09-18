import { ChangeDetectionStrategy, Component, DestroyRef, type OnInit, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { TranslatePipe } from '@ngx-translate/core';
import type { Post, PostListQuery } from '@social-network/shared';

import { PostsService, applyPostChange } from '../../core/api/posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { PostCardComponent } from './post-card.component';

const PAGE_SIZE = 10;

/**
 * Una lista de publicaciones que se va cargando al bajar.
 *
 * La usan el muro, el perfil y las etiquetas, cada uno con su consulta. Se
 * mantiene al día con lo que cambia en otras pantallas y añade arriba lo que
 * publica quien mira, si le corresponde estar en esta lista.
 */
@Component({
  selector: 'app-post-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, PostCardComponent],
  template: `
    @for (post of posts(); track post.id) {
      <app-post-card [post]="post" (removed)="remove($event)" />
    }

    @if (loading() && posts().length === 0) {
      @for (placeholder of [1, 2]; track placeholder) {
        <div class="rs-card skeleton">
          <div class="row">
            <span class="rs-skeleton circle"></span>
            <span class="lines"><span class="rs-skeleton line short"></span><span class="rs-skeleton line tiny"></span></span>
          </div>
          <span class="rs-skeleton line"></span>
          <span class="rs-skeleton line medium"></span>
          <span class="rs-skeleton block"></span>
        </div>
      }
    }

    @if (!loading() && failed() && posts().length === 0) {
      <div class="rs-empty">
        <ion-icon name="cloud-offline-outline" />
        <p>{{ 'FEED.LOAD_FAILED' | translate }}</p>
        <ion-button class="rs-soft" (click)="reload()">{{ 'COMMON.RETRY' | translate }}</ion-button>
      </div>
    } @else if (!loading() && posts().length === 0) {
      <div class="rs-empty">
        <ion-icon [name]="emptyIcon()" />
        <h3>{{ emptyTitle() | translate }}</h3>
        @if (emptyText()) {
          <p>{{ emptyText() | translate }}</p>
        }
      </div>
    }

    @if (!hasMore() && posts().length > 0) {
      <p class="end rs-small rs-muted">{{ 'FEED.END' | translate }}</p>
    }

    <ion-infinite-scroll [disabled]="!hasMore() || loading()" (ionInfinite)="loadMore($event)">
      <ion-infinite-scroll-content />
    </ion-infinite-scroll>
  `,
  styles: `
    :host {
      display: block;
    }

    .skeleton {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
    }

    .row {
      align-items: center;
      display: flex;
      gap: 8px;
    }

    .circle {
      border-radius: 50%;
      height: 40px;
      width: 40px;
    }

    .lines {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 6px;
    }

    .line {
      display: block;
      height: 12px;
    }

    .short {
      width: 40%;
    }

    .tiny {
      width: 20%;
    }

    .medium {
      width: 70%;
    }

    .block {
      display: block;
      height: 240px;
    }

    .end {
      padding: 16px;
      text-align: center;
    }
  `,
})
export class PostFeedComponent implements OnInit {
  private readonly postsService = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = input<PostListQuery>({});
  readonly emptyTitle = input('FEED.EMPTY_TITLE');
  readonly emptyText = input<string | null>(null);
  readonly emptyIcon = input('newspaper-outline');

  readonly posts = signal<Post[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly hasMore = signal(false);
  private page = 0;
  private initialized = false;

  constructor() {
    this.postsService.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((change) => {
      if (change.type === 'created') {
        if (this.accepts(change.post)) {
          this.posts.update((items) => [change.post, ...items.filter((item) => item.id !== change.post.id)]);
        }

        return;
      }

      // Un cambio en la original llega también a las que la comparten.
      this.posts.update((items) =>
        applyPostChange(items, change).map((item) =>
          change.type === 'updated' && item.sharedPost?.id === change.id
            ? { ...item, sharedPost: { ...item.sharedPost, ...change.changes } }
            : item,
        ),
      );
    });

    // Cambiar de consulta —otro perfil, otra etiqueta— empieza de cero.
    effect(() => {
      this.query();

      untracked(() => {
        if (this.initialized) {
          void this.reload();
        }
      });
    });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.initialized = true;
    await this.reload();
  }

  async reload(): Promise<void> {
    this.page = 0;
    this.posts.set([]);
    await this.fetch();
  }

  async loadMore(event: CustomEvent): Promise<void> {
    await this.fetch();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  remove(id: string): void {
    this.posts.update((items) => items.filter((item) => item.id !== id));
  }

  private async fetch(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const next = this.page + 1;
      const result = await this.postsService.list({ ...this.query(), page: next, perPage: PAGE_SIZE });
      const known = new Set(this.posts().map((item) => item.id));

      this.posts.update((items) => [...items, ...result.data.filter((item) => !known.has(item.id))]);
      this.page = next;
      this.hasMore.set(result.meta.hasNextPage);
    } catch {
      this.failed.set(true);
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  /** Si una publicación recién hecha pertenece a esta lista. */
  private accepts(post: Post): boolean {
    const query = this.query();

    if (query.hashtag) {
      return post.hashtags.includes(query.hashtag.toLowerCase());
    }

    if (query.userId) {
      return query.userId === post.author.id;
    }

    return post.author.id === this.auth.user()?.id && !query.search && !query.kind;
  }
}
