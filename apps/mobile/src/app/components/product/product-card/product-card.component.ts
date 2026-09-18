import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonCardTitle } from '@ionic/angular/ion-card-title';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonText } from '@ionic/angular/ion-text';
import { ModalController } from '@ionic/angular/modal-controller';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Product } from '@social-network/shared';

import { ProductsService } from '../../../core/api/store.service';
import { OrdersService } from '../../../core/api/store.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { GalleryComponent } from '../../gallery/gallery.component';
import { EntityMenuComponent } from '../../../shared/components/entity-menu.component';
import { ProductFormComponent } from '../product-form/product-form.component';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    TranslatePipe,
    GalleryComponent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonText,
    IonInput,
    IonButton,
    IonIcon,
  ],
})
export class ProductCardComponent {
  private readonly products = inject(ProductsService);
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly popoverCtrl = inject(PopoverController);

  readonly product = input.required<Product>();
  /** Unidades ya pedidas, cuando la tarjeta se muestra dentro de un pedido. */
  readonly orderedQuantity = input<number | null>(null);

  readonly deleted = output<Product>();
  readonly updated = output<Product>();

  private readonly overrides = signal<Product | null>(null);
  readonly current = computed(() => this.overrides() ?? this.product());

  readonly quantity = signal(1);
  readonly adding = signal(false);

  readonly canManage = computed(() => this.auth.hasRole('supervisor'));
  readonly inStock = computed(() => this.current().stock > 0);

  async addToCart(): Promise<void> {
    const product = this.current();
    const quantity = Math.max(1, Math.trunc(this.quantity()));

    if (quantity > product.stock) {
      await this.feedback.toast('SERVER.OUT_OF_STOCK', { color: 'warning' });

      return;
    }

    this.adding.set(true);

    try {
      await this.orders.addItem({ productId: product.id, quantity });
      await this.feedback.toast('ADDED_TO_ORDER', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.adding.set(false);
    }
  }

  async openMenu(event: Event): Promise<void> {
    const popover = await this.popoverCtrl.create({
      component: EntityMenuComponent,
      componentProps: { canUpdate: true, canDelete: this.auth.isAdmin() },
      event,
    });

    await popover.present();

    const { data } = await popover.onWillDismiss<'update' | 'delete'>();

    if (data === 'update') {
      await this.edit();
    } else if (data === 'delete') {
      await this.confirmDelete();
    }
  }

  private async edit(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ProductFormComponent,
      componentProps: { product: this.current() },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Product>();

    if (data) {
      this.overrides.set(data);
      this.updated.emit(data);
    }
  }

  private async confirmDelete(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_PRODUCT.TITLE',
      message: 'ALERTS.DELETE_PRODUCT.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      const product = this.current();
      await this.products.remove(product.id);
      this.deleted.emit(product);
    } catch (error) {
      // El servidor rechaza borrar un producto que aparezca en algún pedido,
      // para no romper el historial; el mensaje lo explica.
      await this.feedback.error(error);
    }
  }
}
