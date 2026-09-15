import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonDatetime } from '@ionic/angular/ion-datetime';
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
import type { Bulletin } from '@respet/shared';

import { BulletinsService } from '../../../core/api/content.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../../shared/components/control-messages.component';

/** Alta y edición de un aviso. Reemplaza a `modal-bulletin`. */
@Component({
  selector: 'app-bulletin-form',
  templateUrl: './bulletin-form.component.html',
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
    IonDatetime,
  ],
})
export class BulletinFormComponent {
  private readonly bulletins = inject(BulletinsService);
  private readonly picker = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly bulletin = input<Bulletin | null>(null);

  readonly saving = signal(false);
  readonly imagePreview = signal<string | null>(null);

  private readonly pendingImage = signal<Blob | null>(null);

  readonly isEdit = computed(() => this.bulletin() !== null);

  readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(10_000)]],
    date: [new Date().toISOString().slice(0, 10), [Validators.required]],
  });

  constructor() {
    const current = this.bulletin();

    if (current) {
      this.form.patchValue({
        title: current.title,
        description: current.description,
        date: current.date,
      });
      this.imagePreview.set(current.media?.url ?? null);
    }
  }

  async pickImage(): Promise<void> {
    const blob = await this.picker.pick({ aspectRatio: 16 / 9, targetWidth: 1920 });

    if (!blob) {
      return;
    }

    const previous = this.imagePreview();

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
      // `ion-datetime` devuelve la fecha completa en ISO; la API espera sólo el día.
      const payload = { ...values, date: values.date.slice(0, 10) };

      const current = this.bulletin();
      let result = current
        ? await this.bulletins.update(current.id, payload)
        : await this.bulletins.create(payload);

      const image = this.pendingImage();

      if (image) {
        result = await this.bulletins.setImage(result.id, image, 'bulletin.webp');
        this.pendingImage.set(null);
      }

      await this.modalCtrl.dismiss(result, 'saved');
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
