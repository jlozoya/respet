import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';
import type { Hashtag } from '@social-network/shared';

import { PostGridComponent } from '../../components/feed/post-grid.component';
import { SocialService } from '../../core/api/social.service';

/**
 * Explorar: lo más destacado del último mes en cuadrícula, con las etiquetas
 * del momento arriba y, en el móvil, el buscador.
 */
@Component({
  selector: 'app-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    PostGridComponent,
  ],
  template: `
    <ion-header class="rs-mobile-only">
      <ion-toolbar>
        <form class="search" (submit)="search($event, query.value)">
          <label class="rs-pill-input">
            <ion-icon name="search" />
            <input
              #query
              type="search"
              [placeholder]="'SEARCH_PAGE.PLACEHOLDER' | translate"
              [attr.aria-label]="'SEARCH' | translate"
            />
          </label>
        </form>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="rs-container wide">
        <h1 class="title rs-desktop-only">{{ 'NAV.EXPLORE' | translate }}</h1>

        @if (trending().length) {
          <div class="rs-chips tags">
            @for (tag of trending(); track tag.tag) {
              <a class="rs-chip" [routerLink]="['/hashtag', tag.tag]">#{{ tag.tag }}</a>
            }
          </div>
        }

        <app-post-grid source="explore" emptyText="EXPLORE.EMPTY" />
      </div>
    </ion-content>
  `,
  styles: `
    .search {
      padding: 0 12px;
    }

    .title {
      font-size: 1.5rem;
      padding: 0 8px 12px;
    }

    .tags {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding: 8px 8px 12px;
      scrollbar-width: none;
    }
  `,
})
export class ExplorePage implements OnInit {
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);

  readonly trending = signal<Hashtag[]>([]);
  private readonly grid = viewChild(PostGridComponent);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.trending.set(await this.social.trendingHashtags(12).catch(() => []));
  }

  search(event: Event, term: string): void {
    event.preventDefault();

    if (term.trim()) {
      void this.router.navigate(['/search'], { queryParams: { q: term.trim() } });
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    await Promise.all([this.grid()?.reload(), this.initialize()]);
    await (event.target as HTMLIonRefresherElement).complete();
  }
}
