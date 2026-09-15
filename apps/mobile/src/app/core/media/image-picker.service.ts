import { Injectable, inject } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslateService } from '@ngx-translate/core';

import { CropImgComponent } from '../../modals/crop-img/crop-img.component';

/** Formatos que aceptamos, los mismos que valida el servidor. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export interface PickOptions {
  /** Proporción del recorte: 1 para avatares, 4/3 o 16/9 para portadas. */
  aspectRatio?: number;
  /** Ancho al que se reduce la imagen recortada. */
  targetWidth?: number;
  /** Salta el recorte y devuelve la imagen tal cual. */
  skipCrop?: boolean;
}

/**
 * Selección de imágenes desde la cámara o la galería.
 *
 * Reemplaza a `TransferImgFileService`, que combinaba `@ionic-native/file`,
 * `file-path` y `crop` —tres plugins de Cordova ya sin mantenimiento— y
 * devolvía cadenas base64. Aquí todo son `Blob` y `File`, que es lo que la API
 * recibe en un formulario multipart.
 */
@Injectable({ providedIn: 'root' })
export class ImagePickerService {
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);

  /**
   * Pide una imagen al usuario y la devuelve recortada.
   *
   * Devuelve `null` si cancela en cualquier paso, que es lo normal y no un
   * error.
   */
  async pick(options: PickOptions = {}): Promise<Blob | null> {
    const source = await this.chooseSource();

    if (!source) {
      return null;
    }

    const file = await this.capture(source);

    if (!file) {
      return null;
    }

    return options.skipCrop ? file : this.crop(file, options);
  }

  /**
   * Toma las imágenes de un `<input type="file">` o de un arrastrar y soltar.
   *
   * Descarta lo que no sea una imagen de un formato admitido, para no gastar
   * una subida en un archivo que el servidor va a rechazar.
   */
  fromFileList(files: FileList | null): File[] {
    if (!files) {
      return [];
    }

    return Array.from(files).filter((file) => ACCEPTED_TYPES.includes(file.type));
  }

  /** Abre el recortador sobre una imagen ya elegida. */
  async crop(file: File | Blob, options: PickOptions = {}): Promise<Blob | null> {
    const modal = await this.modalCtrl.create({
      component: CropImgComponent,
      componentProps: {
        imageFile: file instanceof File ? file : new File([file], 'image', { type: file.type }),
        aspectRatio: options.aspectRatio ?? 1,
        targetWidth: options.targetWidth ?? 800,
      },
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss<Blob | undefined>();

    return role === 'img' && data ? data : null;
  }

  private async chooseSource(): Promise<CameraSource | null> {
    const sheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('SELECT_IMAGE_SOURCE') as string,
      buttons: [
        {
          text: this.translate.instant('CAMERA') as string,
          icon: 'camera-outline',
          data: CameraSource.Camera,
        },
        {
          text: this.translate.instant('GALLERY') as string,
          icon: 'images',
          data: CameraSource.Photos,
        },
        {
          text: this.translate.instant('CANCEL') as string,
          icon: 'close-circle-outline',
          role: 'cancel',
        },
      ],
    });

    await sheet.present();

    const { data, role } = await sheet.onWillDismiss<CameraSource>();

    return role === 'cancel' ? null : (data ?? null);
  }

  private async capture(source: CameraSource): Promise<File | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        // El recorte lo hace nuestro modal, igual en todas las plataformas; el
        // editor nativo se comporta de forma distinta en Android y en iOS.
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
      });

      if (!photo.webPath) {
        return null;
      }

      // `webPath` es una URL local que el WebView sí puede leer; `fetch` la
      // convierte en un Blob sin pasar por base64.
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      return new File([blob], `photo.${photo.format || 'jpeg'}`, { type: blob.type });
    } catch {
      // El plugin lanza una excepción también cuando el usuario cancela.
      return null;
    }
  }
}
