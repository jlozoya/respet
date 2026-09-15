import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
// Ionic 9 no trae un barril de componentes: cada uno se importa de su propia
// entrada, de modo que al paquete final sólo llega lo que se usa.
import { IonApp } from '@ionic/angular/ion-app';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonItem } from '@ionic/angular/ion-item';
import { IonMenu } from '@ionic/angular/ion-menu';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { IonSplitPane } from '@ionic/angular/ion-split-pane';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { MenuController } from '@ionic/angular/menu-controller';
import { Platform } from '@ionic/angular/platform';
import { TranslatePipe } from '@ngx-translate/core';

import { ChatDockComponent } from './components/chat/chat-dock/chat-dock.component';
import { NavRailComponent } from './components/shell/nav-rail/nav-rail.component';
import { ChatService } from './core/api/chat.service';
import { AuthService } from './core/auth/auth.service';
import { registerAppIcons } from './core/ui/icons';

/**
 * El armazón de la aplicación: el menú y el hueco donde vive cada pantalla.
 *
 * De la navegación se ocupa `NavRailComponent`, que es la misma tanto si el
 * panel está fijo al lado del contenido como si se abre por encima. Aquí
 * quedan sólo las dos preferencias que no son sitios a los que ir —tema e
 * idioma— y los ajustes de la aplicación nativa.
 */
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    ChatDockComponent,
    NavRailComponent,
    IonApp,
    IonContent,
    IonHeader,
    IonItem,
    IonMenu,
    IonMenuToggle,
    IonRouterOutlet,
    IonSplitPane,
    IonTitle,
    IonToolbar,
  ],
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly menu = inject(MenuController);
  private readonly platform = inject(Platform);

  readonly isAuthenticated = this.auth.isAuthenticated;
  constructor() {
    registerAppIcons();
    void this.initializeNativeShell();

    // Con la sesión ya abierta se conecta el chat, para que el contador de
    // mensajes sin leer aparezca en el menú sin tener que entrar en él.
    effect(() => {
      if (this.isAuthenticated()) {
        void this.chat.start();
      }
    });
  }

  /**
   * Ajustes que sólo tienen sentido dentro de la app nativa.
   *
   * En el navegador estos plugins no hacen nada, pero conviene envolverlos
   * igualmente: un fallo aquí no debe impedir que la aplicación arranque.
   */
  private async initializeNativeShell(): Promise<void> {
    await this.platform.ready();

    if (!this.platform.is('capacitor')) {
      return;
    }

    try {
      await StatusBar.setStyle({ style: Style.Default });
      await SplashScreen.hide();

      // El botón físico de retroceso de Android debe cerrar la aplicación sólo
      // cuando ya no queda nada a lo que volver.
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
