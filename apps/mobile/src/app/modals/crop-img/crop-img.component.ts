import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import { ImageCropperComponent, type ImageCroppedEvent } from 'ngx-image-cropper';

/**
 * Recorte de una imagen antes de subirla.
 *
 * Devuelve un `Blob`, no una cadena base64 como antes: la API recibe los
 * archivos en un formulario multipart, así que codificarla a base64 sólo
 * añadiría un tercio de peso y una conversión de vuelta.
 *
 * Se cierra con el rol `img` y el `Blob` como dato, o sin dato si se cancela.
 */
@Component({
  selector: 'app-crop-img',
  templateUrl: 'crop-img.component.html',
  styleUrls: ['crop-img.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    ImageCropperComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
})
export class CropImgComponent {
  private readonly modalCtrl = inject(ModalController);

  /** Imagen de partida, tal y como la entrega la cámara o el selector. */
  readonly imageFile = input<File | undefined>(undefined);
  readonly imageBase64 = input<string | undefined>(undefined);
  readonly aspectRatio = input(1);
  readonly targetWidth = input(800);

  private readonly cropped = signal<Blob | null>(null);
  readonly ready = signal(false);

  onCropped(event: ImageCroppedEvent): void {
    this.cropped.set(event.blob ?? null);
    this.ready.set(Boolean(event.blob));
  }

  onFailed(): void {
    void this.modalCtrl.dismiss(undefined, 'error');
  }

  accept(): void {
    void this.modalCtrl.dismiss(this.cropped(), 'img');
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }
}
