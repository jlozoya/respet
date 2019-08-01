import { AddEmailsPhonesComponent } from './../../../modals/add-emails-phones/add-emails-phones.component';
import { TranslateService } from '@ngx-translate/core';
import { ToastController, ModalController, Platform } from '@ionic/angular';
import { UserContact, ApiService, UserPermissions, CatEmail, CatPhone } from './../../../providers/providers';
import { Component, OnInit } from '@angular/core';
import { OverlayEventDetail } from '@ionic/core';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {

  userPermissions: UserPermissions = {
    show_main_email: true,
    show_alternative_emails: true,
    show_main_phone: true,
    show_alternative_phones: true,
    show_address: true,
    receive_mail_adds: true
  };
  userContact: UserContact;

  constructor(
    private api: ApiService,
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private modalCtrl: ModalController,
    private platform: Platform
  ) { }

  ngOnInit() {
    this.platform.ready().then(() => {
      this.getUserPermissions();
      this.getUserContact();
    });
  }
  /**
   * Recupera información del usuario.
   */
  getUserPermissions() {
    this.api.get('/user/permissions').then((userPermissions) => {
      this.userPermissions = userPermissions;
    }).catch((error) => {
      console.log('[privacy-45]', error);
    });
  }
  /**
   * Recupera información del usuario.
   */
  getUserContact() {
    this.api.get('/user/contact').then((userContact) => {
      this.userContact = userContact;
    }).catch((error) => {
      console.log('[privacy-55]', error);
    });
  }
  /**
   * Navega al lugar correspondiente.
   * @param {string} value
   */
  openLink(value: string, type: 'email' | 'phone') {
    if (type === 'email') {
      window.location.href = `mailto:${value}`;
    } else if (type === 'phone') {
      window.location.href = `tel:+${value}`;
    }
  }
  /**
   * Actualiza información del usuario.
   * @param {string} key
   * @param {boolean} value
   */
  updateUserPermissions(key: string, value: boolean) {
    this.api.put('/user/permissions', {[key]: (value) ? false : true }).then((userPermissions) => {
      this.userPermissions = userPermissions;
      this.presentToast(this.translate.instant('FORM.SUCCESS'));
    }, (error) => {
      console.log('[privacy-79]', error);
    });
  }
  /**
   * Abre un modal.
   * @param {'email' | 'tel'} type
   */
  async addEmailsPhones(type: 'email' | 'tel') {
    const modal = await this.modalCtrl.create({
      component: AddEmailsPhonesComponent,
      componentProps: {
        type: type,
        name: name
      }
    });
    await modal.present();
    modal.onDidDismiss().then((detail: OverlayEventDetail) => {
      if (detail.data) {
        detail.data.forEach((element: CatEmail | CatPhone) => {
          if (type === 'email') {
            this.userContact.contact.emails.push(element);
          } else {
            this.userContact.contact.phones.push(element);
          }
        });
      }
    });
  }
  /**
   * Elimina un valor.
   * @param {CatEmail | CatPhone} value
   * @param {'email' | 'phone'} type
   */
  deleteEmailPhone(value: CatEmail | CatPhone, type: 'email' | 'phone') {
    this.api.delete(`/user/cat/${type}/${value.id}`).then(() => {
      this.userContact.contact[`${type}s`].splice(this.userContact.contact[`${type}s`].indexOf(value), 1);
    }, (fail) => {
      console.log('[privacy-105]', fail);
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
