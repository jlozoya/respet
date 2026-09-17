import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import type { Media } from '@respet/shared';

import { ImgModalComponent } from './img-modal/img-modal.component';

/** Cómo se reparten las imágenes en la cuadrícula. */
interface GalleryLayout {
  /** Imagen destacada a ancho completo, si la composición la lleva. */
  hero: Media | null;
  /** Resto de imágenes visibles. */
  tiles: readonly Media[];
  /** Columnas de 12 que ocupa cada miniatura. */
  tileSize: number;
  /** Imágenes que no caben y se anuncian con un «+N». */
  extra: number;
}

@Component({
  selector: 'app-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly images = input<readonly Media[]>([]);

  /**
   * Composición de la cuadrícula según cuántas imágenes haya, o `null` si no
   * hay ninguna: sin fotos no se pinta ni el contenedor, que si no dejaba un
   * elemento vacío entre el texto y lo que viniera debajo.
   *
   * Antes esto era un `[ngSwitch]` con seis ramas casi idénticas dentro de la
   * plantilla; calcularlo aquí deja el marcado en un solo bloque.
   */
  readonly layout = computed<GalleryLayout | null>(() => {
    const items = this.images();

    switch (items.length) {
      case 0:
        return null;
      case 1:
        return { hero: items[0] ?? null, tiles: [], tileSize: 12, extra: 0 };
      case 2:
      case 4:
        return { hero: null, tiles: items, tileSize: 6, extra: 0 };
      case 3:
        return { hero: items[0] ?? null, tiles: items.slice(1), tileSize: 6, extra: 0 };
      default:
        return {
          hero: items[0] ?? null,
          tiles: items.slice(1, 5),
          tileSize: 3,
          extra: Math.max(0, items.length - 5),
        };
    }
  });

  async openViewer(image: Media): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ImgModalComponent,
      componentProps: { images: this.images(), startIndex: Math.max(0, this.images().indexOf(image)) },
    });

    await modal.present();
  }
}
