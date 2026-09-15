import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFabButton } from '@ionic/angular/ion-fab-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Warehouse } from '@respet/shared';

import { WarehousesService } from '../../core/api/store.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { WarehouseCardComponent } from '../../components/warehouse/warehouse-card/warehouse-card.component';
import { WarehouseFormComponent } from '../../components/warehouse/warehouse-form/warehouse-form.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-warehouses',
  templateUrl: './warehouses.page.html',
  styleUrls: ['./warehouses.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    WarehouseCardComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonFab,
    IonFabButton,
    IonIcon,
    IonSearchbar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class WarehousesPage {
  private readonly warehouses = inject(WarehousesService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly items = signal<readonly Warehouse[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  readonly canCreate = signal(this.auth.hasRole('supervisor'));

  private page = 1;

  constructor() {
    void this.load({ reset: true });
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

  async create(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: WarehouseFormComponent });

    await modal.present();

    const { data } = await modal.onWillDismiss<Warehouse>();

    if (data) {
      this.items.update((current) => [data, ...current]);
    }
  }

  onUpdated(warehouse: Warehouse): void {
    this.items.update((current) =>
      current.map((item) => (item.id === warehouse.id ? warehouse : item)),
    );
  }

  onDeleted(warehouse: Warehouse): void {
    this.items.update((current) => current.filter((item) => item.id !== warehouse.id));
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.warehouses.list({
        page: this.page,
        perPage: 12,
        search: this.search() || undefined,
      });

      this.items.update((current) =>
        options.reset ? result.data : [...current, ...result.data],
      );
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      await this.feedback.error(error);
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
