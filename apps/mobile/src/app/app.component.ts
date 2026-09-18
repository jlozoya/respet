import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { Platform } from '@ionic/angular/platform';
import { filter } from 'rxjs';

import { ChatDockComponent } from './components/chat/chat-dock.component';
import { TabBarComponent } from './components/shell/tab-bar.component';
import { TopBarComponent } from './components/shell/top-bar.component';
import { AuthService } from './core/auth/auth.service';
import { registerAppIcons } from './core/ui/icons';
import { NavigationService } from './core/ui/navigation.service';

/**
 * Pantallas que ocupan todo: sin barras alrededor.
 *
 * El hilo de una conversación en el móvil necesita la caja de escribir pegada
 * abajo, los directos y la pantalla de autorizar una aplicación van a pantalla
 * completa.
 */
const IMMERSIVE = [/^\/messages\/[^/]+/, /^\/live\/.+/, /^\/oauth\//, /^\/stories\/view/];

/**
 * El armazón: la barra superior en el escritorio, la de pestañas en el móvil y
 * el muelle del chat.
 *
 * También decide cuándo arranca lo que depende de la sesión —la conexión en
 * tiempo real, el chat, los avisos—: en cuanto hay usuario, y se suelta en
 * cuanto deja de haberlo, sea porque salió o porque la sesión se cerró desde
 * otro sitio.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, TopBarComponent, TabBarComponent, ChatDockComponent],
  template: `
    <ion-app>
      @if (isAuthenticated()) {
        <app-top-bar class="rs-desktop-only" />
      }

      <div class="body">
        <ion-router-outlet />
      </div>

      @if (isAuthenticated() && !immersive()) {
        <app-tab-bar class="rs-mobile-only" />
      }

      @if (isAuthenticated()) {
        <app-chat-dock />
      }
    </ion-app>
  `,
  styles: `
    ion-app {
      justify-content: flex-start;
    }

    .body {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAuthenticated = this.auth.isAuthenticated;
  private readonly url = signal(this.router.url);
  readonly immersive = computed(() => IMMERSIVE.some((pattern) => pattern.test(this.url())));

  private sessionStarted = false;

  constructor() {
    registerAppIcons();
    void this.initializeNativeShell();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.url.set(event.urlAfterRedirects));

    effect(() => {
      const authenticated = this.isAuthenticated();

      untracked(() => {
        if (authenticated && !this.sessionStarted) {
          this.sessionStarted = true;
          this.navigation.startSession();
        } else if (!authenticated && this.sessionStarted) {
          this.sessionStarted = false;
          this.navigation.stopSession();
        }
      });
    });
  }

  /**
   * Ajustes que sólo tienen sentido dentro de la app nativa.
   *
   * En el navegador estos plugins no hacen nada, pero conviene envolverlos: un
   * fallo aquí no debe impedir que la aplicación arranque.
   */
  private async initializeNativeShell(): Promise<void> {
    await this.platform.ready();

    if (!this.platform.is('capacitor')) {
      return;
    }

    try {
      await StatusBar.setStyle({ style: Style.Default });
      await SplashScreen.hide();

      void App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });
    } catch (error) {
      console.warn('No se pudieron aplicar los ajustes nativos', error);
    }
  }
}
