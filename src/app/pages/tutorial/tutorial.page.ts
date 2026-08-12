import { environment } from './../../../environments/environment';
import { Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { StorageService } from '../../providers/providers';

export interface Slide {
  title: string;
  description: string;
  image: string;
}

@Component({
  standalone: false,
  selector: 'app-tutorial',
  templateUrl: 'tutorial.page.html',
  styleUrls: ['tutorial.page.scss']
})
export class TutorialPage implements OnInit {

  lang = 'es';
  constructor(
    private router: Router,
    private menu: MenuController,
    private storage: StorageService
  ) {
  }

  async ngOnInit() {
    this.lang = await this.storage.getLang() || 'es';
  }
  /**
   * Navega hacia tabs main.
   */
  startApp() {
    this.router.navigate([environment.MAIN_URL]).then(() => {
      this.storage.setHasSeenTutorial(true);
    });
  }
  /**
   * Navega hacia login.
   */
  startLogin() {
    this.router.navigate(['/login']).then(() => {
      this.storage.setHasSeenTutorial(true);
    });
  }
  /**
   * Navega hacia signup.
   */
  startSignUp() {
    this.router.navigate(['/signup']).then(() => {
      this.storage.setHasSeenTutorial(true);
    });
  }
  /**
   * El menú raíz de la izquierda debe estar deshabilitado en la página de tutorial.
   */
  ionViewDidEnter() {
    this.menu.enable(false);
  }
  /**
   * Habilitar el menú de la raíz izquierda al salir de la página de tutorial.
   */
  ionViewWillLeave() {
    this.menu.enable(true);
  }
  /**
   * Actualiza el idioma selecionado por el usuario.
   */
  setLang(lang): void {
    this.storage.setLang(lang.target.value);
  }
}
