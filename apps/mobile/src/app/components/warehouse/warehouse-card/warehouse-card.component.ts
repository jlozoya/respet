import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonCardTitle } from '@ionic/angular/ion-card-title';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { ModalController } from '@ionic/angular/modal-controller';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Warehouse } from '@respet/shared';

import { WarehousesService } from '../../../core/api/store.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { EntityMenuComponent } from '../../../shared/components/entity-menu.component';
import { WarehouseFormComponent } from '../warehouse-form/warehouse-form.component';

@Component({
  selector: 'app-warehouse-card',
  templateUrl: './warehouse-card.component.html',
  styleUrls: ['./warehouse-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
  ],
})
export class WarehouseCardComponent {
  private readonly warehouses = inject(WarehousesService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly popoverCtrl = inject(PopoverController);
  private readonly router = inject(Router);

  readonly warehouse = input.required<Warehouse>();

  readonly deleted = output<Warehouse>();
  readonly updated = output<Warehouse>();

  private readonly overrides = signal<Warehouse | null>(null);
  readonly current = computed(() => this.overrides() ?? this.warehouse());

  readonly canManage = computed(() => this.auth.hasRole('supervisor'));
  readonly imageUrl = computed(
    () => this.current().media?.url ?? './assets/imgs/warehouse.png',
  );

  /** Dirección legible a partir de los campos que estén rellenos. */
  readonly address = computed(() => {
    const location = this.current().location;

    if (!location) {
      return null;
    }

    return [location.route, location.streetNumber, location.city, location.state, location.country]
      .filter(Boolean)
      .join(', ');
  });

  seeProducts(): void {
    void this.router.navigate(['/products'], {
      queryParams: { warehouseId: this.current().id },
    });
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

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/warehouse.png';
  }

  private async edit(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: WarehouseFormComponent,
      componentProps: { warehouse: this.current() },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Warehouse>();

    if (data) {
      this.overrides.set(data);
      this.updated.emit(data);
    }
  }

  private async confirmDelete(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_WAREHOUSE.TITLE',
      message: 'ALERTS.DELETE_WAREHOUSE.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      const warehouse = this.current();
      await this.warehouses.remove(warehouse.id);
      this.deleted.emit(warehouse);
    } catch (error) {
      // El servidor no deja borrar una bodega con productos dentro.
      await this.feedback.error(error);
    }
  }
}
