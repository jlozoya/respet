import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { MessagePolicy, UpdatePermissionsRequest, UserPermissions } from '@social-network/shared';

import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { SettingsLayoutComponent } from './settings-layout.component';

type BooleanPermission = {
  [K in keyof UserPermissions]: UserPermissions[K] extends boolean ? K : never;
}[keyof UserPermissions];

interface ToggleSetting {
  key: BooleanPermission;
  label: string;
  hint: string;
}

/**
 * Privacidad: quién ve el perfil, quién puede escribir y qué datos se enseñan.
 *
 * Cada cambio se guarda en el acto, sin botón, como en Instagram; si el
 * servidor lo rechaza el interruptor vuelve a su sitio.
 */
@Component({
  selector: 'app-privacy-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonToggle, IonSelect, IonSelectOption, IonSpinner, SettingsLayoutComponent],
  template: `
    <app-settings-layout title="SETTINGS.PRIVACY" subtitle="SETTINGS.PRIVACY_HINT">
      @if (permissions(); as current) {
        <section class="rs-card block">
          <h3>{{ 'PRIVACY_SETTINGS.AUDIENCE' | translate }}</h3>
          @for (setting of audienceToggles; track setting.key) {
            <div class="setting">
              <span class="text">
                <span class="label">{{ setting.label | translate }}</span>
                <span class="hint">{{ setting.hint | translate }}</span>
              </span>
              <ion-toggle [checked]="current[setting.key]" (ionChange)="toggle(setting.key, $event.detail.checked)" [attr.aria-label]="setting.label | translate" />
            </div>
          }
        </section>

        <section class="rs-card block">
          <h3>{{ 'PRIVACY_SETTINGS.INTERACTIONS' | translate }}</h3>
          <div class="setting">
            <span class="text">
              <span class="label">{{ 'PRIVACY_SETTINGS.MESSAGES' | translate }}</span>
              <span class="hint">{{ 'PRIVACY_SETTINGS.MESSAGES_HINT' | translate }}</span>
            </span>
            <ion-select interface="popover" [value]="current.messagePolicy" (ionChange)="update({ messagePolicy: $event.detail.value })" [attr.aria-label]="'PRIVACY_SETTINGS.MESSAGES' | translate">
              @for (option of policies; track option.value) {
                <ion-select-option [value]="option.value">{{ option.label | translate }}</ion-select-option>
              }
            </ion-select>
          </div>
          <div class="setting">
            <span class="text">
              <span class="label">{{ 'PRIVACY_SETTINGS.STORY_REPLIES' | translate }}</span>
              <span class="hint">{{ 'PRIVACY_SETTINGS.STORY_REPLIES_HINT' | translate }}</span>
            </span>
            <ion-select interface="popover" [value]="current.storyReplyPolicy" (ionChange)="update({ storyReplyPolicy: $event.detail.value })" [attr.aria-label]="'PRIVACY_SETTINGS.STORY_REPLIES' | translate">
              @for (option of policies; track option.value) {
                <ion-select-option [value]="option.value">{{ option.label | translate }}</ion-select-option>
              }
            </ion-select>
          </div>
        </section>

        <section class="rs-card block">
          <h3>{{ 'PRIVACY_SETTINGS.CONTACT' | translate }}</h3>
          @for (setting of contactToggles; track setting.key) {
            <div class="setting">
              <span class="text">
                <span class="label">{{ setting.label | translate }}</span>
                <span class="hint">{{ setting.hint | translate }}</span>
              </span>
              <ion-toggle [checked]="current[setting.key]" (ionChange)="toggle(setting.key, $event.detail.checked)" [attr.aria-label]="setting.label | translate" />
            </div>
          }
        </section>
      } @else {
        <div class="rs-empty"><ion-spinner /></div>
      }
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
})
export class PrivacySettingsPage implements OnInit {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly permissions = signal<UserPermissions | null>(null);

  readonly audienceToggles: readonly ToggleSetting[] = [
    { key: 'privateProfile', label: 'PRIVACY_SETTINGS.PRIVATE', hint: 'PRIVACY_SETTINGS.PRIVATE_HINT' },
    { key: 'showOnlineStatus', label: 'PRIVACY_SETTINGS.ONLINE', hint: 'PRIVACY_SETTINGS.ONLINE_HINT' },
  ];

  readonly contactToggles: readonly ToggleSetting[] = [
    { key: 'showMainEmail', label: 'PRIVACY_SETTINGS.SHOW_EMAIL', hint: 'PRIVACY_SETTINGS.SHOW_EMAIL_HINT' },
    { key: 'showMainPhone', label: 'PRIVACY_SETTINGS.SHOW_PHONE', hint: 'PRIVACY_SETTINGS.SHOW_PHONE_HINT' },
    { key: 'showLocation', label: 'PRIVACY_SETTINGS.SHOW_LOCATION', hint: 'PRIVACY_SETTINGS.SHOW_LOCATION_HINT' },
    { key: 'receiveMailAds', label: 'PRIVACY_SETTINGS.MAIL_ADS', hint: 'PRIVACY_SETTINGS.MAIL_ADS_HINT' },
  ];

  readonly policies: readonly { value: MessagePolicy; label: string }[] = [
    { value: 'everyone', label: 'PRIVACY_SETTINGS.EVERYONE' },
    { value: 'following', label: 'PRIVACY_SETTINGS.FOLLOWING' },
    { value: 'nobody', label: 'PRIVACY_SETTINGS.NOBODY' },
  ];

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.permissions.set(await this.users.permissions());
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  toggle(key: BooleanPermission, value: boolean): Promise<void> {
    return this.update({ [key]: value });
  }

  async update(changes: UpdatePermissionsRequest): Promise<void> {
    const before = this.permissions();

    if (!before) {
      return;
    }

    this.permissions.set({ ...before, ...changes });

    try {
      const saved = await this.users.updatePermissions(changes);
      this.permissions.set(saved);
      await this.auth.patchUser({ permissions: saved });
    } catch (error) {
      this.permissions.set(before);
      await this.feedback.error(error);
    }
  }
}
