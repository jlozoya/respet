import { Component, OnInit } from '@angular/core';
import { ApiService, UserContact, CatEmail, CatPhone } from './../../providers/providers';
import { ModalController, NavParams, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-add-emails-phones',
  templateUrl: 'add-emails-phones.component.html',
  styleUrls: ['add-emails-phones.component.scss']
})
export class AddEmailsPhonesComponent implements OnInit {

  name = 'EMAILS';
  type = 'email';
  text = '';
  toSave = [];
  userContact: UserContact;
  regex = {
    email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    phone: /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/g
  };

  constructor(
    private api: ApiService,
    private modalCtrl: ModalController,
    private navParams: NavParams,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {
  }
  ngOnInit() {
    this.type = this.navParams.get('type') || 'email';
    this.name = (this.type === 'email') ? 'EMAILS' : 'PHONES';
    this.getUserContact();
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
   * Navega al lugar correspondiente.
   * @param {string} value
   */
  openLink(value: string) {
    if (this.type === 'email') {
      window.location.href = `mailto:${value}`;
    } else if (this.type === 'tel') {
      window.location.href = `tel:+${value}`;
    }
  }
  /**
   * Separa los valores correctos de los incorrectos
   */
  filterValues() {
    const toSave = this.text.split(',');
    const [pass, fail] = this.partition(
      toSave, (e) => e.match((this.type === 'email') ? this.regex.email : this.regex.phone)
    );
    pass.forEach((email) => { this.toSave.push(email); });
    this.text = fail.join(', ');
    if (fail.length) {
      this.presentToast(this.translate.instant('ADD_EMAIL_PHONES.SOME_WRONG_VALUES'));
    }
  }
  /**
   * Ejecuta el filtro correspondiente para separar valores correctos e incorrectos.
   * @param {string[]} array
   * @param {any} isValid
   */
  partition(array: string[], isValid: any) {
    return array.reduce(([pass, fail], elem) => {
      return isValid(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
    }, [[], []]);
  }
  /**
   * Elimina un elemento de la lista.
   * @param {string} value
   */
  remove(value: string) {
    this.toSave.splice(this.toSave.indexOf(value), 1);
  }
  /**
   * Envia al servidor los datos correctos.
   */
  add() {
    this.filterValues();
    if (this.toSave.length) {
      const source = (this.type === 'email') ? 'emails' : 'phones';
      this.api.post(`/user/cat/${source}`, {[source]: this.toSave}).then((result) => {
        this.dismiss(result);
      }, (fail) => {
        console.log('[add-emails-phones-90]', fail);
        this.presentToast(this.translate.instant('FORM.FAIL'));
      });
    } else {
      this.presentToast(this.translate.instant('ADD_EMAIL_PHONES.NOTHING_TO_SEND'));
    }
  }
  /**
   * Cierra el modal.
   */
  dismiss(result = []): void {
    this.modalCtrl.dismiss(result);
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
