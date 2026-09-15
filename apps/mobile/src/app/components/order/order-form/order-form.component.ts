import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonDatetime } from '@ionic/angular/ion-datetime';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { TranslatePipe } from '@ngx-translate/core';
import type { LocationInput, Order } from '@respet/shared';

import { OrdersService } from '../../../core/api/store.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { LocationPickerComponent } from '../../location-picker/location-picker.component';

/**
 * Datos de entrega de un pedido: destino y fechas.
 *
 * Las líneas del pedido no se editan aquí: se gestionan desde el carrito, que
 * es donde el servidor recalcula el total.
 */
@Component({
  selector: 'app-order-form',
  templateUrl: './order-form.component.html',
  styleUrls: ['./order-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LocationPickerComponent,
    IonItem,
    IonLabel,
    IonDatetime,
    IonButton,
  ],
})
export class OrderFormComponent {
  private readonly orders = inject(OrdersService);
  private readonly feedback = inject(FeedbackService);

  readonly order = input.required<Order>();

  readonly saved = output<Order>();

  readonly saving = signal(false);
  readonly destination = signal<LocationInput | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    takeOutDate: [null as string | null],
    deliveryDate: [null as string | null],
  });

  constructor() {
    // Los `input.required` no tienen valor todavía cuando se construye el
    // componente, así que el formulario se rellena desde un efecto, que además
    // lo mantiene al día si el pedido cambia.
    effect(() => {
      const current = this.order();

      this.form.patchValue({
        takeOutDate: current.takeOutDate,
        deliveryDate: current.deliveryDate,
      });

      if (current.destination) {
        const { id: _id, ...rest } = current.destination;
        this.destination.set(rest);
      } else {
        this.destination.set(null);
      }
    });
  }

  async submit(): Promise<void> {
    this.saving.set(true);

    try {
      const values = this.form.getRawValue();
      const updated = await this.orders.update(this.order().id, {
        destination: this.destination(),
        takeOutDate: values.takeOutDate,
        deliveryDate: values.deliveryDate,
      });

      this.saved.emit(updated);
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }
}
