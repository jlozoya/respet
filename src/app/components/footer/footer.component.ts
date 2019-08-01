import { environment } from './../../../environments/environment';
import { LoadingController, ToastController } from '@ionic/angular';
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiService, StorageService } from '../../providers/providers';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

/**
 * Generated class for the FooterComponent component.
 *
 * See https://angular.io/api/core/Component for more info on Angular
 * Components.
 */
@Component({
  selector: 'app-footer',
  templateUrl: 'footer.component.html',
  styleUrls: ['footer.component.scss']
})
export class FooterComponent {

  supportForm: any;
  isReadyToSubmit = false;

  constructor(
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private toastCtrl: ToastController,
    private api: ApiService,
    private storage: StorageService,
    public router: Router,
    formBuilder: FormBuilder
  ) {
    this.supportForm = formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(60)]],
      phone: ['', [Validators.nullValidator, Validators.maxLength(15)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(60)]],
      message: ['', [Validators.required, Validators.maxLength(255)]]
    });
    this.supportForm.valueChanges.subscribe((v) => {
      this.isReadyToSubmit = this.supportForm.valid;
    });
  }
  /**
   * Navega hacia la página de información.
   */
  goToAbout() {
    this.router.navigate(['/tabs', {outlets: {about: 'about'}}]);
  }
  /**
   * Navega hacia una página donde se presenta la ubicación de nuestras instalaciones.
   */
  goToInstagram() {
    window.open(environment.INSTAGRAM_PAGE_LINK, '_blank');
  }
  /**
   * Nave hacia la página de Facebook.
   */
  goToFacebook() {
    window.open(environment.FACEBOOK_PAGE_LINK, '_blank');
  }
  /**
   * Nave hacia la página de mail.
   */
  goToMail() {
    window.open(`mailto:${environment.PUBLIC_MAIL}`, '_top');
  }
  /**
   * Envía la información de contacto con el mensaje del usuario.
   */
  async submitContact() {
    if (!this.supportForm.valid) { return; }
    const contactLoading = await this.loadingCtrl.create({message: this.translate.instant('SENDING_MESSAGE')});
    await contactLoading.present();
    this.storage.getLang().then(lang => {
      const query = {
        name: this.supportForm.value.name,
        phone: this.supportForm.value.phone,
        email: this.supportForm.value.email,
        message: this.supportForm.value.message,
        lang: lang || 'es'
      };
      this.api.post('/support', query).then(async (response) => {
        this.supportForm.patchValue({
          name: '',
          phone: '',
          email: '',
          message: ''
        });
        await contactLoading.dismiss();
        this.presentToast(this.translate.instant('MESSAGE_SENT'));
      }, async (fail) => {
        await contactLoading.dismiss();
        this.presentToast(this.translate.instant('ERRORS.SENDING_MESSAGE'));
        console.log('[footer-89]', fail);
      });
    });
  }
  /**
   * Navega hacia la página de políticas de la aplicación
   * @param {string} segment
   */
  goToPolitics(segment: string) {
    this.router.navigate(['/politics', segment]);
  }
  /**
   * Presenta un cuadro de mensaje.
   * @param {string} text Mensaje a mostrar.
   */
  async presentToast(text: string) {
    const toast = await this.toastCtrl.create({
      message: text,
      duration: 5000,
      position: 'bottom'
    });
    await toast.present();
  }
}
