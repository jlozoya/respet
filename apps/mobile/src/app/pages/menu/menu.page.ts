import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NavigationService } from '../../core/ui/navigation.service';
import { ThemeService } from '../../core/ui/theme.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/**
 * El menú del móvil, la pestaña «Menú» de Facebook: el perfil, los atajos en
 * mosaico, la configuración y salir.
 */
@Component({
  selector: 'app-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonIcon,
    AvatarComponent,
    PageHeaderComponent,
    FullNamePipe,
  ],
  template: `
    <app-page-header title="NAV.MENU" [always]="true" />

    <ion-content>
      <div class="rs-container narrow menu">
        @if (auth.user(); as user) {
          <a class="rs-card rs-row profile" [routerLink]="['/profile', user.name]">
            <app-avatar [user]="user" [size]="44" />
            <span class="rs-row-text">
              <span class="title">{{ user | fullName }}</span>
              <span class="subtitle">{{ 'NAV.SEE_PROFILE' | translate }}</span>
            </span>
          </a>
        }

        <div class="tiles">
          @for (entry of navigation.shortcuts(); track entry.link) {
            <a class="rs-card tile" [routerLink]="entry.link">
              <ion-icon [name]="entry.icon" [style.color]="entry.color" />
              <span>{{ entry.title | translate }}</span>
              @if (entry.badge) {
                <span class="count">{{ entry.badge }}</span>
              }
            </a>
          }
          @for (entry of navigation.management(); track entry.link) {
            <a class="rs-card tile" [routerLink]="entry.link">
              <ion-icon [name]="entry.icon" [style.color]="entry.color" />
              <span>{{ entry.title | translate }}</span>
            </a>
          }
        </div>

        <div class="rs-card list">
          <a class="rs-row" routerLink="/settings">
            <span class="rs-row-icon"><ion-icon name="settings" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'NAV.SETTINGS' | translate }}</span></span
            >
          </a>
          <button type="button" class="rs-row" (click)="theme.toggle()">
            <span class="rs-row-icon"><ion-icon [name]="theme.isDark() ? 'sunny' : 'moon'" /></span>
            <span class="rs-row-text"
              ><span class="title">{{
                (theme.isDark() ? 'THEME.LIGHT' : 'THEME.DARK') | translate
              }}</span></span
            >
          </button>
          <button type="button" class="rs-row" (click)="toggleLanguage()">
            <span class="rs-row-icon"><ion-icon name="language" /></span>
            <span class="rs-row-text"
              ><span class="title">{{
                language.current() === 'es' ? 'English' : 'Español'
              }}</span></span
            >
          </button>
          <a class="rs-row" routerLink="/about">
            <span class="rs-row-icon"><ion-icon name="help-circle" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'NAV.ABOUT_US' | translate }}</span></span
            >
          </a>
          <button type="button" class="rs-row" (click)="navigation.closeSession()">
            <span class="rs-row-icon"><ion-icon name="log-out" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'NAV.LOGOUT' | translate }}</span></span
            >
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .menu {
      padding: 12px;
    }

    .profile {
      margin-bottom: 12px;
      padding: 12px;
      width: 100%;
    }

    .tiles {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-bottom: 12px;
    }

    .tile {
      border-radius: 8px !important;
      display: flex;
      flex-direction: column;
      font-weight: 600;
      gap: 8px;
      margin: 0 !important;
      padding: 12px;
      position: relative;
    }

    .tile ion-icon {
      font-size: 26px;
    }

    .count {
      background: var(--ion-color-danger);
      border-radius: 999px;
      color: #fff;
      font-size: 0.75rem;
      padding: 1px 7px;
      position: absolute;
      right: 10px;
      top: 10px;
    }

    .list {
      border-radius: 8px !important;
      padding: 8px;
    }
  `,
})
export class MenuPage {
  readonly auth = inject(AuthService);
  readonly navigation = inject(NavigationService);
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);

  toggleLanguage(): void {
    void this.language.use(this.language.current() === 'es' ? 'en' : 'es');
  }
}
