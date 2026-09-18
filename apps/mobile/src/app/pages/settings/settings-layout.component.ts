import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { SETTINGS_SECTIONS } from './settings-sections';

/**
 * El marco de cada apartado de la configuración.
 *
 * En el escritorio, la lista de apartados a la izquierda y el apartado a la
 * derecha; en el móvil, sólo el apartado con su botón de volver a la lista.
 */
@Component({
  selector: 'app-settings-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IonContent, IonIcon, PageHeaderComponent],
  template: `
    <app-page-header [title]="title()" backTo="/settings" />

    <ion-content>
      <div class="layout">
        <nav class="nav rs-desktop-only">
          <h1>{{ 'NAV.SETTINGS' | translate }}</h1>
          @for (section of sections; track section.link) {
            <a class="rs-row" [routerLink]="section.link" routerLinkActive="active">
              <span class="rs-row-icon"><ion-icon [name]="section.icon" /></span>
              <span class="rs-row-text"
                ><span class="title">{{ section.title | translate }}</span></span
              >
            </a>
          }
        </nav>

        <main class="content">
          <h2 class="heading rs-desktop-only">{{ title() | translate }}</h2>
          @if (subtitle()) {
            <p class="rs-muted subtitle">{{ subtitle() | translate }}</p>
          }
          <ng-content />
        </main>
      </div>
    </ion-content>
  `,
  styles: `
    /* La cabecera y el contenido tienen que ser hijos directos de la página de Ionic. */
    :host {
      display: contents;
    }

    .layout {
      display: grid;
      gap: 24px;
      grid-template-columns: minmax(0, 1fr);
      margin: 0 auto;
      max-width: 1100px;
      padding: 16px 12px 48px;
    }

    @media (min-width: 992px) {
      .layout {
        grid-template-columns: 300px minmax(0, 1fr);
      }
    }

    .nav {
      align-self: start;
      background: var(--rs-surface);
      border-radius: 8px;
      box-shadow: var(--rs-shadow-1);
      display: flex;
      flex-direction: column;
      padding: 12px 8px;
      position: sticky;
      top: 16px;
    }

    .nav h1 {
      font-size: 1.5rem;
      padding: 4px 8px 12px;
    }

    .content {
      margin: 0 auto;
      max-width: 700px;
      min-width: 0;
      width: 100%;
    }

    .heading {
      font-size: 1.5rem;
      padding: 0 4px 4px;
    }

    .subtitle {
      margin: 0 4px 16px;
    }
  `,
})
export class SettingsLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly sections = SETTINGS_SECTIONS;
}
