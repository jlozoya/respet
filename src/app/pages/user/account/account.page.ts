import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { ApiService, User, StorageService, Media } from './../../../providers/providers';
import { TranslateService } from '@ngx-translate/core';
/**
 * Maneja la vista para administrar una cuenta de usuario.
 * @author <a href="mailto:jlozoya1995@gmail.com">Juan Lozoya</a>
 */
@Component({
  selector: 'app-account',
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss']
})
export class AccountPage implements OnInit {

  user: User;
  isSelf = false;
  file: Media = {
    url: './assets/imgs/avatar.png',
    alt: 'avatar.png'
  };
  hasLinked = {
    google: false,
    facebook: false
  };

  constructor(
    private toastCtrl: ToastController,
    private storage: StorageService,
    private api: ApiService,
    private translate: TranslateService,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.setUser();
  }
  /**
   * Se ejecuta después del constructor.
   */
  ngOnInit(): void {

  }
  /**
   * Refresca la página.
   * @param event
   */
  doRefresh(event) {
    this.setUser().then(() => {
      event.target.complete();
    });
  }
  /**
   * Establece los datos del usuario.
   */
  setUser() {
    return new Promise((result) => {
      this.storage.getUser().then((user: User) => {
        this.route.params.subscribe(async (params) => {
          if (user && params.user_id && !isNaN(params.user_id) && params.user_id !== user.id) {
            this.isSelf = false;
            this.user = await this.api.get(`/user/${params.user_id}`).catch((error) => {
              console.log('[account-61]', error);
            });
            this.file = (this.user.media && this.user.media.url) ? this.user.media : { url: './assets/imgs/avatar.png', alt: 'avatar.png' };
            this.user.social_links.map((socialLink) => {
              if (socialLink && socialLink.grant_type === 'google') { this.hasLinked.google = true; }
              if (socialLink && socialLink.grant_type === 'facebook') { this.hasLinked.facebook = true; }
            });
            result();
          } else {
            this.isSelf = true;
            this.user = user;
            this.file = (user && user.media && user.media.url) ? this.user.media : { url: './assets/imgs/avatar.png', alt: 'avatar.png' };
            if (user) {
              user.social_links.map((socialLink) => {
                if (socialLink && socialLink.grant_type === 'google') { this.hasLinked.google = true; }
                if (socialLink && socialLink.grant_type === 'facebook') { this.hasLinked.facebook = true; }
              });
            }
            result();
          }
        });
      });
    });
  }
  /**
   * Descarga la información del usuario.
   */
  async downloadUserInfo() {
    if (this.isSelf) {
      this.reponseFile(await this.api.get('/user').catch((error) => {
        console.log('[account-89]', error);
      }));
    } else {
      this.reponseFile(await this.api.get(`/user/${this.user.id}`).catch((error) => {
        console.log('[account-93]', error);
      }));
    }
  }
  /**
   * Genera un archivo con la informacion del usuario.
   * @param {User} user
   */
  reponseFile(user: User) {
    const filename = `${user.name.replace(' ', '-')}.json`;
    const type = 'text/plain;charset=utf-8';
    const data = JSON.stringify(user, null, '\t');
    const a = document.createElement('a'), file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) { // IE10+
      window.navigator.msSaveOrOpenBlob(file, filename);
    } else { // Otros
      const url = URL.createObjectURL(file);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  }
  /**
   * Elimina una cuenta de usuario.
   */
  async deleteUserAccount() {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.DELETE_USER.TITLE'),
      message: this.translate.instant('ALERTS.DELETE_USER.MESSAGE'),
      buttons: [
        {
          role: 'cancel',
          text: this.translate.instant('CANCEL')
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: () => {
            if (this.isSelf) {
              this.api.delete('/user').then(() => {
                this.storage.logout();
              }, (fail) => {
                console.log('[account-139]', fail);
              });
            } else {
              this.api.delete(`/user/${this.user.id}`).then(() => {
                this.router.navigate(['/users']);
              }, (fail) => {
                console.log('[account-145]', fail);
              });
            }
          }
        }
      ]
    });
    alert.present();
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
