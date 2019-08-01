import { TranslateService } from '@ngx-translate/core';
import { PopAdminBulletin } from './pop-admin-bulletin/pop-admin-bulletin';
import { OverlayEventDetail } from '@ionic/core';
import { ModalController, PopoverController, AlertController } from '@ionic/angular';
import { Component, OnInit, NgZone } from '@angular/core';
import { ApiService, Pagination, Bulletin, StorageService } from '../../providers/providers';
import { ModalBulletinPage } from './modal-bulletin/modal-bulletin.page';

@Component({
  selector: 'app-bulletins',
  templateUrl: './bulletins.page.html',
  styleUrls: ['./bulletins.page.scss']
})
export class BulletinsPage implements OnInit {

  bulletins: Bulletin[] = [];
  lastPage = 1;
  userRole = 'visitor';

  constructor(
    private api: ApiService,
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private storage: StorageService,
    private alertCtrl: AlertController,
    private translate: TranslateService,
    private zone: NgZone
  ) {
    this.storage.getUserRole().then((userRole) => {
      this.userRole = userRole;
    });
  }
  /**
   * Se ejecuta despues del constructor.
   */
  ngOnInit() {
    this.getBulletins();
  }
  /**
   * Obtiene las ultimas noticias publicadas.
   * @param {number} page
   * @return {Promise<boolean>} Regresa verdadero en caso de obtener más información y false en caso de obtener un error.
   */
  getBulletins(page: number = 1): Promise<boolean> {
    return new Promise(result => {
      this.api.get(`/bulletins?page=${page}`).then((pages: Pagination) => {
        if (page === 1) {
          this.bulletins = pages.data;
        } else {
          pages.data.map(bulletin => {
            this.bulletins.push(bulletin);
          });
        }
        result(true);
      }, fail => {
        console.log('[bulletin-52]', fail);
        result(false);
      });
    });
  }
  /**
   * Refresca la página.
   * @param event
   */
  doRefresh(event) {
    this.getBulletins().then(() => {
      event.target.complete();
    });
  }
  /**
   * Llama a la función para cargar mas elementos cuando la página llega al final.
   * @param infiniteScroll
   */
  doScrollDown(infiniteScroll) {
    this.getBulletins(this.lastPage + 1).then(() => {
      infiniteScroll.target.complete();
    });
  }
  /**
   * Crear una nueva noticia.
   * @param {Bulletin} bulletin
   * @param {number} bulletin_id
   */
  async modalBulletin(bulletin?: Bulletin, bulletin_id?: number) {
    const modalBulletinPage: HTMLIonModalElement = await this.modalCtrl.create(
      {
        component: ModalBulletinPage,
        componentProps: {bulletin_id: bulletin_id}
      }
    );
    await modalBulletinPage.present();
    await modalBulletinPage.onDidDismiss().then((detail: OverlayEventDetail) => {
      if (detail.data) {
        if (this.bulletins.indexOf(bulletin) > -1) {
          this.bulletins[this.bulletins.indexOf(bulletin)] = detail.data;
        } else {
          this.getBulletins();
        }
      }
    });
  }
  /**
   * Despliega un popover.
   * @param {Event} event
   * @param {Bulletin} bulletin
   */
  async presentPopover(event: Event, bulletin: Bulletin) {
    const popover: HTMLIonPopoverElement = await this.popoverCtrl.create(
      {component: PopAdminBulletin, componentProps: {bulletin}, event: event}
    );
    await popover.present();
    await popover.onDidDismiss().then((detail: OverlayEventDetail) => {
      if (detail.data) {
        switch (detail.data) {
          case 'update': {
            this.modalBulletin(bulletin, bulletin.id);
          }
          break;
          case 'delete': {
            this.deleteBulletin(bulletin);
          }
          break;
        }
      }
    });
  }
  /**
   * Envía la instrucción para eliminar una noticia.
   * @param {Bulletin} bulletin
   */
  async deleteBulletin(bulletin: Bulletin) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('BULLETIN.ALERTS.DELETE_BULLETIN.TITLE'),
      message: this.translate.instant('BULLETIN.ALERTS.DELETE_BULLETIN.MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel',
          handler: () => { }
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: () => {
            this.api.delete(`/bulletin/${bulletin.id}`).then((response) => {
              this.zone.run(() => {
                this.bulletins.splice(this.bulletins.indexOf(bulletin), 1);
              });
            }, fail => {
              console.log('[bulletins-141]', fail);
            });
          }
        }
      ]
    });
    await alert.present();
  }
}
