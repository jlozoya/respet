import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { PostFeedComponent } from '../../components/feed/post-feed.component';
import { PostGridComponent } from '../../components/feed/post-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Lo publicado con una #etiqueta, en cuadrícula como Instagram o en lista como
 * Facebook.
 */
@Component({
  selector: 'app-hashtag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonContent,
    IonIcon,
    PageHeaderComponent,
    PostFeedComponent,
    PostGridComponent,
  ],
  template: `
    <app-page-header [title]="'#' + tag()" [translateTitle]="false" backTo="/explore" />

    <ion-content>
      <div class="rs-container">
        <header class="rs-card head">
          <span class="icon">#</span>
          <div>
            <h1>#{{ tag() }}</h1>
            <span class="rs-muted">{{ 'HASHTAG.SUBTITLE' | translate }}</span>
          </div>
        </header>

        <nav class="rs-tabs tabs">
          <button
            type="button"
            class="rs-tab"
            [class.active]="view() === 'grid'"
            (click)="view.set('grid')"
          >
            <ion-icon name="grid" /> {{ 'HASHTAG.TOP' | translate }}
          </button>
          <button
            type="button"
            class="rs-tab"
            [class.active]="view() === 'list'"
            (click)="view.set('list')"
          >
            <ion-icon name="list" /> {{ 'HASHTAG.RECENT' | translate }}
          </button>
        </nav>

        @if (view() === 'grid') {
          <app-post-grid [query]="query()" emptyText="HASHTAG.EMPTY" />
        } @else {
          <app-post-feed
            [query]="query()"
            emptyTitle="HASHTAG.EMPTY"
            emptyIcon="pricetag-outline"
          />
        }
      </div>
    </ion-content>
  `,
  styles: `
    .head {
      align-items: center;
      display: flex;
      gap: 16px;
      padding: 20px;
    }

    .icon {
      align-items: center;
      background: var(--rs-brand-gradient);
      border-radius: 50%;
      color: #fff;
      display: flex;
      font-size: 2.5rem;
      font-weight: 800;
      height: 80px;
      justify-content: center;
      width: 80px;
    }

    h1 {
      font-size: 1.75rem;
    }

    .tabs {
      justify-content: center;
      margin-bottom: 8px;
    }

    .tabs .rs-tab {
      align-items: center;
      display: inline-flex;
      gap: 6px;
    }
  `,
})
export class HashtagPage {
  readonly tag = input.required<string>();
  readonly view = signal<'grid' | 'list'>('grid');
  readonly query = computed(() => ({ hashtag: this.tag().toLowerCase() }));
}
