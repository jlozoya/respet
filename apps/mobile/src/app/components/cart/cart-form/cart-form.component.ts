import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonThumbnail } from '@ionic/angular/ion-thumbnail';
import { TranslatePipe } from '@ngx-translate/core';
import type { LocationInput, OrderItem } from '@respet/shared';

import { OrdersService } from '../../../core/api/store.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { LocationPickerComponent } from '../../location-picker/location-picker.component';

/**
 * Contenido del carrito y paso al pago.
 *
 * El carrito es el pedido del usuario que sigue en estado `on_create`; el
 * servidor recalcula el total con cada cambio, así que aquí no se suma nada a
 * mano. El pago sale de `OrdersService.checkout`, que devuelve el enlace de
 * PayPal al que hay que llevar al comprador.
 */
@Component({
  selector: 'app-cart-form',
  templateUrl: './cart-form.component.html',
  styleUrls: ['./cart-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    TranslatePipe,
    LocationPickerComponent,
    IonList,
    IonItem,
    IonThumbnail,
    IonLabel,
    IonNote,
    IonInput,
    IonButton,
    IonIcon,
  ],
})
export class CartFormComponent {
  private readonly orders = inject(OrdersService);
  private readonly feedback = inject(FeedbackService);

  readonly cart = this.orders.cart;
  readonly itemCount = this.orders.itemCount;
  readonly loading = signal(true);
  readonly working = signal(false);
  readonly destination = signal<LocationInput | null>(null);

  readonly items = computed<readonly OrderItem[]>(() => this.cart()?.items ?? []);
  readonly total = computed(() => this.cart()?.total ?? 0);
  readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);

    try {
      const cart = await this.orders.loadCart();

      if (cart.destination) {
        const { id: _id, ...rest } = cart.destination;
        this.destination.set(rest);
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  imageOf(item: OrderItem): string {
    return item.product?.media[0]?.url ?? './assets/imgs/icon.png';
  }

  async changeQuantity(item: OrderItem, quantity: number): Promise<void> {
    const next = Math.max(0, Math.trunc(quantity));

    if (next === item.quantity) {
      return;
    }

    this.working.set(true);

    try {
      // Con 0 el servidor elimina la línea, que es lo que espera quien baja la
      // cantidad hasta cero en el campo.
      await this.orders.updateItemQuantity(item.id, next);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.working.set(false);
    }
  }

  async remove(item: OrderItem): Promise<void> {
    this.working.set(true);

    try {
      await this.orders.removeItem(item.id);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.working.set(false);
    }
  }

  /** Guarda la dirección de entrega antes de cobrar. */
  async saveDestination(): Promise<void> {
    const cart = this.cart();

    if (!cart) {
      return;
    }

    try {
      await this.orders.update(cart.id, { destination: this.destination() });
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async checkout(): Promise<void> {
    const cart = this.cart();

    if (!cart || this.isEmpty()) {
      return;
    }

    this.working.set(true);

    try {
      // La dirección se guarda primero: el pedido debe llevarla antes de que
      // el pago lo confirme y deje de ser editable.
      await this.orders.update(cart.id, { destination: this.destination() });

      const session = await this.feedback.withLoading(
        () => this.orders.checkout(cart.id),
        'ORDER.PREPARING_PAYMENT',
      );

      // PayPal devuelve al comprador a `/orders/:id?payment=success`, y es la
      // pantalla del pedido la que cobra el pago al volver.
      window.location.href = session.approvalUrl;
    } catch (error) {
      await this.feedback.error(error, 'SERVER.PAYMENT_FAILED');
    } finally {
      this.working.set(false);
    }
  }
}
