import { TranslateService } from '@ngx-translate/core';
import { ToastController, LoadingController, Events, AlertController } from '@ionic/angular';
import { Component, OnInit, Input } from '@angular/core';
import { User, SocialLoginService, ApiService, StorageService } from './../../../../providers/providers';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss']
})
export class OptionsComponent implements OnInit {

  @Input()hasLinked = {
    google: false,
    facebook: false
  };
  @Input()user: User;
  @Input()isSelf = true;

  constructor(
    private api: ApiService,
    private socialLogin: SocialLoginService,
    private translate: TranslateService,
    private toastCtrl: ToastController,
    private storage: StorageService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private events: Events
  ) { }

  ngOnInit() {
  }

  /**
   * Vincula una cuenta de usuario con una red social.
   * @param {'google' | 'facebook'} socialNetwork
   */
  addSocialLink(socialNetwork: 'google' | 'facebook') {
    if (this.isSelf) {
      switch (socialNetwork) {
        case 'google': {
          this.socialLogin.googleLink().then((socialLink) => {
            this.user.social_links.push(socialLink);
            this.hasLinked.google = true;
          }, (fail) => {
            console.log('[options-48]', fail);
          });
        }
        break;
        case 'facebook': {
          this.socialLogin.facebookLink().then((socialLink) => {
            this.user.social_links.push(socialLink);
            this.hasLinked.facebook = true;
          }, (fail) => {
            console.log('[options-57]', fail);
          });
        }
        break;
      }
    } else {
      this.presentToast(this.translate.instant('ERRORS.NOT_IS_YOUR_ACCOUNT'));
    }
  }
  /**
   * Elimina el vínculo de una red social.
   * @param {'google' | 'facebook'} socialNetwork
   */
  removeSocialLink(socialNetwork: 'google' | 'facebook') {
    if (this.isSelf) {
      const socialNetworkValue = this.user.social_links.find((socialLink) => {
        return socialLink.grant_type === socialNetwork;
      });
      if (socialNetworkValue) {
        this.api.delete(`/user/social/link/${socialNetworkValue.id}`).then(() => {
          this.presentToast(this.translate.instant('SERVER.SOCIAL_LINK_DELETED'));
          switch (socialNetworkValue.grant_type) {
            case 'google': {
              this.hasLinked.google = false;
            } break;
            case 'facebook': {
              this.hasLinked.facebook = false;
            } break;
          }
          this.user.social_links.splice(this.user.social_links.indexOf(socialNetworkValue), 1);
        }, (fail) => {
          if (typeof fail === 'string') {
            this.presentToast(this.translate.instant(fail));
          }
          console.log('[options-91]', fail);
        });
      }
    } else {
      this.presentToast(this.translate.instant('ERRORS.NOT_IS_YOUR_ACCOUNT'));
    }
  }

  /**
   * Proporciona al usuario la opción de recuperar su contraseña.
   */
  async changePassword() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.RECOVER_PASSWORD.TITLE'),
      message: this.translate.instant('ALERTS.RECOVER_PASSWORD.MESSAGE'),
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel',
          handler: () => {}
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: async () => {
            const recoveringPasswordLogin = await this.loadingCtrl.create(
              {message: this.translate.instant('RECOVERING_PASSWORD')});
            await recoveringPasswordLogin.present();
            this.storage.getEmail().then((email) => {
              const query = {
                email: email,
                grant_type: 'password'
              };
              this.api.post('/password/email', query).then(async (response: any) => {
                this.presentToast(this.translate.instant('FORM.CHECK_YOUR_EMAIL'));
                recoveringPasswordLogin.dismiss();
              }, (fail) => {
                recoveringPasswordLogin.dismiss();
                this.presentToast(this.translate.instant('ERRORS.RECOVERING_PASSWORD'));
                console.log('[account-333]', fail);
              });
            });
          }
        }
      ]
    });
    await alert.present();
  }
  /**
   * Establece el rol del usuario.
   * @param event
   */
  changeRole(event) {
    this.api.put(`/user/role/${this.user.id}`, {role: event.target.value}).then((userRole) => {
      this.user.role = userRole;
      if (this.isSelf) {
        this.events.publish('user:role', userRole);
      }
    }, (fail) => {
      console.log('[account-300]', fail);
    });
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
