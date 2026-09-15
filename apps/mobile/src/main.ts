import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
  console.error('No se pudo arrancar la aplicación', error);
});

// Componentes web de Ionic que sustituyen a los plugins nativos cuando la app
// corre en un navegador (la cámara, sobre todo). Se registran después del
// arranque para no retrasar el primer render.
void defineCustomElements(window);
