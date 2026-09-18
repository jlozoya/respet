import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { NavigationService } from '../../core/ui/navigation.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { BrandingService } from '../../core/branding/branding.service';

/**
 * La columna izquierda del escritorio: el perfil propio y los atajos, con los
 * iconos de colores de Facebook.
 */
@Component({
  selector: 'app-left-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IonIcon, AvatarComponent, FullNamePipe],
  template: `
    <nav class="rail" [attr.aria-label]="'NAV.SHORTCUTS' | translate">
      @if (auth.user(); as user) {
        <a class="rs-row" [routerLink]="['/profile', user.name]" routerLinkActive="active">
          <app-avatar [user]="user" [size]="36" />
          <span class="rs-row-text"
            ><span class="title">{{ user | fullName }}</span></span
          >
        </a>
      }

      @for (entry of navigation.shortcuts(); track entry.link) {
        <a class="rs-row" [routerLink]="entry.link" routerLinkActive="active">
          <span class="icon" [style.background]="entry.color"
            ><ion-icon [name]="entry.icon"
          /></span>
          <span class="rs-row-text"
            ><span class="title">{{ entry.title | translate }}</span></span
          >
          @if (entry.badge) {
            <span class="count">{{ entry.badge > 99 ? '99+' : entry.badge }}</span>
          }
        </a>
      }

      @if (navigation.management().length) {
        <hr class="rs-divider" />
        <h3 class="rs-section-title">{{ 'NAV.MANAGEMENT' | translate }}</h3>
        @for (entry of navigation.management(); track entry.link) {
          <a class="rs-row" [routerLink]="entry.link" routerLinkActive="active">
            <span class="icon" [style.background]="entry.color"
              ><ion-icon [name]="entry.icon"
            /></span>
            <span class="rs-row-text"
              ><span class="title">{{ entry.title | translate }}</span></span
            >
          </a>
        }
      }

      <hr class="rs-divider" />
      <p class="legal">
        <a routerLink="/politics/privacy">{{ 'PRIVACY_POLICY' | translate }}</a> ·
        <a routerLink="/politics/end_user_agreement">{{ 'TERMS_AND_CONDITIONS' | translate }}</a> ·
        <a routerLink="/about">{{ 'NAV.ABOUT_US' | translate }}</a> ·
        <a routerLink="/developers">{{ 'NAV.DEVELOPERS' | translate }}</a> · {{ appName() }} ©
        {{ year }}
      </p>
    </nav>
  `,
  styles: `
    .rail {
      display: flex;
      flex-direction: column;
      padding: 8px;
    }

    .rs-row {
      min-height: 48px;
    }

    .icon {
      align-items: center;
      border-radius: 50%;
      color: #fff;
      display: flex;
      flex: 0 0 36px;
      font-size: 19px;
      height: 36px;
      justify-content: center;
      width: 36px;
    }

    .count {
      background: var(--ion-color-danger);
      border-radius: 999px;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 1px 7px;
    }

    hr {
      margin: 8px;
    }

    .legal {
      color: var(--rs-text-2);
      font-size: 0.8125rem;
      line-height: 1.6;
      margin: 0;
      padding: 8px;
    }

    .legal a:hover {
      text-decoration: underline;
    }
  `,
})
export class LeftRailComponent {
  /** El nombre de la instalación, para el aviso de copyright. */
  readonly appName = inject(BrandingService).name;

  readonly auth = inject(AuthService);
  readonly navigation = inject(NavigationService);
  readonly year = new Date().getFullYear();
}
