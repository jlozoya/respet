import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type { SocialLink } from '@social-network/shared';

import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { NavigationService } from '../../core/ui/navigation.service';
import { ReauthService } from '../../core/ui/reauth.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { matchFields, passwordValidator } from '../../shared/validators/form-validators';
import { SettingsLayoutComponent } from './settings-layout.component';

/**
 * La cuenta: el correo, la contraseña, las cuentas enlazadas y borrarla.
 */
@Component({
  selector: 'app-account-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    IonToggle,
    ControlMessagesComponent,
    SettingsLayoutComponent,
  ],
  template: `
    <app-settings-layout title="SETTINGS.ACCOUNT" subtitle="SETTINGS.ACCOUNT_HINT">
      @if (auth.user(); as user) {
        <section class="rs-card block">
          <h3>{{ 'EMAIL' | translate }}</h3>
          <div class="item">
            <span class="icon"><ion-icon name="mail-outline" /></span>
            <span class="text">
              <span class="title">{{ user.email }}</span>
              <span class="meta">
                @if (user.emailVerified) {
                  <span class="status on"><ion-icon name="checkmark-circle" /> {{ 'ACCOUNT_SETTINGS.VERIFIED' | translate }}</span>
                } @else {
                  <span class="status off">{{ 'ACCOUNT_SETTINGS.NOT_VERIFIED' | translate }}</span>
                }
              </span>
            </span>
            @if (!user.emailVerified) {
              <ion-button size="small" class="rs-tinted" (click)="resend()">{{ 'ACCOUNT_SETTINGS.RESEND' | translate }}</ion-button>
            }
          </div>

          <form class="form" [formGroup]="emailForm" (ngSubmit)="changeEmail()">
            <ion-input fill="outline" labelPlacement="floating" [label]="'ACCOUNT_SETTINGS.NEW_EMAIL' | translate" formControlName="email" type="email" inputmode="email" />
            <app-control-messages [control]="emailForm.controls.email" />
            @if (user.provider === 'password') {
              <ion-input fill="outline" labelPlacement="floating" [label]="'CURRENT_PASSWORD' | translate" formControlName="password" type="password" autocomplete="current-password">
                <ion-input-password-toggle slot="end" />
              </ion-input>
            }
            <div class="actions">
              <ion-button type="submit" [disabled]="busy() === 'email' || emailForm.pristine">{{ 'CHANGE_EMAIL' | translate }}</ion-button>
            </div>
          </form>
        </section>

        @if (user.provider === 'password') {
          <form class="rs-card block form" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
            <h3>{{ 'CHANGE_PASSWORD' | translate }}</h3>
            <ion-input fill="outline" labelPlacement="floating" [label]="'CURRENT_PASSWORD' | translate" formControlName="currentPassword" type="password" autocomplete="current-password">
              <ion-input-password-toggle slot="end" />
            </ion-input>
            <app-control-messages [control]="passwordForm.controls.currentPassword" />
            <ion-input fill="outline" labelPlacement="floating" [label]="'NEW_PASSWORD' | translate" formControlName="newPassword" type="password" autocomplete="new-password">
              <ion-input-password-toggle slot="end" />
            </ion-input>
            <app-control-messages [control]="passwordForm.controls.newPassword" />
            <ion-input fill="outline" labelPlacement="floating" [label]="'PASSWORD_CONFIRMATION' | translate" formControlName="confirmation" type="password" autocomplete="new-password">
              <ion-input-password-toggle slot="end" />
            </ion-input>
            <app-control-messages [control]="passwordForm.controls.confirmation" />
            <div class="setting">
              <span class="text">
                <span class="label">{{ 'ACCOUNT_SETTINGS.SIGN_OUT_OTHERS' | translate }}</span>
                <span class="hint">{{ 'ACCOUNT_SETTINGS.SIGN_OUT_OTHERS_HINT' | translate }}</span>
              </span>
              <ion-toggle formControlName="signOutOtherSessions" [attr.aria-label]="'ACCOUNT_SETTINGS.SIGN_OUT_OTHERS' | translate" />
            </div>
            <div class="actions">
              <ion-button type="submit" [disabled]="busy() === 'password'">
                @if (busy() === 'password') {
                  <ion-spinner name="crescent" />
                } @else {
                  {{ 'CHANGE_PASSWORD' | translate }}
                }
              </ion-button>
            </div>
          </form>
        }

        @if (user.socialLinks.length) {
          <section class="rs-card block">
            <h3>{{ 'ACCOUNT_SETTINGS.LINKED' | translate }}</h3>
            @for (link of user.socialLinks; track link.id) {
              <div class="item">
                <span class="icon"><ion-icon [name]="'logo-' + link.provider" /></span>
                <span class="text"><span class="title">{{ providerName(link) }}</span></span>
                <ion-button size="small" class="rs-soft" (click)="unlink(link)">{{ 'UNLINK' | translate }}</ion-button>
              </div>
            }
          </section>
        }

        <section class="rs-card block danger-zone">
          <h3>{{ 'DELETE_ACCOUNT' | translate }}</h3>
          <p class="rs-muted">{{ 'ACCOUNT_SETTINGS.DELETE_HINT' | translate }}</p>
          <div class="actions">
            <ion-button color="danger" fill="outline" (click)="deleteAccount()">{{ 'DELETE_MY_ACCOUNT' | translate }}</ion-button>
          </div>
        </section>
      }
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
})
export class AccountSettingsPage {
  readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);
  private readonly reauth = inject(ReauthService);
  private readonly navigation = inject(NavigationService);

  readonly busy = signal<'email' | 'password' | null>(null);

  readonly emailForm = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });

  readonly passwordForm = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, passwordValidator()]],
      confirmation: ['', [Validators.required]],
      signOutOtherSessions: [true],
    },
    { validators: matchFields('newPassword', 'confirmation') },
  );

  providerName(link: SocialLink): string {
    return link.provider.charAt(0).toUpperCase() + link.provider.slice(1);
  }

  async resend(): Promise<void> {
    await this.guard(async () => {
      await this.auth.resendVerification();
      await this.feedback.toast('SERVER.EMAIL_READY', { color: 'success' });
    });
  }

  async changeEmail(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();

      return;
    }

    this.busy.set('email');
    const value = this.emailForm.getRawValue();

    await this.guard(async () => {
      await this.users.requestEmailChange({ email: value.email.trim(), password: value.password || undefined });
      this.emailForm.reset();
      await this.feedback.toast('EMAIL_CHANGE_REQUESTED', { color: 'success', duration: 6000 });
    });

    this.busy.set(null);
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();

      return;
    }

    this.busy.set('password');
    const value = this.passwordForm.getRawValue();

    await this.guard(async () => {
      await this.auth.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        signOutOtherSessions: value.signOutOtherSessions,
      });
      this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmation: '', signOutOtherSessions: true });
      await this.feedback.toast('PASSWORD_CHANGED', { color: 'success' });
    });

    this.busy.set(null);
  }

  async unlink(link: SocialLink): Promise<void> {
    await this.guard(async () => {
      await this.users.unlinkSocialAccount(link.id);
      await this.auth.refreshUser();
      await this.feedback.toast('SERVER.SOCIAL_LINK_DELETED', { color: 'success' });
    });
  }

  async deleteAccount(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'DELETE_ACCOUNT',
      message: 'ACCOUNT_SETTINGS.DELETE_CONFIRM',
      confirmText: 'DELETE_MY_ACCOUNT',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await this.guard(async () => {
      const done = await this.reauth.run((reauth) => this.users.deleteMyAccount(reauth));

      if (done !== null) {
        this.navigation.stopSession();
        await this.auth.forgetSession();
        await this.feedback.toast('ACCOUNT_SETTINGS.DELETED');
      }
    });
  }

  private async guard(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
