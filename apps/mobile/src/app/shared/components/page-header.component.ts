import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Cabecera común de las páginas.
 *
 * Las veintitantas pantallas repetían el mismo bloque de `ion-header` con el
 * botón de menú y el título traducido; aquí queda en un solo sitio, y con
 * `backTo` puede mostrar en su lugar el botón de volver.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonBackButton],
  template: `
    <ion-header>
      <ion-toolbar color="dark-accent">
        <ion-buttons slot="start">
          @if (backTo(); as target) {
            <ion-back-button color="primary" [defaultHref]="target" />
          } @else if (isAuthenticated()) {
<!--
              Con autoHide el botón se esconde solo cuando cree que no hay menú
              que abrir, y esa cuenta la hace al nacer, antes de que el panel
              lateral se haya registrado: el resultado era una cabecera sin
              botón en el móvil. Quien lo esconde ahora es una regla de
              global.scss, atenta a si el panel está fijo a la vista.
            -->
            <ion-menu-button color="primary" [autoHide]="false" />
          } @else {
            <!--
              Sin sesión sólo se pueden leer la presentación, el quiénes somos
              y los textos legales; de todos ellos se vuelve al mismo sitio,
              que es la puerta de entrada.
            -->
            <ion-back-button color="primary" defaultHref="/login" />
          }
        </ion-buttons>

        <ion-title color="medium">{{ title() | translate }}</ion-title>

        <ion-buttons slot="end">
          <ng-content select="[slot=end]" />
        </ion-buttons>
      </ion-toolbar>

      <ng-content />
    </ion-header>
  `,
})
export class PageHeaderComponent {
  /**
   * Cierto cuando hay menú que abrir.
   *
   * Sin sesión el menú ni siquiera se monta, así que el botón abriría un cajón
   * que no existe: en las pocas pantallas que se pueden ver sin cuenta —los
   * textos legales, la presentación— la cabecera se queda sin él.
   */
  readonly isAuthenticated = inject(AuthService).isAuthenticated;

  /** Clave de traducción del título. */
  readonly title = input.required<string>();
  /** Ruta a la que vuelve el botón de retroceso; sin ella se muestra el menú. */
  readonly backTo = input<string | null>(null);
}
