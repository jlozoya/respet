import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  type ApplicationConfig,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/provide';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/ui/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ionic 9 todavía se apoya en zone.js para parte de sus animaciones, así
    // que no se activa el modo sin zonas. `eventCoalescing` recorta buena parte
    // del trabajo de detección de cambios que eso conlleva.
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),

    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),

    // `useSetInputAPI` hace que Ionic entregue los `componentProps` de una
    // ventana modal con `setInput`. Sin él los asigna encima de la propiedad,
    // y como aquí las entradas son señales lo que llega machaca la función:
    // el componente revienta con «images is not a function» al abrirse.
    provideIonicAngular({ mode: 'md', useSetInputAPI: true }),

    // Chart.js 4 no registra nada por su cuenta: hay que declarar los tipos de
    // gráfica que se usan, y así el resto no llega al paquete final.
    provideCharts(withDefaultRegisterables()),

    provideTranslateService({
      fallbackLang: environment.defaultLanguage,
      lang: environment.defaultLanguage,
      loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    }),

    // El arranque espera a que estén resueltos la sesión y el idioma: así
    // ninguna pantalla llega a pintarse creyendo que no hay usuario cuando sí
    // lo hay, ni parpadea con las claves de traducción sin traducir.
    provideAppInitializer(async () => {
      const theme = inject(ThemeService);
      const language = inject(LanguageService);
      const auth = inject(AuthService);

      // El tema primero: así la primera pantalla ya se pinta con los colores
      // definitivos en lugar de cambiar a la vista.
      await theme.restore();
      await language.restore();
      await auth.restore();
    }),
  ],
};
