import { environment } from './../../../environments/environment';
import { StorageService } from '../storage/storage.service';
import { FacebookLogin, GoogleLogin, User, FacebookImg, Sesion, SocialLink,
  OAuthLogin, OAuthSignup } from '../models/models';
import { TranslateService } from '@ngx-translate/core';
import { LoadingController, ToastController, Platform } from '@ionic/angular';
import { GooglePlus } from '@ionic-native/google-plus/ngx';
import { Facebook, FacebookLoginResponse } from '@ionic-native/facebook/ngx';
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Router } from '@angular/router';
import { FacebookService, InitParams, LoginResponse } from 'ngx-facebook';

@Injectable()
export class SocialLoginService {

  loadingLogin;

  constructor(
    private fb: FacebookService,
    private toastCtrl: ToastController,
    private userData: StorageService,
    private facebook: Facebook,
    private googlePlus: GooglePlus,
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private api: ApiService,
    private router: Router,
    private platform: Platform
  ) {
    const initParams: InitParams = {
      appId: environment.FACEBOOK_APP_ID,
      xfbml: true,
      version: 'v3.2'
    };
    fb.init(initParams);
  }
  /**
   * Muestra para pantalla para pedir autorización al user para logearse con facebook.
   */
  public async facebookLogin() {
    this.loadingLogin = await this.loadingCtrl.create({message: this.translate.instant('IS_LOGIN')});
    if ((!this.platform.is('android') && !this.platform.is('ios')) || this.platform.is('mobileweb')) {
      this.fb.login({scope: 'public_profile, email'}).then(async (response: LoginResponse) => {
        if (response.status === 'connected') {
          const facebookLogin: OAuthLogin = {
            accessToken: response.authResponse.accessToken,
            extern_id: response.authResponse.userID,
            grant_type: 'facebook',
            client_id: environment.OAUTH_CLIENT_ID,
            client_secret: environment.OAUTH_CLIENT_SECRET,
            scopes: '*'
          };
          await this.loadingLogin.present();
          this.apiCheckFacebookLogin(facebookLogin);
        }
      }).catch((error) => {
        console.log('[social-login-58]', JSON.stringify(error));
      });
    } else {
      this.facebook.login(['public_profile', 'email']).then(async (response: FacebookLoginResponse) => {
        if (response.status === 'connected') {
          const facebookLogin: OAuthLogin = {
            accessToken: response.authResponse.accessToken,
            extern_id: response.authResponse.userID,
            grant_type: 'facebook',
            client_id: environment.OAUTH_CLIENT_ID,
            client_secret: environment.OAUTH_CLIENT_SECRET,
            scopes: '*'
          };
          await this.loadingLogin.present();
          this.apiCheckFacebookLogin(facebookLogin);
        }
      }).catch((error) => {
        console.log('[social-login-75]', JSON.stringify(error));
      });
    }
  }
  /**
   * Llama el api para comprobar que sea correcta la información del user.
   * @param {OAuthLogin} facebookLogin
   */
  private apiCheckFacebookLogin(facebookLogin: OAuthLogin): void {
    this.api.post('/oauth/token', facebookLogin).then((sesion: Sesion) => {
      this.userData.setSesion(sesion).then(() => {
        this.api.get('/user').then(async (user: User) => {
          this.userData.setCredentials(user);
          await this.loadingLogin.dismiss();
          this.router.navigate([environment.MAIN_URL]);
        }, async (fail) => {
          await this.loadingLogin.dismiss();
          console.log('[social-login-94]', JSON.stringify(fail.error));
          this.presentToast(this.translate.instant('ERRORS.LOGIN'));
        });
      });
    }, async (fail) => {
      if (fail.error === 'SERVER.USER_NOT_REGISTRED') {
        this.getFacebookInfo();
      } else {
        console.log('[social-login-102]', JSON.stringify(fail.error));
        await this.loadingLogin.dismiss();
        if ((!this.platform.is('android') && !this.platform.is('ios')) && !this.platform.is('mobileweb')) {
          this.fb.logout().then(async (response) => {
            this.presentToast(this.translate.instant('ERRORS.LOGIN'));
          });
        } else {
          this.facebook.logout().then((response) => {
            this.presentToast(this.translate.instant('ERRORS.LOGIN'));
          });
        }
      }
    });
  }
  /**
   * Llama la información del user del servidor de facebook.
   */
  private getFacebookInfo(): void {
    if ((!this.platform.is('android') && !this.platform.is('ios')) || this.platform.is('mobileweb')) {
      this.fb.api('/me', 'get',
      {fields: 'id,name,first_name,last_name,email,picture'}).then((facebookUser: FacebookLogin) => {
        this.fb.api('/me/picture', 'get', {type: 'large', redirect: false}).then((facebookImg: FacebookImg) => {
          this.userData.getLang().then(lang => {
            const query: OAuthSignup = {
              extern_id: facebookUser.id,
              name: facebookUser.name,
              first_name: facebookUser.first_name,
              last_name: facebookUser.last_name,
              email: facebookUser.email,
              media: {
                url: facebookImg.data.url,
                width: facebookImg.data.width,
                height: facebookImg.data.height,
                alt: facebookUser.name
              },
              lang: lang || 'es',
              client_id: environment.OAUTH_CLIENT_ID,
              client_secret: environment.OAUTH_CLIENT_SECRET,
              grant_type: 'facebook',
              scopes: '*'
            };
            this.signup(query);
          });
        }).catch(async (error) => {
          await this.loadingLogin.dismiss();
          console.log('[social-login-148]', error);
        });
      }).catch(async (error) => {
        await this.loadingLogin.dismiss();
        console.log('[social-login-152]', error);
      });
    } else {
      this.facebook.api('/me?fields=id,name,first_name,last_name,email,picture',
      ['public_profile', 'email']).then((facebookUser: FacebookLogin) => {
        this.facebook.api('/me/picture?type=large&redirect=false',
        ['public_profile', 'email']).then((facebookImg: FacebookImg) => {
          this.userData.getLang().then(lang => {
            const query: OAuthSignup = {
              extern_id: facebookUser.id,
              name: facebookUser.name,
              first_name: facebookUser.first_name,
              last_name: facebookUser.last_name,
              email: facebookUser.email,
              media: {
                url: facebookImg.data.url,
                width: facebookImg.data.width,
                height: facebookImg.data.height,
                alt: facebookUser.name
              },
              lang: lang || 'es',
              client_id: environment.OAUTH_CLIENT_ID,
              client_secret: environment.OAUTH_CLIENT_SECRET,
              grant_type: 'facebook',
              scopes: '*'
            };
            this.signup(query);
          });
        }).catch(async (error) => {
          await this.loadingLogin.dismiss();
          console.log('[social-login-182]', error);
        });
      }).catch(async (error) => {
        await this.loadingLogin.dismiss();
        console.log('[social-login-186]', error);
      });
    }
  }
  /**
   * Vincula la cuenta del usuario con el perfil de facebook.
   */
  public facebookLink() {
    return new Promise(async (result, reject) => {
      const loadingLink = await this.loadingCtrl.create({message: this.translate.instant('IS_LINKING')});
      if ((!this.platform.is('android') && !this.platform.is('ios')) || this.platform.is('mobileweb')) {
        this.fb.login({scope: 'public_profile, email'}).then(async (response) => {
          if (response.status === 'connected') {
            const facebookLink: OAuthLogin = {
              accessToken: response.authResponse.accessToken,
              extern_id: response.authResponse.userID,
              client_id: environment.OAUTH_CLIENT_ID,
              client_secret: environment.OAUTH_CLIENT_SECRET,
              grant_type: 'facebook',
              scopes: '*'
            };
            await loadingLink.present();
            this.api.put('/user/social/link', facebookLink).then(async (socialLink: SocialLink) => {
              await loadingLink.dismiss();
              this.presentToast(this.translate.instant('FORM.SUCCESS'));
              result(socialLink);
            }, async (fail) => {
              await loadingLink.dismiss();
              if (typeof fail.error === 'string') {
                this.presentToast(this.translate.instant(fail));
              } else {
                this.presentToast(this.translate.instant('FORM.FAIL'));
              }
              reject(fail.error);
            });
          }
        }).catch((error) => {
          console.log('[social-login-223]', JSON.stringify(error));
          reject(error);
        });
      } else {
        this.facebook.login(['public_profile', 'email']).then(async (response) => {
          if (response.status === 'connected') {
            const facebookLink: OAuthLogin = {
              accessToken: response.authResponse.accessToken,
              extern_id: response.authResponse.userID,
              client_id: environment.OAUTH_CLIENT_ID,
              client_secret: environment.OAUTH_CLIENT_SECRET,
              grant_type: 'facebook',
              scopes: '*'
            };
            await loadingLink.present();
            this.api.put('/user/social/link', facebookLink).then(async (socialLink: SocialLink) => {
              await loadingLink.dismiss();
              this.presentToast(this.translate.instant('FORM.SUCCESS'));
              result(socialLink);
            }, async (fail) => {
              await loadingLink.dismiss();
              if (typeof fail.error === 'string') {
                this.presentToast(this.translate.instant(fail));
              } else {
                this.presentToast(this.translate.instant('FORM.FAIL'));
              }
              reject(fail.error);
            });
          }
        }).catch((error) => {
          console.log('[social-login-253]', JSON.stringify(error));
          reject(error);
        });
      }
    });
  }
  /**
   * Gestiona el login con google.
   */
  public async googleLogin() {
    this.loadingLogin = await this.loadingCtrl.create({message: this.translate.instant('IS_LOGIN')});
    this.loadingLogin.present();
    this.googlePlus.login({}).then(async (googleResponse: GoogleLogin) => {
      const googleLogin: OAuthLogin = {
        accessToken: googleResponse.accessToken,
        extern_id: googleResponse.userId,
        client_id: environment.OAUTH_CLIENT_ID,
        client_secret: environment.OAUTH_CLIENT_SECRET,
        grant_type: 'google',
        scopes: '*'
      };
      this.api.post('/oauth/token', googleLogin).then((sesion) => {
        this.userData.setSesion(sesion).then(() => {
          this.api.get('/user').then(async (user: User) => {
            this.userData.setCredentials(user);
            this.loadingLogin.dismiss();
            this.router.navigate([environment.MAIN_URL]);
          }, async (fail) => {
            this.loadingLogin.dismiss();
            console.log('[social-login-282]', JSON.stringify(fail.error));
            this.presentToast(this.translate.instant('ERRORS.LOGIN'));
          });
        });
      }, async (fail) => {
        if (fail.error === 'SERVER.USER_NOT_REGISTRED') {
          this.userData.getLang().then(lang => {
            const query: OAuthSignup = {
              extern_id: googleResponse.userId,
              name: googleResponse.displayName,
              first_name: googleResponse.givenName,
              last_name: googleResponse.familyName,
              email: googleResponse.email,
              media: {url: googleResponse.imageUrl},
              lang: lang || 'es',
              client_id: environment.OAUTH_CLIENT_ID,
              client_secret: environment.OAUTH_CLIENT_SECRET,
              grant_type: 'google',
              scopes: '*'
            };
            this.signup(query);
          });
        } else {
          this.loadingLogin.dismiss();
          this.googlePlus.logout().then(() => {
            console.log('[social-login-307]');
            this.presentToast(this.translate.instant('ERRORS.LOGIN'));
          });
        }
      });
    }).catch((error) => {
      this.loadingLogin.dismiss();
      console.log(error);
      console.log('[social-login-315]', JSON.stringify(error));
    });
  }
  /**
   * Vincula la cuenta del usuario con el perfil de google.
   */
  async googleLink(): Promise<SocialLink | any> {
    return new Promise(async (result, reject) => {
      const loadingLink = await this.loadingCtrl.create({message: this.translate.instant('IS_LINKING')});
      this.googlePlus.login({}).then(async (googleResponse: GoogleLogin) => {
        const googleLogin: OAuthLogin = {
          accessToken: googleResponse.accessToken,
          extern_id: googleResponse.userId,
          grant_type: 'google',
          client_id: environment.OAUTH_CLIENT_ID,
          client_secret: environment.OAUTH_CLIENT_SECRET
        };
        await loadingLink.present();
        this.api.put('/user/social/link', googleLogin).then(async (socialLink: SocialLink) => {
          await loadingLink.dismiss();
          this.presentToast(this.translate.instant('FORM.SUCCESS'));
          result(socialLink);
        }, async (fail) => {
          await loadingLink.dismiss();
          if (typeof fail.error === 'string') {
            this.presentToast(this.translate.instant(fail.error));
          } else {
            this.presentToast(this.translate.instant('FORM.FAIL'));
          }
          reject(fail.error);
        });
      });
    });
  }
  /**
   * Envía la solicitud al servidor para insertarla información del user.
   * @param query Son los datos del user.
   */
  private signup(query): void {
    this.api.post('/user', query).then((sesion: Sesion) => {
      this.userData.setSesion(sesion).then(() => {
        this.api.get('/user').then(async (user: User) => {
          this.userData.setCredentials(user);
          await this.loadingLogin.dismiss();
          this.router.navigate([environment.MAIN_URL]);
        }, async (fail) => {
          console.log('[social-login-244]', JSON.stringify(fail.error));
          await this.loadingLogin.dismiss();
          this.presentToast(this.translate.instant('ERRORS.LOGIN'));
        });
      });
    }, async (fail) => {
      console.log('[social-login-250]', JSON.stringify(fail.error));
      await this.loadingLogin.dismiss();
      this.presentToast(this.translate.instant('ERRORS.SIGNIN'));
    });
  }
  /**
   * Presenta un cuadro de mensaje.
   * @param {string} text Mensaje a mostrar.
   */
  private async presentToast(text: string) {
    const toast = await this.toastCtrl.create({
      message: text,
      duration: 5000,
      position: 'bottom'
    });
    toast.present();
  }
}
