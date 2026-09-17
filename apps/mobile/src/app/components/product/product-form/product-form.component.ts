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
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Media, Product, Warehouse } from '@respet/shared';

import { ProductsService, WarehousesService } from '../../../core/api/store.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../../shared/components/control-messages.component';

const MAX_IMAGES = 8;

interface PendingImage {
  blob: Blob;
  previewUrl: string;
}

/**
 * Alta y edición de un producto.
 *
 * Reemplaza al par `product-form` + `product-modal`: el segundo sólo servía
 * para envolver al primero en una ventana, cosa que ahora resuelve el
 * parámetro `asModal`.
 */
@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
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
    IonSelect,
    IonSelectOption,
  ],
})
export class ProductFormComponent {
  private readonly products = inject(ProductsService);
  private readonly warehouses = inject(WarehousesService);
  private readonly picker = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly product = input<Product | null>(null);
  readonly warehouseId = input<string | null>(null);
  readonly asModal = input(true);

  readonly saved = output<Product>();

  readonly saving = signal(false);
  readonly availableWarehouses = signal<readonly Warehouse[]>([]);
  readonly pending = signal<readonly PendingImage[]>([]);
  readonly existing = signal<readonly Media[]>([]);

  readonly isEdit = computed(() => this.product() !== null);
  readonly imageCount = computed(() => this.existing().length + this.pending().length);
  readonly canAddImages = computed(() => this.imageCount() < MAX_IMAGES);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(190)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    price: [0, [Validators.required, Validators.min(0)]],
    warehouseId: [null as string | null],
  });

  constructor() {
    const current = this.product();

    if (current) {
      this.form.patchValue({
        name: current.name,
        description: current.description,
        stock: current.stock,
        price: current.price,
        warehouseId: current.warehouse?.id ?? null,
      });
      this.existing.set(current.media);
    } else if (this.warehouseId()) {
      this.form.patchValue({ warehouseId: this.warehouseId() });
    }

    void this.loadWarehouses();
  }

  async addImage(): Promise<void> {
    if (!this.canAddImages()) {
      await this.feedback.toast('PRODUCT.MAX_IMAGES', { color: 'warning' });

      return;
    }

    const blob = await this.picker.pick({ aspectRatio: 1, targetWidth: 1600 });

    if (blob) {
      this.pending.update((current) => [
        ...current,
        { blob, previewUrl: URL.createObjectURL(blob) },
      ]);
    }
  }

  removePending(image: PendingImage): void {
    URL.revokeObjectURL(image.previewUrl);
    this.pending.update((current) => current.filter((item) => item !== image));
  }

  async removeExisting(media: Media): Promise<void> {
    const current = this.product();

    if (!current) {
      return;
    }

    try {
      await this.products.removeImage(current.id, media.id);
      this.existing.update((items) => items.filter((item) => item.id !== media.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      const values = this.form.getRawValue();
      const current = this.product();

      let result = current
        ? await this.products.update(current.id, values)
        : await this.products.create(values);

      result = await this.uploadPending(result);

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

  private async uploadPending(product: Product): Promise<Product> {
    const images = this.pending();

    if (images.length === 0) {
      return product;
    }

    const uploaded: Media[] = [];

    for (const image of images) {
      try {
        uploaded.push(await this.products.addImage(product.id, image.blob));
        URL.revokeObjectURL(image.previewUrl);
      } catch (error) {
        await this.feedback.error(error, 'PRODUCT.IMAGE_UPLOAD_FAILED');
      }
    }

    this.pending.set([]);

    return { ...product, media: [...product.media, ...uploaded] };
  }

  private async loadWarehouses(): Promise<void> {
    try {
      const page = await this.warehouses.list({ perPage: 100 });
      this.availableWarehouses.set(page.data);
    } catch {
      // La bodega es opcional: si no se puede listar, el formulario sigue
      // sirviendo para crear el producto sin asignarla.
      this.availableWarehouses.set([]);
    }
  }
}
