import { environment } from './../../../environments/environment';
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { StorageService, ApiService, User, SocialLoginService, Sesion, OAuthSignup } from '../../providers/providers';
import { ValidationService } from '../../shared/directives/validation.service';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
/**
 * Formulario de inicio de sesión o registro con redes sociales.
 * @author <a href="mailto:jlozoya1995@gmail.com">Juan Lozoya</a>
 */
@Component({
  selector: 'app-signup',
  templateUrl: 'signup.page.html',
  styleUrls: ['signup.page.scss']
})
export class SignupPage {

  progress = {
    type: 'determinate',
    value: 0
  };
  isPrimary = false;
  isPrimaryRe = false;
  signupForm: any;
  isReadyToSend = false;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private storage: StorageService,
    private api: ApiService,
    formBuilder: FormBuilder,
    private translate: TranslateService,
    private socialLogin: SocialLoginService
  ) {
    this.signupForm = formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(60)]],
      first_name: ['', [Validators.required, Validators.maxLength(60)]],
      last_name: ['', [Validators.required, Validators.maxLength(60)]],
      gender: ['', [Validators.nullValidator]],
      email: ['', [Validators.required, ValidationService.emailValidator]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(60), ValidationService.passwordValidator]],
      password_d: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(60), ValidationService.passwordValidator]]
    });
    this.signupForm.valueChanges.subscribe((v) => {
      this.isReadyToSend = this.signupForm.valid;
    });
  }
  /**
   * Envía la información del usuario al servidor.
   */
  async doSignup() {
    if (this.signupForm.value.password !== this.signupForm.value.password_d) {
      this.presentToast(this.translate.instant('FORM.PASSWORD_NOT_MATCH'));
    } else if (this.signupForm.dirty && this.signupForm.valid && this.progress.type !== 'indeterminate') {
      this.progress.type = 'indeterminate';
      this.storage.getLang().then((lang) => {
        let query: OAuthSignup = {
          name: this.signupForm.value.name,
          first_name: this.signupForm.value.first_name,
          last_name: this.signupForm.value.last_name,
          gender: this.signupForm.value.gender,
          password: this.signupForm.value.password,
          email: this.signupForm.value.email,
          lang: lang || 'es',
          grant_type: 'password',
          client_id: environment.OAUTH_CLIENT_ID,
          client_secret: environment.OAUTH_CLIENT_SECRET,
          scopes: '*'
        };
        this.api.post('/user', query).then((sesion: Sesion) => {
          this.storage.setSesion(sesion).then(() => {
            this.api.get('/user').then(async(user: User) => {
              this.storage.setCredentials(user);
              this.progress.type = 'determinate';
              this.router.navigate(['/main']);
            }, async (fail) => {
              console.log('[signup-81]', JSON.stringify(fail));
              this.progress.type = 'determinate';
              this.presentToast(this.translate.instant(fail));
            });
          });
        }, async (fail) => {
          this.progress.type = 'determinate';
          console.log('[signup-88]', fail);
          if (fail === 'SERVER.USER_ALREADY_EXISTS') {
            this.presentToast(this.translate.instant(fail));
          } else {
            this.presentToast(this.translate.instant('ERRORS.SIGNIN'));
          }
        });
      });
    }
  }
  /**
   * Intercambia el tipo input entre password y text
   * @param {any} input
   */
  showPassword(input: any): void {
    this.isPrimary = this.isPrimary === true ? false : true;
    input.type = input.type === 'password' ? 'text' : 'password';
    input.setFocus();
  }
  /**
   * Intercambia el tipo input entre password y text
   * @param {any} input
   */
  showPasswordRe(input: any): void {
    this.isPrimaryRe = this.isPrimaryRe === true ? false : true;
    input.type = input.type === 'password' ? 'text' : 'password';
    input.setFocus();
  }
  /**
   * Llama a la función para hacer login o signup con google
   */
  googleLogin() {
    this.socialLogin.googleLogin();
  }
  /**
   * Llama a la función para hacer login o signup con facebook.
   */
  facebookLogin() {
    this.socialLogin.facebookLogin();
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
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }
}
