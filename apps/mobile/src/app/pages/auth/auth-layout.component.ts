import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { TranslatePipe } from '@ngx-translate/core';

import { BrandComponent } from '../../components/shell/brand.component';

/**
 * El marco de las pantallas de acceso, el de la portada de Facebook: la marca
 * y el lema a la izquierda, la tarjeta del formulario a la derecha; en el
 * móvil, uno encima del otro.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, BrandComponent],
  template: `
    <ion-content>
      <div class="page">
        <div class="split" [class.solo]="!showPitch()">
          @if (showPitch()) {
            <section class="pitch">
              <app-brand [wordmark]="true" class="brand" />
              <h1>{{ 'LANDING.TAGLINE' | translate }}</h1>
            </section>
          } @else {
            <app-brand [wordmark]="true" class="brand solo-brand" />
          }

          <section class="panel">
            <div class="rs-card card">
              <ng-content />
            </div>
            <ng-content select="[after]" />
          </section>
        </div>

        <footer class="footer">
          <a routerLink="/tutorial">{{ 'NAV.PRESENTATION' | translate }}</a>
          <a routerLink="/about">{{ 'NAV.ABOUT_US' | translate }}</a>
          <a routerLink="/politics/privacy">{{ 'PRIVACY_POLICY' | translate }}</a>
          <a routerLink="/politics/end_user_agreement">{{ 'TERMS_AND_CONDITIONS' | translate }}</a>
          <span>Respet © {{ year }}</span>
        </footer>
      </div>
    </ion-content>
  `,
  styles: `
    /* El contenido tiene que ser hijo directo de la página de Ionic. */
    :host {
      display: contents;
    }

    .page {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    .split {
      align-items: center;
      display: grid;
      flex: 1 1 auto;
      gap: 32px;
      grid-template-columns: 1fr;
      margin: 0 auto;
      max-width: 980px;
      padding: 48px 16px 24px;
      width: 100%;
    }

    @media (min-width: 900px) {
      .split:not(.solo) {
        grid-template-columns: 1.15fr 1fr;
        padding-top: 12vh;
      }
    }

    .split.solo {
      justify-items: center;
      max-width: 460px;
    }

    .pitch {
      text-align: center;
    }

    @media (min-width: 900px) {
      .pitch {
        text-align: start;
      }
    }

    .brand {
      --size: 1;
      transform-origin: left center;
    }

    .pitch .brand {
      transform: scale(1.6);
    }

    @media (max-width: 899.98px) {
      .pitch .brand {
        transform: scale(1.3);
        transform-origin: center;
      }
    }

    h1 {
      font-size: clamp(1.4rem, 3vw, 1.75rem);
      font-weight: 400;
      line-height: 1.3;
      margin-top: 28px;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .card {
      border-radius: 10px !important;
      box-shadow: var(--rs-shadow-2) !important;
      margin: 0 !important;
      padding: 20px 16px;
    }

    .footer {
      color: var(--rs-text-2);
      display: flex;
      flex-wrap: wrap;
      font-size: 0.8125rem;
      gap: 8px 16px;
      justify-content: center;
      padding: 24px 16px calc(24px + var(--ion-safe-area-bottom, 0px));
    }

    .footer a:hover {
      text-decoration: underline;
    }
  `,
})
export class AuthLayoutComponent {
  readonly showPitch = input(true);
  readonly year = new Date().getFullYear();
}
