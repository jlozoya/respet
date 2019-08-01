import { environment } from './../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { Component, AfterViewInit } from '@angular/core';

import { Platform, Config, Events } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { User, PageInterface, StorageService, ApiService /*, PushNotifications */ } from './providers/providers';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements AfterViewInit {

  loggedIn = false;
  user: User = {
    name: '',
    email: '',
    media: {
      url: ''
    }
  };
  img_url = this.user.media.url;
  informationPages: PageInterface[] = [
    { title: 'NAV.APP_NAME', name: 'MainPage', link: '/main', icon: 'chatbubbles' },
    { title: 'NAV.ABOUT_US', name: 'AboutPage', link: '/about', icon: 'compass' },
    { title: 'NAV.WALL', name: 'WallPage', link: '/wall', icon: 'paw' }
  ];
  adminPages: PageInterface[] = [
    { title: 'NAV.ANALYTICS', name: 'AnalyticsPage', link: '/analytics', icon: 'analytics' },
    { title: 'NAV.USERS', name: 'UsersPage', link: '/users', icon: 'contacts' }
  ];
  loggedOutPages: PageInterface[] = [
    { title: 'NAV.PRESENTATION', name: 'TutorialPage', link: '/tutorial', icon: 'star' },
    { title: 'NAV.LOGIN', name: 'LoginPage', link: '/login', icon: 'log-in' },
    { title: 'NAV.SIGNUP', name: 'SignupPage', link: '/signup', icon: 'person-add' }
  ];
  loggedInPages: PageInterface[] = [
    { title: 'NAV.ACCOUNT', name: 'AccountPage', link: '/account', icon: 'person' },
    { title: 'NAV.PRIVACY_CONFIG', name: 'PrivacyPage', link: '/privacy', icon: 'shirt' },
    { title: 'NAV.LOGOUT', name: 'MainPage', icon: 'log-out', logsOut: true }
  ];
  lastTimeBackPress = 0;
  timePeriodToExit = 2000;

  langSelector = [{
    title: 'Español',
    selected: false,
    lang: 'es'
  },
  {
    title: 'English',
    selected: false,
    lang: 'en'
  }];

  constructor(
    private translate: TranslateService,
    private storage: StorageService,
    private config: Config,
    private platform: Platform,
    private events: Events,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private router: Router,
    private api: ApiService
  ) {
    this.initTranslate();
    this.initializeApp();
    // Comprueba si el usuario ya ha visto el tutorial
    this.storage.checkHasSeenTutorial().then((hasSeenTutorial) => {
      if (!hasSeenTutorial) {
        this.router.navigate(['/tutorial']);
      }
    });
    this.platform.ready().then(() => {
      this.storage.isLoged().then((isLoged) => {
        this.storage.getUser().then((user: User) => {
          if (user && !user.hasOwnProperty('media')) { user.media = {}; }
          this.user = user;
        });
        if (isLoged) {
          setTimeout(() => {
            this.updateLocalUserInformation();
          }, 1000);
        }
        this.loggedIn = (isLoged === true);
      });
    });
  }

  ngAfterViewInit(): void {
    this.listenEvents();
  }

  /**
   * Establezca el idioma predeterminado para las cadenas de traducción y el idioma actual.
   */
  initTranslate() {
    this.translate.setDefaultLang('es');
    this.storage.getLang().then((lang) => {
      if (!lang && this.translate.getBrowserLang() !== undefined) {
        this.translate.use(this.translate.getBrowserLang());
      } else {
        this.translate.use(lang || 'es'); // Establezca su idioma aquí
        this.langSelector.find((item) => {
          return item.lang === (lang || 'es');
        }).selected = true;
      }
      this.translate.get(['BACK_BUTTON_TEXT']).subscribe(values => {
        this.config.set('backButtonText', values.BACK_BUTTON_TEXT);
      });
    });
  }
  /**
   * Cambia el idioma seleccionado.
   * @param item
   */
  changeLang(inItem) {
    this.storage.setLang(inItem.lang);
    this.langSelector.forEach((item) => {
      item.selected = false;
    });
    this.langSelector.find((item) => {
      return item.lang === (inItem.lang);
    }).selected = true;
  }
  /**
   * Cierra el splash screen para mostrar la aplicación.
   */
  initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }
  /**
   * Administra la navegación por la aplicación y las opciones de la sesión para el usuario.
   */
  async openPage(page: PageInterface) {
    if (page.logsOut === true) {
      // da el tiempo de menú para cerrar antes de cambiar a desconectado
      this.api.delete('/user/sesion').catch((error) => {
        console.log('[app-118]', error);
      });
      this.storage.logout();
    } else {
      this.router.navigateByUrl(page.link || environment.MAIN_URL);
    }
  }
  /**
   * Escucha los eventos _user:login_ y _user:logout_ que son disparados desde el menú de la izquierda
   * según el estado de la sesión.
   */
  listenEvents(): void {
    this.events.subscribe('user:login', (user: User) => {
      if (user && !user.hasOwnProperty('media')) { user.media = {}; }
      this.user = user;
      this.loggedIn = true;
    });
    this.events.subscribe('user:avatar', (url: string) => {
      this.user.media.url = url;
    });
    this.events.subscribe('user:logout', () => {
      this.loggedIn = false;
      this.user = {
        name: '',
        email: '',
        media: {url: ''}
      };
      this.router.navigate(['/login']);
    });
    this.events.subscribe('user:lang', (lang: string, upload = true) => {
      lang = (lang.match(/es|en/) ? lang : 'es');
      this.translate.use(lang);
      if (upload) {
        this.storage.getId().then((userId) => {
          if (userId) { this.api.put('/user/lang', {lang: lang}); }
        });
      }
    });
    this.events.subscribe('navigate:root', (page: PageInterface) => {
      this.openPage(page);
    });
    this.events.subscribe('user:role', (role) => {
      this.user.role = role;
    });
  }
  /**
   * Llama la información del usuario para actualizar en el almacenamiento local.
   */
  updateLocalUserInformation() {
    this.storage.getId().then((userId) => {
      if (userId) {
        this.api.get('/user').then((user: User) => {
          this.storage.setCredentials(user);
          this.user = user;
          this.storage.setLang(user.lang, false);
        }, fail => {
          console.log('[app-171]', fail);
        });
      }
    });
  }
  /**
   * Verifica si esta activa la página que se seleccione del menú de la izquierda,
   * ilumina el icono correspondiente en caso de que no.
   */
  isActive(page: PageInterface) {
    if (page.link && this.router.url === page.link) {
      return 'primary';
    }
    return;
  }
  /**
   * Navega hacia la página para gestionar el usuario.
   */
  goToAccount(): void {
    this.router.navigate(['/account']);
  }
}
