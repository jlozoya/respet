import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonRow } from '@ionic/angular/ion-row';
import { IonThumbnail } from '@ionic/angular/ion-thumbnail';
import { TranslatePipe } from '@ngx-translate/core';
import { OrderState, type Order, type OrderItem } from '@social-network/shared';

import { OrdersService } from '../../../core/api/store.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { OrderFormComponent } from '../../../components/order/order-form/order-form.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

const STATE_LABELS: Record<OrderState, string> = {
  [OrderState.OnCreate]: 'ORDER.STATES.ON_CREATE',
  [OrderState.Stored]: 'ORDER.STATES.STORED',
  [OrderState.OnTransit]: 'ORDER.STATES.ON_TRANSIT',
  [OrderState.Delivered]: 'ORDER.STATES.DELIVERED',
  [OrderState.Cancelled]: 'ORDER.STATES.CANCELLED',
};

/**
 * Detalle de un pedido.
 *
 * Es también el destino al que PayPal devuelve al comprador: si la URL trae
 * `?payment=success`, la página busca el pago pendiente del pedido y lo cobra.
 * Hacerlo aquí, y no confiando sólo en el webhook, deja al comprador ver
 * confirmado el pago en el mismo momento en que vuelve.
 */
@Component({
  selector: 'app-order',
  templateUrl: './order.page.html',
  styleUrls: ['./order.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    TranslatePipe,
    PageHeaderComponent,
    OrderFormComponent,
    IonContent,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonThumbnail,
    IonLabel,
    IonNote,
    IonBadge,
  ],
})
export class OrderPage {
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly id = input.required<string>();
  /** `success` o `cancelled`, según cómo vuelva el comprador de PayPal. */
  readonly payment = input<string | null>(null);

  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);

  readonly items = computed<readonly OrderItem[]>(() => this.order()?.items ?? []);
  readonly stateLabel = computed(() => {
    const current = this.order();

    return current ? STATE_LABELS[current.state] : '';
  });
  readonly canEdit = computed(() => {
    const current = this.order();

    if (!current) {
      return false;
    }

    return this.auth.hasRole('roundsman') || current.customer.id === this.auth.user()?.id;
  });

  constructor() {
    effect(() => {
      const orderId = this.id();

      if (orderId) {
        untracked(() => void this.load(orderId));
      }
    });
  }

  imageOf(item: OrderItem): string {
    return item.product?.media[0]?.url ?? './assets/imgs/icon.png';
  }

  onUpdated(order: Order): void {
    this.order.set(order);
  }

  private async load(orderId: string): Promise<void> {
    this.loading.set(true);

    try {
      this.order.set(await this.orders.findById(orderId));

      if (this.payment() === 'success') {
        await this.capturePendingPayment(orderId);
      } else if (this.payment() === 'cancelled') {
        await this.feedback.toast('ORDER.PAYMENT_CANCELLED', { color: 'warning' });
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Cobra el pago que quedó pendiente al aprobarlo en PayPal.
   *
   * Se busca por el pedido en lugar de arrastrar el identificador del pago
   * hasta la vuelta: así funciona igual si el comprador cierra la aplicación
   * entre medias y entra después por su cuenta.
   */
  private async capturePendingPayment(orderId: string): Promise<void> {
    try {
      const payments = await this.orders.payments(orderId);
      const pending = payments.find((item) => item.status === 'pending');

      if (!pending) {
        return;
      }

      await this.feedback.withLoading(
        () => this.orders.capturePayment(pending.id),
        'ORDER.CONFIRMING_PAYMENT',
      );

      this.order.set(await this.orders.findById(orderId));
      await this.feedback.toast('ORDER.PAYMENT_CONFIRMED', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error, 'SERVER.PAYMENT_FAILED');
    }
  }
}
