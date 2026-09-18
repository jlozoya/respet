import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { TranslatePipe } from '@ngx-translate/core';
import type { Order } from '@social-network/shared';

import { OrdersService } from '../../../core/api/store.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { OrderCardComponent } from '../../../components/order/order-card/order-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

/** Qué conjunto de pedidos se está mirando. */
type Scope = 'mine' | 'all';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    OrderCardComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class OrdersPage {
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly items = signal<readonly Order[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);
  readonly scope = signal<Scope>('mine');

  /** El personal puede alternar entre sus pedidos y todos los del sistema. */
  readonly isStaff = computed(() => this.auth.hasRole('roundsman'));

  private page = 1;

  constructor() {
    void this.load({ reset: true });
  }

  async changeScope(scope: string): Promise<void> {
    this.scope.set(scope === 'all' ? 'all' : 'mine');
    await this.load({ reset: true });
  }

  async onSearch(term: string): Promise<void> {
    this.search.set(term);
    await this.load({ reset: true });
  }

  async refresh(event: Event): Promise<void> {
    await this.load({ reset: true });
    void (event.target as HTMLIonRefresherElement).complete();
  }

  async loadMore(event: Event): Promise<void> {
    await this.load({ reset: false });
    void (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  onChanged(order: Order): void {
    this.items.update((current) => current.map((item) => (item.id === order.id ? order : item)));
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const query = {
        page: this.page,
        perPage: 12,
        search: this.search() || undefined,
      };

      const result =
        this.scope() === 'all' && this.isStaff()
          ? await this.orders.list(query)
          : await this.orders.listMine(query);

      this.items.update((current) => (options.reset ? result.data : [...current, ...result.data]));
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      await this.feedback.error(error);
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
