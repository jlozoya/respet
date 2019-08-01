import { FacebookService, InitParams } from 'ngx-facebook';
import { Platform, ToastController, ActionSheetController, ModalController, NavParams,
  PopoverController, AlertController } from '@ionic/angular';
import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { OverlayEventDetail } from '@ionic/core';
import { User, Post, StorageService, ApiService } from './../../../providers/providers';
import { MapComponent } from './../../../modals/map/map.component';
import { PostUpdateComponenet } from './../post-update/post-update.component';
import { environment } from './../../../../environments/environment';

@Component({
  selector: 'app-post-card',
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss']
})
export class PostCardComponent implements OnInit {

  user: User;
  isBrowser = false;
  @Input()post: Post;
  @Output() appPostDeleted: EventEmitter<Post> = new EventEmitter();

  constructor(
    private translate: TranslateService,
    private toastCtrl: ToastController,
    private router: Router,
    private platform: Platform,
    private socialSharing: SocialSharing,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private api: ApiService,
    private fb: FacebookService,
    private alertCtrl: AlertController,
    private storage: StorageService
  ) {
    const initParams: InitParams = {
      appId: environment.FACEBOOK_APP_ID,
      xfbml: true,
      version: 'v3.2'
    };
    fb.init(initParams);
    this.isBrowser = (!this.platform.is('android') && !this.platform.is('ios')) || this.platform.is('mobileweb');
  }

