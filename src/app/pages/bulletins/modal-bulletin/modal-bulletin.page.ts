import { ApiService, Bulletin, TransferImgFileService } from './../../../providers/providers';
import { FormBuilder, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams, Platform, LoadingController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-modal-bulletin',
  templateUrl: './modal-bulletin.page.html',
  styleUrls: ['./modal-bulletin.page.scss'],
})
export class ModalBulletinPage implements OnInit {

  bulletin_id: number;
  bulletinForm;
  isReadyToSubmit = false;
  isBrowser = false;
  img = './assets/imgs/bulletin/newspaper.png';
  lastImg = '';

  constructor(
    private modalCtrl: ModalController,
    private navParams: NavParams,
    private formBuilder: FormBuilder,
    private api: ApiService,
    private platform: Platform,
    private transferImgFile: TransferImgFileService,
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private toastCtrl: ToastController
  ) {
    this.isBrowser = (!this.platform.is('android') && !this.platform.is('ios')) || this.platform.is('mobileweb');
    this.bulletin_id = this.navParams.get('bulletin_id');
    if (this.bulletin_id) { this.getBulletin(this.bulletin_id); }
  }
  /**
   * Se ejecuta después del modal.
   */
  ngOnInit() {
    this.bulletinForm = this.formBuilder.group({
      id: ['', Validators.nullValidator],
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', Validators.required],
      date: [new Date().toISOString(), Validators.required]
    });
    this.bulletinForm.valueChanges.subscribe((v) => {
      this.isReadyToSubmit = this.bulletinForm.valid;
    });
  }
  /**
   * Obtiene la información de una noticia por su id.
   * @param {number} id
   */
  getBulletin(id: number) {
    this.api.get(`/bulletin/${id}`).then((bulletin: Bulletin) => {
      this.bulletinForm.patchValue({
        id: bulletin.id,
        title: bulletin.title,
        description: bulletin.description,
        date: bulletin.date
      });
      if (bulletin.media && bulletin.media.url) {
        this.img = bulletin.media.url;
        this.lastImg = bulletin.media.url;
      }
    }, fail => {
      console.log('[modal-bulletin-63]', fail);
    });
  }
  /**
   * Maneja la captura de imágenes desde móviles o páginas web.
   * @param {string} img
   */
  getBulletinImg(img?: string): void {
    this.transferImgFile.getImg(img).then(async (imgUrl) => {
      if (imgUrl !== './assets/imgs/bulletin/newspaper.png') {
        this.img = imgUrl;
      }
    });
  }
  /**
   * Envía la información de una noticia para crearla o actualizarla.
   */
  async sendBulletin() {
    let date = this.bulletinForm.value.date;
    date = (date.year) ? `${date.year.text}-${date.month.text}-${date.day.text}` : date;
    const query: Bulletin = {
      id: this.bulletinForm.value.id,
      title: this.bulletinForm.value.title,
      description: this.bulletinForm.value.description,
      date: date,
    };
    if (!this.bulletin_id) {
      const loading = await this.loadingCtrl.create({
        message: this.translate.instant('BULLETIN.MODALS.BULLETIN.UPLOAD'),
      });
      await loading.present();
      this.api.post('/bulletin', query).then(async (bulletin: Bulletin) => {
        this.uploadBulletinImg(bulletin, 'create');
        await loading.dismiss();
      }, async (fail) => {
        await loading.dismiss();
        if (typeof fail === 'string') {
          this.presentToast(this.translate.instant(fail));
        } else {
          this.presentToast(this.translate.instant('FORM.FAIL'));
        }
        console.log('[modal-bulletin-109]', fail);
      });
    } else {
      const loading = await this.loadingCtrl.create({
        message: this.translate.instant('BULLETIN.MODALS.BULLETIN.UPDATE'),
      });
      await loading.present();
      this.api.put('/bulletin', query).then(async (bulletin: Bulletin) => {
        this.uploadBulletinImg(bulletin, 'update');
        await loading.dismiss();
      }, async (fail) => {
        await loading.dismiss();
        if (typeof fail === 'string') {
          this.presentToast(this.translate.instant(fail));
        } else {
          this.presentToast(this.translate.instant('FORM.FAIL'));
        }
        console.log('[modal-bulletin-124]', fail);
      });
    }
  }
  /**
   * Sube la imagen seleccionada.
   * @param {Bulletin} bulletin
   */
  async uploadBulletinImg(bulletin: Bulletin, action: 'update' | 'create') {
    if ((action === 'create' && this.img !== './assets/imgs/bulletin/newspaper.png') ||
    (action === 'update' && this.img !== this.lastImg && this.img !== './assets/imgs/bulletin/newspaper.png')) {
      const loading = await this.loadingCtrl.create({
        message: this.translate.instant('UPDATING_IMG'),
      });
      await loading.present();
      this.transferImgFile.uploadImg(
        '/bulletin/img', this.img,
        {params: {bulletin_id: bulletin.id}}
      ).then(async (response: Bulletin) => {
        await loading.dismiss();
        this.dismiss(response);
      }, async (fail) => {
        await loading.dismiss();
        console.log('[modal-bulletin-148]', fail);
      });
    } else {
      this.dismiss(bulletin);
    }
  }
  /**
   * Cierra el modal.
   * @param {Bulletin} bulletin
   */
  dismiss(bulletin?: Bulletin): void {
    this.modalCtrl.dismiss(bulletin);
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
    await toast.present();
  }
}
