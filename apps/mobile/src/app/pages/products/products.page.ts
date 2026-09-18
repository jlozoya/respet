import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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
import type { Product } from '@social-network/shared';

import { ProductsService } from '../../core/api/store.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ProductCardComponent } from '../../components/product/product-card/product-card.component';
import { ProductFormComponent } from '../../components/product/product-form/product-form.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    ProductCardComponent,
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
export class ProductsPage {
  private readonly products = inject(ProductsService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  /** Filtra el catálogo por bodega, al llegar desde su ficha. */
  readonly warehouseId = input<string | null>(null);

  readonly items = signal<readonly Product[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  readonly canCreate = signal(this.auth.hasRole('supervisor'));

  private page = 1;

  constructor() {
    effect(() => {
      // Leer la señal aquí es lo que hace que un cambio de bodega recargue.
      this.warehouseId();

      // La carga va dentro de `untracked` porque lee `loading` y `search`
      // antes de su primer `await`, y son señales que ella misma escribe: sin
      // aislarla, el efecto se dispararía a sí mismo y el catálogo se quedaría
      // recargándose sin parar.
      untracked(() => void this.load({ reset: true }));
    });
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
    const modal = await this.modalCtrl.create({
      component: ProductFormComponent,
      componentProps: { warehouseId: this.warehouseId() },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Product>();

    if (data) {
      this.items.update((current) => [data, ...current]);
    }
  }

  onUpdated(product: Product): void {
    this.items.update((current) =>
      current.map((item) => (item.id === product.id ? product : item)),
    );
  }

  onDeleted(product: Product): void {
    this.items.update((current) => current.filter((item) => item.id !== product.id));
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.products.list({
        page: this.page,
        perPage: 12,
        search: this.search() || undefined,
        warehouseId: this.warehouseId() ?? undefined,
      });

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
