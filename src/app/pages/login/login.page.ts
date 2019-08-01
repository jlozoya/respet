import { environment } from './../../../environments/environment';
import { Router, ActivatedRoute } from '@angular/router';
import { Component } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { FormBuilder, Validators } from '@angular/forms';
import { ValidationService } from './../../shared/directives/validation.service';
import { TranslateService } from '@ngx-translate/core';
import { StorageService, ApiService, User, SocialLoginService, Sesion } from '../../providers/providers';
/**
 * Proporciona la vista para un formulario donde el usuario puede ingresar sus datos para iniciar sesión.
 * @author Juan Lozoya <jlozoya1995@gmail.com>
 */
@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss']
})
export class LoginPage {

  progress = {
    type: 'determinate',
    value: 0
  };
  loginForm: any;
  isPrimary = false;
  isReadyToLogin = false;

  constructor(
    private socialLogin: SocialLoginService,
    private storage: StorageService,
    private api: ApiService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private translate: TranslateService,
    private router: Router,
    private route: ActivatedRoute,
    formBuilder: FormBuilder
  ) {
    // genera el esquema sql donde se almacenaran los datos localaes
    this.loginForm = formBuilder.group({
      email: ['', [Validators.required, ValidationService.emailValidator]],
      password: ['', Validators.required]
    });
    this.loginForm.valueChanges.subscribe((v) => {
      this.isReadyToLogin = this.loginForm.valid;
    });
  }
  /**
   * Envía una petición al servidor para iniciar sesión.
   */
  async login() {
    if (this.loginForm.dirty && this.loginForm.valid && this.progress.type !== 'indeterminate') {
      this.progress.type = 'indeterminate';
      const query = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password,
        client_id: environment.OAUTH_CLIENT_ID,
        client_secret: environment.OAUTH_CLIENT_SECRET,
        grant_type: 'password',
        scopes: '*'
      };
      this.api.post('/oauth/token', query).then((sesion: Sesion) => {
        this.storage.setSesion(sesion).then(() => {
          this.api.get('/user').then(async (user: User) => {
            await this.storage.setCredentials(user);
            this.progress.type = 'determinate';
            this.router.navigate([environment.MAIN_URL]);
          }, (fail) => {
            console.log('[login-65]', JSON.stringify(fail));
            this.progress.type = 'determinate';
            if (typeof fail === 'string') {
              this.presentToast(this.translate.instant(fail));
            } else {
              this.presentToast(this.translate.instant('FORM.FAIL'));
            }
          });
        });
      }, (fail) => {
        this.progress.type = 'determinate';
        if (fail === 'SERVER.INCORRECT_USER') {
          this.presentToast(this.translate.instant(fail));
        } else {
          this.presentToast(this.translate.instant('ERRORS.LOGIN'));
        }
        console.log('[login-86]', fail);
      });
    }
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
   * Navega hacia la página para registrase.
   */
  goToSignup() {
    this.route.params.subscribe((params) => {
      if (params.token) {
        this.router.navigate(['/signup', params.token]);
      } else {
        this.router.navigate(['/signup']);
      }
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
   * Intercambia el tipo input entre password y text
   * @param {amy} input
   */
  showPassword(input: any): void {
    this.isPrimary = this.isPrimary === true ? false : true;
    input.type = input.type === 'password' ? 'text' : 'password';
    input.setFocus();
  }
  /**
   * Proporciona al usuario la opción de recuperar su contraseña.
   */
  async recoverPassword() {
    if (this.progress.type !== 'determinate') { return; }
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.RECOVER_PASSWORD_BY_EMAIL.TITLE'),
      message: this.translate.instant('ALERTS.RECOVER_PASSWORD_BY_EMAIL.MESSAGE'),
      inputs: [
        {
          type: 'email',
          name: 'email',
          value: ''
        }
      ],
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel',
          handler: (data: any) => {}
        },
        {
          text: this.translate.instant('ACCEPT'),
          handler: async (data: any) => {
            if (data) {
              this.progress.type = 'indeterminate';
              const query: User = {
                email: data.email,
                grant_type: 'password'
              };
              this.api.post('/password/email', query).then((response: any) => {
                this.presentToast(this.translate.instant('FORM.CHECK_YOUR_EMAIL'));
                this.progress.type = 'determinate';
              }, (fail) => {
                this.presentToast(this.translate.instant('ERRORS.RECOVERING_PASSWORD'));
                console.log('[login-164]', fail);
                this.progress.type = 'determinate';
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
    toast.present();
  }
}
