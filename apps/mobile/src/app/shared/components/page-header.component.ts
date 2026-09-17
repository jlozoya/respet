import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Cabecera de las pantallas en el móvil.
 *
 * En el escritorio manda la barra superior común y esta cabecera se esconde
 * —salvo con `always`—; en el móvil cada pantalla lleva la suya, con el botón
 * de volver y sus propias acciones a la derecha, como en Instagram.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton],
  template: `
    <ion-header [class.rs-mobile-only]="!always()">
      <ion-toolbar>
        @if (backTo(); as target) {
          <ion-buttons slot="start">
            <ion-back-button [defaultHref]="target" text="" />
          </ion-buttons>
        }

        <ion-title>{{ translateTitle() ? (title() | translate) : title() }}</ion-title>

        <ion-buttons slot="end">
          <ng-content select="[slot=end]" />
        </ion-buttons>
      </ion-toolbar>

      <ng-content />
    </ion-header>
  `,
})
export class PageHeaderComponent {
  /** Clave de traducción del título, o el título tal cual con `translateTitle` en falso. */
  readonly title = input.required<string>();
  readonly translateTitle = input(true);
  /** Adónde vuelve el botón de retroceso si no hay historial. Nulo, sin botón. */
  readonly backTo = input<string | null>('/');
  /** Visible también en el escritorio. */
  readonly always = input(false);
}
