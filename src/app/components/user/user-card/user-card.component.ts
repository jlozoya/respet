import { environment } from './../../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { ApiService, User, StorageService } from './../../../providers/providers';
import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, Events } from '@ionic/angular';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss'],
})
export class UserCardComponent implements OnInit {

  @Input()user: User;

  constructor(
    private router: Router,
    private api: ApiService,
    private translate: TranslateService,
    private toastCtrl: ToastController,
    private events: Events,
    private storage: StorageService
  ) { }

  ngOnInit() {}
  /**
   * Navega hacia la página de detalles del usuario.
   * @param {User} user
   */
  goToUserDetail(user: User) {
    this.router.navigate(['/account', user.id]);
  }
    /**
   * Establece el rol del usuario.
   * @param {User} user
   */
  changeRole(user: User) {
    this.api.put(`/user/role/${user.id}`, { role: user.role }).then((userRole) => {
      user.role = userRole;
      this.storage.getUser().then((localUser) => {
        if (this.user.id === localUser.id) {
          this.events.publish('user:role', userRole);
          if (userRole !== 'admin') {
            this.router.navigate([environment.MAIN_URL]);
          }
        }
        this.presentToast(this.translate.instant('FORM.SUCCESS'));
      });
    }, (fail) => {
      console.log('[user-101]', fail);
      this.presentToast(this.translate.instant('FORM.ERROR'));
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
    await toast.present();
  }
}
