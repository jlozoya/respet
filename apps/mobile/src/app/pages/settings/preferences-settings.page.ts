import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PushService } from '../../core/push/push.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ThemeService, type ThemePreference } from '../../core/ui/theme.service';
import { SettingsLayoutComponent } from './settings-layout.component';

/** Pantalla e idioma, y las notificaciones del dispositivo. */
@Component({
  selector: 'app-preferences-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonButton, IonIcon, SettingsLayoutComponent],
  template: `
    <app-settings-layout title="SETTINGS.PREFERENCES" subtitle="SETTINGS.PREFERENCES_HINT">
      <section class="rs-card block">
        <h3>{{ 'SETTINGS.APPEARANCE' | translate }}</h3>
        <div class="choices">
          @for (option of theme.options; track option.value) {
            <button type="button" class="choice" [class.active]="theme.preference() === option.value" (click)="setTheme(option.value)">
              <ion-icon [name]="option.icon" />
              <span>{{ option.label | translate }}</span>
            </button>
          }
        </div>
      </section>

      <section class="rs-card block">
        <h3>{{ 'SETTINGS.LANGUAGE' | translate }}</h3>
        <div class="choices">
          @for (option of language.available(); track option.code) {
            <button type="button" class="choice" [class.active]="language.current() === option.code" (click)="setLanguage(option.code)">
              <span class="flag">{{ option.code.toUpperCase() }}</span>
              <span>{{ option.label }}</span>
            </button>
          }
        </div>
      </section>

      <section class="rs-card block">
        <h3>{{ 'SETTINGS.PUSH' | translate }}</h3>
        @if (push.supported) {
          <div class="setting">
            <span class="text">
              <span class="label">{{ 'SETTINGS.PUSH_STATUS' | translate }}</span>
              <span class="hint">{{ 'SETTINGS.PUSH_' + push.permission().toUpperCase() | translate }}</span>
            </span>
            @if (push.permission() !== 'granted') {
              <ion-button size="small" (click)="push.start()">{{ 'SETTINGS.PUSH_ENABLE' | translate }}</ion-button>
            }
          </div>
        } @else {
          <p class="rs-muted">{{ 'SETTINGS.PUSH_WEB' | translate }}</p>
        }
      </section>
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
  styles: `
    .choices {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      margin-top: 12px;
    }

    .choice {
      align-items: center;
      background: var(--rs-surface-2);
      border: 2px solid transparent;
      border-radius: 10px;
      color: inherit;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      font-weight: 600;
      gap: 6px;
      padding: 16px 8px;
    }

    .choice ion-icon {
      font-size: 26px;
    }

    .choice.active {
      background: var(--rs-accent-soft);
      border-color: var(--ion-color-primary);
      color: var(--ion-color-primary);
    }

    .flag {
      font-size: 1.25rem;
      font-weight: 800;
    }
  `,
})
export class PreferencesSettingsPage {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  readonly push = inject(PushService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  async setTheme(preference: ThemePreference): Promise<void> {
    await this.theme.use(preference);
  }

  /** El idioma también se guarda en la cuenta: es el de los correos y los avisos push. */
  async setLanguage(code: string): Promise<void> {
    await this.language.use(code);

    try {
      await this.auth.setUser(await this.users.updateLanguage(code));
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
