import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { NavigationService } from '../../core/ui/navigation.service';
import { ThemeService } from '../../core/ui/theme.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { BrandingService } from '../../core/branding/branding.service';

/**
 * El desplegable de la cuenta: el perfil, la configuración, el tema, el idioma
 * y salir.
 */
@Component({
  selector: 'app-account-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, AvatarComponent, FullNamePipe],
  template: `
    <div class="rs-menu-list">
      @if (auth.user(); as user) {
        <button type="button" class="rs-row profile" (click)="go(['/profile', user.name])">
          <app-avatar [user]="user" [size]="40" />
          <span class="rs-row-text">
            <span class="title">{{ user | fullName }}</span>
            <span class="subtitle">{{ 'NAV.SEE_PROFILE' | translate }}</span>
          </span>
        </button>
      }

      <hr class="rs-divider" />

      <button type="button" class="rs-row" (click)="go(['/settings'])">
        <span class="rs-row-icon"><ion-icon name="settings" /></span>
        <span class="rs-row-text"
          ><span class="title">{{ 'NAV.SETTINGS' | translate }}</span></span
        >
      </button>

      <button type="button" class="rs-row" (click)="go(['/settings/security'])">
        <span class="rs-row-icon"><ion-icon name="shield-checkmark" /></span>
        <span class="rs-row-text"
          ><span class="title">{{ 'SETTINGS.SECURITY' | translate }}</span></span
        >
      </button>

      @for (entry of navigation.management(); track entry.link) {
        <button type="button" class="rs-row" (click)="go([entry.link])">
          <span class="rs-row-icon"><ion-icon [name]="entry.icon" /></span>
          <span class="rs-row-text"
            ><span class="title">{{ entry.title | translate }}</span></span
          >
        </button>
      }

      <div class="group">
        <span class="rs-row-icon"><ion-icon [name]="theme.isDark() ? 'moon' : 'sunny'" /></span>
        <span class="rs-row-text">
          <span class="title">{{ 'SETTINGS.APPEARANCE' | translate }}</span>
          <span class="rs-chips">
            @for (option of theme.options; track option.value) {
              <button
                type="button"
                class="rs-chip"
                [class.active]="theme.preference() === option.value"
                (click)="theme.use(option.value)"
              >
                {{ option.label | translate }}
              </button>
            }
          </span>
        </span>
      </div>

      <div class="group">
        <span class="rs-row-icon"><ion-icon name="language" /></span>
        <span class="rs-row-text">
          <span class="title">{{ 'SETTINGS.LANGUAGE' | translate }}</span>
          <span class="rs-chips">
            @for (option of language.available(); track option.code) {
              <button
                type="button"
                class="rs-chip"
                [class.active]="language.current() === option.code"
                (click)="language.use(option.code)"
              >
                {{ option.label }}
              </button>
            }
          </span>
        </span>
      </div>

      <button type="button" class="rs-row" (click)="logout()">
        <span class="rs-row-icon"><ion-icon name="log-out" /></span>
        <span class="rs-row-text"
          ><span class="title">{{ 'NAV.LOGOUT' | translate }}</span></span
        >
      </button>

      <p class="legal rs-small rs-muted">
        <button type="button" (click)="go(['/politics', 'privacy'])">
          {{ 'PRIVACY_POLICY' | translate }}
        </button>
        ·
        <button type="button" (click)="go(['/politics', 'end_user_agreement'])">
          {{ 'TERMS_AND_CONDITIONS' | translate }}
        </button>
        · <button type="button" (click)="go(['/about'])">{{ 'NAV.ABOUT_US' | translate }}</button> ·
        {{ appName() }} © {{ year }}
      </p>
    </div>
  `,
  styles: `
    .profile {
      box-shadow: var(--rs-shadow-1);
      margin-bottom: 8px;
    }

    hr {
      margin: 4px 8px 8px;
    }

    .group {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      padding: 8px;
    }

    .group .rs-chips {
      margin-top: 6px;
    }

    .rs-chip {
      font-size: 0.8125rem;
      height: 28px;
    }

    .legal {
      padding: 8px;
    }

    .legal button {
      background: none;
      border: 0;
      color: inherit;
      cursor: pointer;
      font-size: inherit;
      padding: 0;
    }

    .legal button:hover {
      text-decoration: underline;
    }
  `,
})
export class AccountMenuComponent {
  /** El nombre de la instalación, para el aviso de copyright. */
  readonly appName = inject(BrandingService).name;

  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);

  readonly done = output<void>();
  readonly year = new Date().getFullYear();

  go(commands: string[]): void {
    this.done.emit();
    void this.router.navigate(commands);
  }

  async logout(): Promise<void> {
    this.done.emit();
    await this.navigation.closeSession();
  }
}