  async ngOnInit() {
    this.user = await this.storage.getUser();
  }
  /**
   * Navega hacia la pagina del usuario.
   * @param {User} user
   */
  goToAccount(user: User) {
    this.router.navigate(['/wall', user.id]);
  }
  /**
   * Despliega un action sheet.
   * @param {Post} post
   */
  async presentActionSheet(post: Post) {
    const browser = [{
      text: 'Twitter',
      icon: 'logo-twitter',
      handler: () => {
        this.doShare('twitter', post);
      }
    }, {
      text: 'Whatsapp',
      icon: 'logo-whatsapp',
      handler: () => {
        this.doShare('whatsapp', post);
      }
    }, {
      text: 'Facebook',
      icon: 'logo-facebook',
      handler: () => {
        this.doShare('facebook', post);
      }
    }];
    const movile = [{
      text: 'Twitter',
      icon: 'logo-twitter',
      handler: () => {
        this.doShare('twitter', post);
      }
    }, {
      text: 'Whatsapp',
      icon: 'logo-whatsapp',
      handler: () => {
        this.doShare('whatsapp', post);
      }
    }, {
      text: 'Facebook',
      icon: 'logo-facebook',
      handler: () => {
        this.doShare('facebook', post);
      }
    }, {
      text: 'Instagram',
      icon: 'logo-instagram',
      handler: () => {
        this.doShare('instagram', post);
      }
    }];
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('SHARE'),
      buttons: (this.isBrowser) ? browser : movile
    });
    await actionSheet.present();
  }
  async openMap(post: Post) {
    const mapModal = await this.modalCtrl.create({
      component: MapComponent,
      componentProps: {post}
    });
    mapModal.present();
  }
  /**
   * Abre la pagina correspondiente para compartir contenido.
   * @param {String} via
   * @param {Post} post
   */
  async doShare(via: string, post: Post) {
    const url = `${environment.APP_URL}/#/posts/${post.id}`;
    const media = post.media[0] ? post.media[0].url : `${environment.APP_URL}/assets/imgs/appicon.png`;
    switch (via) {
      case 'facebook': {
        if (this.isBrowser) {
          this.fb.ui({
            method: 'share_open_graph',
            action_type: 'og.shares',
            action_properties: JSON.stringify({
              object: {
                'og:url': url,
                'og:title': post.description,
                'og:description': post.description.replace(/(&nbsp;|<([^>]+)>)/ig, ' '),
                'og:image': media || '""',
                'og:image:url': media || '""',
                'og:image:alt': media || '""'
              }
            })
          });
        } else {
          this.socialSharing.shareViaFacebook('message', media, url).then((response) => {
            console.log(response);
          }).catch((error) => {
            console.log('[post-card-133]', JSON.stringify(error));
            this.presentToast(this.translate.instant('SHARE.ERROR.FACEBOOK'));
          });
        }
      } break;
      case 'twitter': {
        if (this.isBrowser) {
          window.open(`https://twitter.com/share?url=${encodeURIComponent(media)}&text=${encodeURIComponent(post.description)}`);
        } else {
          this.socialSharing.shareViaTwitter('message', media, url).then((response) => {
            console.log(response);
          }).catch((error) => {
            console.log('[post-card-145]', JSON.stringify(error));
            this.presentToast(this.translate.instant('SHARE.ERROR.TWITTER'));
          });
        }
      } break;
      case 'instagram': {
        if (this.isBrowser) {
          this.presentToast(this.translate.instant('SHARE.ERROR.INSTAGRAM'));
        } else {
          this.socialSharing.shareViaInstagram('message', media).then((response) => {
            console.log(response);
          }).catch((error) => {
            console.log('[post-card-157]', JSON.stringify(error));
            this.presentToast(this.translate.instant('SHARE.ERROR.INSTAGRAM'));
          });
        }
      } break;
      case 'whatsapp': {
        if (this.isBrowser) {
          window.location.href = `whatsapp://send?text=${encodeURIComponent(post.description)} ${url}`;
        } else {
          this.socialSharing.shareViaWhatsApp('message', media, url).then((response) => {
            console.log(response);
          }).catch((error) => {
            console.log('[post-card-169]', JSON.stringify(error));
            this.presentToast(this.translate.instant('SHARE.ERROR.WHATSAPP'));
          });
        }
      } break;
    }
  }
  /**
   * Muestra un popover.
   * @param event
   */
  async openPop(event) {
    const popoverCtrl = await this.popoverCtrl.create({
      component: PostCardPopComponent,
      componentProps: { user_id: this.post.user.id },
      event: event
    });
    await popoverCtrl.present();
    await popoverCtrl.onDidDismiss().then((result: OverlayEventDetail) => {
      switch (result.data) {
        case 'update': {
          this.update();
        } break;
        case 'delete': {
          this.delete();
        } break;
        case 'report': {
          this.report();
        } break;
      }
    });
  }
  /**
   * Actualiza un registro.
   */
  async update() {
    const modalCtrl = await this.modalCtrl.create({
      component: PostUpdateComponenet,
      componentProps: { postId: this.post.id }
    });
    await modalCtrl.present();
    modalCtrl.onDidDismiss().then((response: OverlayEventDetail) => {
      if (response.data) {
        this.post = response.data;
      }
    });
  }
  /**
   * Elimina un registro.
   */
  async delete() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.DELETE_PET.TITLE'),
      message: this.translate.instant('ALERTS.DELETE_PET.MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel',
          handler: () => {}
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: async () => {
            this.api.delete(`/post/${this.post.id}`).then(() => {
              this.appPostDeleted.emit(this.post);
            }, (error) => {
              console.log('[post-card-246]', error);
            });
          }
        }
      ]
    });
    await alert.present();
  }
  /**
   * Abre un alert.
   */
  async report() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.REPORT_PET.TITLE'),
      message: this.translate.instant('ALERTS.REPORT_PET.MESSAGE'),
      inputs: [
        {
          type: 'text',
          name: 'description',
          value: ''
        }
      ],
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel',
          handler: () => {}
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: async (data: any) => {
            if (data) {
              const query = {
                description: data.description
              };
              this.api.post(`/post/report/${this.post.id}`, query).then(() => {
                this.presentToast(this.translate.instant('ALERT.REPORT_PET.SUCCESS'));
              }, (fail) => {
                this.presentToast(this.translate.instant('ALERT.REPORT_PET.FAIL'));
                console.log('[post-card-285]', fail);
              });
            }
          }
        }
      ]
    });
    await alert.present();
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

@Component({
  selector: 'app-post-card-pop',
  template: `<ion-list *ngIf="isSelf">
    <ion-item (click)="dissmis('update')">{{ "UPDATE" | translate }}</ion-item>
    <ion-item (click)="dissmis('delete')">{{ "DELETE" | translate }}</ion-item>
  </ion-list>
  <ion-list *ngIf="!isSelf">
    <ion-item (click)="dissmis('report')">{{ "REPORT" | translate }}</ion-item>
  </ion-list>`
})
export class PostCardPopComponent implements OnInit {

  isSelf = false;

  constructor(
    private popoverCtrl: PopoverController,
    private navParams: NavParams,
    private storage: StorageService
  ) {
  }

  async ngOnInit() {
    const user = await this.storage.getUser();
    this.isSelf = (user.id === this.navParams.get('user_id'));
  }

  dissmis(acction: string) {
    this.popoverCtrl.dismiss(acction);
  }
}
