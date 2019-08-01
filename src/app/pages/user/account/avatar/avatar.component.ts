import { Media } from './../../../../providers/models/models';
import { CropImgComponent } from './../../../../modals/crop-img/crop-img.component';
import { TransferImgFileService, StorageService, User } from './../../../../providers/providers';
import { Platform, ToastController, ModalController, LoadingController, Events } from '@ionic/angular';
import { Component, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OverlayEventDetail } from '@ionic/core';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {

  enterTarget = null;
  dragClasses = {
    onDrag: false,
  };
  isBrowser = true;
  @Input()user: User;
  @Input()isSelf = true;
  @Input()file: Media = {
    url: './assets/imgs/warehouse.png',
    alt: 'warehouse.png'
  };

  constructor(
    private transferImgFile: TransferImgFileService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private storage: StorageService,
    private events: Events,
    private platform: Platform
  ) {
    this.isBrowser = !this.platform.is('android') && !this.platform.is('ios');
  }

  ngOnInit() {
  }

  /**
   * Maneja la captura de imágenes desde móviles o páginas web.
   * @param {string} img
   */
  uploadNewAvatarImg(img?: string): void {
    this.transferImgFile.getImg(img).then((imgUrl) => {
      if (imgUrl !== './assets/imgs/avatar.png') {
        this.cropImg(imgUrl, {targetWidth: 300}).then((newImg) => {
          if (newImg) {
            this.file = {url: newImg, alt: 'croped_img'};
            this.uploadAvatar(newImg);
          }
        }, (fail) => {
          console.log('[avatar-49]', fail);
          console.log(JSON.stringify(fail));
        });
      }
    }, (fail) => {
      console.log('[avatar-54]', fail);
      this.presentToast(fail);
    });
  }
  /**
   * Rectora las imágenes seleccionadas.
   * @param {string} imgUrl
   * @param {aspectRatio?: string, targetWidth?: number} params
   */
  public cropImg(imgUrl: string, params?: {targetWidth?: number,
    aspectRatio?: string}): Promise<string> {
    return new Promise((success) => {
      this.modalCtrl.create(
        {
          component: CropImgComponent,
          componentProps: {
            imageBase64: imgUrl,
            aspectRatio: params.aspectRatio,
            targetWidth: params.targetWidth
          }
        }
      ).then((modalCropImg: HTMLIonModalElement) => {
        modalCropImg.present();
        modalCropImg.onDidDismiss().then((detail: OverlayEventDetail) => {
          success(detail.data);
        });
      });
    });
  }
  /**
   * Envia las imagenes al servidor.
   * @param {string} img
   */
  async uploadAvatar(img: string) {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('UPDATING_IMG'),
    });
    loading.present();
    if (this.isSelf) {
      this.transferImgFile.uploadImg('/user/avatar', img).then(
        async (response) => {
        this.storage.setImgUrl(response);
        this.events.publish('user:avatar', response);
        loading.dismiss();
        console.log('[avatar-98]', response);
      }, async (fail) => {
        loading.dismiss();
        console.log('[avatar-101]', fail);
      });
    } else {
      this.transferImgFile.uploadImg(`/user/avatar/${this.user.id}`, img)
      .then(async (response) => {
        loading.dismiss();
        console.log('[avatar-107]', response);
      }, async (fail) => {
        loading.dismiss();
        console.log('[avatar-110]', fail);
      });
    }
  }
  /**
   * Seleciona archivos al dejarlos caer.
   * @param event
   */
  onDrop(event) {
    event.preventDefault();
    let first = true;
    this.transferImgFile.getMultipleBase64Imgs(event.dataTransfer).subscribe((file) => {
      if (first) {
        this.cropImg(file.url, {targetWidth: 300}).then((newImg) => {
          if (newImg) {
            this.file = { url: newImg, alt: 'croped_img' };
            this.uploadAvatar(newImg);
          }
        }, (fail) => {
          console.log('[avatar-49]', fail);
          console.log(JSON.stringify(fail));
        });
      }
      first = false;
    });
    this.dragClasses.onDrag = false;
  }
  /**
   * Al desplazar un objeto sobre un elemento de la pagina.
   * @param event
   */
  onDragEnter(event) {
    this.enterTarget = event.target;
  }
  /**
   * Al desplazar un objeto sobre un elemento especifico de la pagina.
   * @param event
   */
  onDragOver(event) {
    event.stopPropagation();
    event.preventDefault();
    this.dragClasses.onDrag = true;
  }
  /**
   * Al salir del elemento arrastrando un objeto.
   * @param event
   */
  onDragLeave(event) {
    if (this.enterTarget === event.target && this.dragClasses.onDrag) {
      event.stopPropagation();
      event.preventDefault();
      this.dragClasses.onDrag = false;
    }
  }
  /**
  * Presenta un cuadro de mensaje.
  * @param {string} text Mensaje a mostrar.
  */
  async presentToast(text: string) {
    const toast = await this.toastCtrl.create({
      message: text,
      duration: 3000,
      position: 'bottom'
    });
    toast.present();
  }
}
