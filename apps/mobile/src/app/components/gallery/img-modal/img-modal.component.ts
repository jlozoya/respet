import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Media } from '@respet/shared';

import { CarouselComponent } from '../carousel/carousel.component';

/**
 * Visor de imágenes sueltas, sin nada alrededor.
 *
 * Lo usan las galerías que no cuelgan de una publicación —las de un producto,
 * por ejemplo—. Las de una publicación abren su detalle, que enseña las fotos
 * y los comentarios en la misma ventana.
 */
@Component({
  selector: 'app-img-modal',
  templateUrl: './img-modal.component.html',
  styleUrls: ['./img-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    CarouselComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
})
export class ImgModalComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly images = input<readonly Media[]>([]);
  readonly startIndex = input(0);

  /** Índice visible, que el carrusel va cantando. */
  readonly currentIndex = signal(0);

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }
}
