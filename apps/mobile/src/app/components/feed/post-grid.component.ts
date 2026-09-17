import { ChangeDetectionStrategy, Component, type OnInit, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { TranslatePipe } from '@ngx-translate/core';
import type { Paginated, PostListQuery } from '@respet/shared';

import { PostsService, type PostGridItem } from '../../core/api/posts.service';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';

/** De dónde salen las casillas. */
export type GridSource = 'posts' | 'explore' | 'saved';

const PAGE_SIZE = 30;

/**
 * La cuadrícula de Instagram: tres columnas de fotos cuadradas.
 *
 * Al pasar por encima enseña las reacciones y los comentarios; un vídeo lleva
 * su icono y una publicación con varias fotos, el de galería. Sin foto se ve
 * el principio del texto sobre un color.
 */
@Component({
  selector: 'app-post-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, CompactNumberPipe],
  template: `
    <div class="rs-grid" [class.explore]="source() === 'explore'">
      @for (item of items(); track item.id; let index = $index) {
        <a class="rs-grid-tile" [class.big]="source() === 'explore' && index % 10 === 2" [routerLink]="['/post', item.id]">
          @if (item.media[0]; as cover) {
            <img [src]="cover.posterUrl ?? cover.url" [alt]="cover.alt || item.description" loading="lazy" decoding="async" />
            @if (item.media.length > 1) {
              <ion-icon class="badge" name="copy" />
            } @else if (cover.type === 'video') {
              <ion-icon class="badge" name="play" />
            }
          } @else {
            <span class="text-tile">{{ item.description }}</span>
          }
          <span class="overlay">
            <span><ion-icon name="heart" /> {{ item.reactionCount | compactNumber }}</span>
            <span><ion-icon name="chatbubble" /> {{ item.commentCount | compactNumber }}</span>
          </span>
        </a>
      }

      @if (loading() && items().length === 0) {
        @for (placeholder of placeholders; track placeholder) {
          <span class="rs-grid-tile rs-skeleton"></span>
        }
      }
    </div>

    @if (!loading() && items().length === 0) {
      <div class="rs-empty">
        <ion-icon name="images-outline" />
        <p>{{ emptyText() | translate }}</p>
      </div>
    }

    <ion-infinite-scroll [disabled]="!hasMore() || loading()" (ionInfinite)="loadMore($event)">
      <ion-infinite-scroll-content />
    </ion-infinite-scroll>
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
    }

    .rs-grid.explore {
      grid-auto-flow: dense;
    }

    .big {
      grid-column: span 2;
      grid-row: span 2;
    }

    .badge {
      color: #fff;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 50%));
      font-size: 20px;
      position: absolute;
      right: 8px;
      top: 8px;
    }

    .text-tile {
      align-items: center;
      background: var(--rs-brand-gradient);
      color: #fff;
      display: -webkit-box;
      font-size: 0.875rem;
      font-weight: 600;
      height: 100%;
      overflow: hidden;
      padding: 12px;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 6;
    }

    .overlay {
      align-items: center;
      background: rgb(0 0 0 / 35%);
      color: #fff;
      display: flex;
      font-weight: 700;
      gap: 20px;
      inset: 0;
      justify-content: center;
      opacity: 0;
      position: absolute;
      transition: opacity 0.15s ease;
    }

    .overlay span {
      align-items: center;
      display: flex;
      gap: 6px;
    }

    .rs-grid-tile:hover .overlay {
      opacity: 1;
    }

    @media (hover: none) {
      .overlay {
        display: none;
      }
    }
  `,
})
export class PostGridComponent implements OnInit {
  private readonly posts = inject(PostsService);

  readonly source = input<GridSource>('posts');
  readonly query = input<PostListQuery>({});
  readonly emptyText = input('COMMON.NOTHING_HERE');

  readonly items = signal<PostGridItem[]>([]);
  readonly loading = signal(true);
  readonly hasMore = signal(false);
  readonly placeholders = Array.from({ length: 9 }, (_, index) => index);

  private page = 0;
  private initialized = false;

  constructor() {
    effect(() => {
      this.query();
      this.source();

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
    this.items.set([]);
    await this.fetch();
  }

  async loadMore(event: CustomEvent): Promise<void> {
    await this.fetch();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  private async fetch(): Promise<void> {
    this.loading.set(true);

    try {
      const next = this.page + 1;
      let result: Paginated<PostGridItem>;

      switch (this.source()) {
        case 'explore':
          result = await this.posts.explore(next, PAGE_SIZE);
          break;
        case 'saved':
          result = await this.posts.saved(next, PAGE_SIZE);
          break;
        default:
          result = await this.posts.grid({ ...this.query(), page: next, perPage: PAGE_SIZE });
      }

      const known = new Set(this.items().map((item) => item.id));
      this.items.update((items) => [...items, ...result.data.filter((item) => !known.has(item.id))]);
      this.page = next;
      this.hasMore.set(result.meta.hasNextPage);
    } catch {
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
