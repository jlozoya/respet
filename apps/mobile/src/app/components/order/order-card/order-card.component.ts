import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonText } from '@ionic/angular/ion-text';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import { OrderState, type Order, type UserSummary } from '@respet/shared';

import { OrdersService } from '../../../core/api/store.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { OrderRoundsmanModalComponent } from '../order-roundsman-modal/order-roundsman-modal.component';

/**
 * Transiciones que la interfaz ofrece desde cada estado.
 *
 * Coinciden con las que acepta el servidor: enseñar aquí una opción que allí
 * se rechaza sólo produciría un error tras pulsarla.
 */
const NEXT_STATES: Record<OrderState, readonly OrderState[]> = {
  [OrderState.OnCreate]: [OrderState.Stored, OrderState.Cancelled],
  [OrderState.Stored]: [OrderState.OnTransit, OrderState.Cancelled],
  [OrderState.OnTransit]: [OrderState.Delivered, OrderState.Cancelled],
  [OrderState.Delivered]: [],
  [OrderState.Cancelled]: [],
};

const STATE_LABELS: Record<OrderState, string> = {
  [OrderState.OnCreate]: 'ORDER.STATES.ON_CREATE',
  [OrderState.Stored]: 'ORDER.STATES.STORED',
  [OrderState.OnTransit]: 'ORDER.STATES.ON_TRANSIT',
  [OrderState.Delivered]: 'ORDER.STATES.DELIVERED',
  [OrderState.Cancelled]: 'ORDER.STATES.CANCELLED',
};

const STATE_COLORS: Record<OrderState, string> = {
  [OrderState.OnCreate]: 'medium',
  [OrderState.Stored]: 'primary',
  [OrderState.OnTransit]: 'warning',
  [OrderState.Delivered]: 'success',
  [OrderState.Cancelled]: 'danger',
};

@Component({
  selector: 'app-order-card',
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonItem,
    IonAvatar,
    IonLabel,
    IonText,
    IonBadge,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
  ],
})
export class OrderCardComponent {
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  readonly order = input.required<Order>();

  readonly changed = output<Order>();

  private readonly overrides = signal<Order | null>(null);
  readonly current = computed(() => this.overrides() ?? this.order());

  readonly isStaff = computed(() => this.auth.hasRole('roundsman'));
  readonly stateLabel = computed(() => STATE_LABELS[this.current().state]);
  readonly stateColor = computed(() => STATE_COLORS[this.current().state]);
  readonly nextStates = computed(() =>
    NEXT_STATES[this.current().state].map((state) => ({ value: state, label: STATE_LABELS[state] })),
  );
  readonly itemCount = computed(() =>
    this.current().items.reduce((sum, item) => sum + item.quantity, 0),
  );

  openDetail(): void {
    void this.router.navigate(['/orders', this.current().id]);
  }

  avatarOf(user: UserSummary | null): string {
    return user?.avatar?.url ?? './assets/imgs/avatar.png';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }

  async changeState(state: OrderState): Promise<void> {
    if (state === this.current().state) {
      return;
    }

    try {
      const updated = await this.orders.updateState(this.current().id, state);
      this.overrides.set(updated);
      this.changed.emit(updated);
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  /** Asigna el repartidor que llevará el pedido. */
  async assignRoundsman(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: OrderRoundsmanModalComponent });

    await modal.present();

    const { data } = await modal.onWillDismiss<UserSummary>();

    if (!data) {
      return;
    }

    try {
      const updated = await this.orders.updateState(
        this.current().id,
        this.current().state,
        data.id,
      );
      this.overrides.set(updated);
      this.changed.emit(updated);
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
