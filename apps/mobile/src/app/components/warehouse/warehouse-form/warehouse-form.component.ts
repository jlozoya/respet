import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { LocationInput, Warehouse } from '@respet/shared';

import { WarehousesService } from '../../../core/api/store.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../../shared/components/control-messages.component';
import { LocationPickerComponent } from '../../location-picker/location-picker.component';

/** Alta y edición de una bodega. */
@Component({
  selector: 'app-warehouse-form',
  templateUrl: './warehouse-form.component.html',
  styleUrls: ['./warehouse-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    LocationPickerComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
  ],
})
export class WarehouseFormComponent {
  private readonly warehouses = inject(WarehousesService);
  private readonly picker = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly warehouse = input<Warehouse | null>(null);
  readonly asModal = input(true);

  readonly saved = output<Warehouse>();

  readonly saving = signal(false);
  readonly location = signal<LocationInput | null>(null);
  readonly imagePreview = signal<string | null>(null);

  private readonly pendingImage = signal<Blob | null>(null);

  readonly isEdit = computed(() => this.warehouse() !== null);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    description: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    const current = this.warehouse();

    if (current) {
      this.form.patchValue({
        name: current.name,
        description: current.description ?? '',
      });
      this.imagePreview.set(current.media?.url ?? null);

      if (current.location) {
        const { id: _id, ...rest } = current.location;
        this.location.set(rest);
      }
    }
  }

  async pickImage(): Promise<void> {
    const blob = await this.picker.pick({ aspectRatio: 16 / 9, targetWidth: 1600 });

    if (!blob) {
      return;
    }

    const previous = this.imagePreview();

    // Sólo se revoca lo que hayamos creado nosotros; la URL que viene del
    // servidor no es un object URL.
    if (previous?.startsWith('blob:')) {
      URL.revokeObjectURL(previous);
    }

    this.pendingImage.set(blob);
    this.imagePreview.set(URL.createObjectURL(blob));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      const values = this.form.getRawValue();
      const payload = {
        name: values.name,
        description: values.description || null,
        location: this.location(),
      };

      const current = this.warehouse();
      let result = current
        ? await this.warehouses.update(current.id, payload)
        : await this.warehouses.create(payload);

      const image = this.pendingImage();

      if (image) {
        result = await this.warehouses.setImage(result.id, image, 'warehouse.webp');
        this.pendingImage.set(null);
      }

      this.saved.emit(result);

      if (this.asModal()) {
        await this.modalCtrl.dismiss(result, 'saved');
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }
}
