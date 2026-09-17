import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { MfaChallenge, MfaMethod } from '@respet/shared';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/api/api-error';
import { AuthService, type LoginOutcome } from '../../core/auth/auth.service';
import { SocialLoginService, type SocialProvider } from '../../core/auth/social-login.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * Entrar.
 *
 * Con la verificación en dos pasos activa, la contraseña no abre la sesión:
 * la pantalla pasa al segundo paso y pide el código de la app de
 * autenticación, o uno de recuperación si no se tiene el teléfono a mano.
 * Marcar «confiar en este dispositivo» evita que se vuelva a pedir aquí.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    AuthLayoutComponent,
    ControlMessagesComponent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonIcon,
    IonSpinner,
    IonCheckbox,
  ],
  template: `
    <app-auth-layout>
      @if (challenge(); as pending) {
        <form class="form" (ngSubmit)="verify()">
          <div class="step-icon"><ion-icon name="shield-checkmark" /></div>
          <h2>{{ 'AUTH.MFA_TITLE' | translate }}</h2>
          <p class="rs-muted">
            {{ (method() === 'totp' ? 'AUTH.MFA_TOTP_HINT' : 'AUTH.MFA_RECOVERY_HINT') | translate }}
          </p>

          <ion-input
            fill="outline"
            class="code"
            [formControl]="codeControl"
            [inputmode]="method() === 'totp' ? 'numeric' : 'text'"
            autocomplete="one-time-code"
            [maxlength]="method() === 'totp' ? 6 : 12"
            [placeholder]="(method() === 'totp' ? 'AUTH.MFA_CODE' : 'AUTH.RECOVERY_CODE') | translate"
            [attr.aria-label]="'AUTH.MFA_CODE' | translate"
          />

          <div class="trust">
            <ion-checkbox [checked]="trustDevice()" (ionChange)="trustDevice.set($event.detail.checked)" labelPlacement="end">
              {{ 'AUTH.TRUST_DEVICE' | translate }}
            </ion-checkbox>
          </div>

          <ion-button type="submit" expand="block" [disabled]="submitting() || !codeControl.value">
            @if (submitting()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ 'AUTH.VERIFY' | translate }}
            }
          </ion-button>

          @if (pending.methods.includes(otherMethod())) {
            <button type="button" class="rs-link switch" (click)="switchMethod()">
              {{ (method() === 'totp' ? 'AUTH.USE_RECOVERY' : 'AUTH.USE_TOTP') | translate }}
            </button>
          }
          <button type="button" class="rs-text-btn back" (click)="cancelChallenge()">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</button>
        </form>
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="login()">
          <ion-input
            fill="outline"
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            [placeholder]="'EMAIL' | translate"
            [attr.aria-label]="'EMAIL' | translate"
          />
          <app-control-messages [control]="form.controls.email" />

          <ion-input
            fill="outline"
            formControlName="password"
            type="password"
            autocomplete="current-password"
            [placeholder]="'PASSWORD' | translate"
            [attr.aria-label]="'PASSWORD' | translate"
          >
            <ion-input-password-toggle slot="end" />
          </ion-input>
          <app-control-messages [control]="form.controls.password" />

          <ion-button type="submit" expand="block" size="large" [disabled]="submitting()">
            @if (submitting()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ 'LOGIN' | translate }}
            }
          </ion-button>

          <a class="rs-link forgot" routerLink="/forgot-password">{{ 'LANDING.FORGOT' | translate }}</a>

          <hr class="rs-divider" />

          <div class="social">
            <ion-button expand="block" fill="outline" color="google" [disabled]="submitting()" (click)="loginWith('google')">
              <ion-icon name="logo-google" slot="start" /> {{ 'AUTH.CONTINUE_WITH' | translate: { provider: 'Google' } }}
            </ion-button>
            <ion-button expand="block" fill="outline" color="facebook" [disabled]="submitting()" (click)="loginWith('facebook')">
              <ion-icon name="logo-facebook" slot="start" /> {{ 'AUTH.CONTINUE_WITH' | translate: { provider: 'Facebook' } }}
            </ion-button>
          </div>

          <ion-button class="create" color="success" routerLink="/signup">{{ 'LANDING.CREATE_ACCOUNT' | translate }}</ion-button>
        </form>
      }
    </app-auth-layout>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    ion-input {
      --border-radius: 8px;
      font-size: 1.0625rem;
    }

    .forgot,
    .switch {
      align-self: center;
      background: none;
      border: 0;
      cursor: pointer;
      padding: 4px;
    }

    .forgot:hover,
    .switch:hover {
      text-decoration: underline;
    }

    hr {
      margin: 8px 0;
    }

    .social {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .create {
      align-self: center;
      margin-top: 12px;
      min-width: 200px;
    }

    .step-icon {
      align-items: center;
      align-self: center;
      background: var(--rs-accent-soft);
      border-radius: 50%;
      color: var(--ion-color-primary);
      display: flex;
      font-size: 32px;
      height: 64px;
      justify-content: center;
      width: 64px;
    }

    h2 {
      font-size: 1.375rem;
      text-align: center;
    }

    p {
      margin: 0;
      text-align: center;
    }

    .code {
      font-size: 1.5rem;
      letter-spacing: 0.3em;
      text-align: center;
    }

    .trust {
      padding: 4px 0;
    }

    .back {
      align-self: center;
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialLoginService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  /** Ruta a la que volver tras entrar, puesta por `authGuard`. */
  readonly redirectTo = input<string | null>(null);

  readonly submitting = signal(false);
  readonly challenge = signal<MfaChallenge | null>(null);
  readonly method = signal<MfaMethod>('totp');
  readonly trustDevice = signal(true);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly codeControl = inject(FormBuilder).nonNullable.control('');

  otherMethod(): MfaMethod {
    return this.method() === 'totp' ? 'recovery_code' : 'totp';
  }

  async login(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    await this.run(() => this.auth.login(this.form.getRawValue()), 'SERVER.INCORRECT_USER');
  }

  async loginWith(provider: SocialProvider): Promise<void> {
    await this.run(() => this.social.signIn(provider, this.language.current()), 'SERVER.INCORRECT_CREDENTIALS');
  }

  async verify(): Promise<void> {
    const pending = this.challenge();

    if (!pending || !this.codeControl.value.trim()) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.auth.completeMfaLogin({
        challengeToken: pending.token,
        method: this.method(),
        code: this.codeControl.value,
        trustDevice: this.trustDevice(),
      });
      await this.goHome();
    } catch (error) {
      this.submitting.set(false);

      // El reto caduca a los cinco minutos: se vuelve a empezar.
      if (error instanceof ApiError && (error.is('SERVER.BAD_TOKEN') || error.is('SERVER.WRONG_TOKEN'))) {
        this.cancelChallenge();
      }

      this.codeControl.setValue('');
      await this.feedback.error(error, 'SERVER.INVALID_MFA_CODE');
    }
  }

  switchMethod(): void {
    this.method.set(this.otherMethod());
    this.codeControl.setValue('');
  }

  cancelChallenge(): void {
    this.challenge.set(null);
    this.codeControl.setValue('');
  }

  private async run(operation: () => Promise<LoginOutcome>, fallback: string): Promise<void> {
    this.submitting.set(true);

    try {
      const outcome = await operation();

      if (outcome.status === 'mfa_required') {
        this.method.set(outcome.challenge.methods.includes('totp') ? 'totp' : 'recovery_code');
        this.challenge.set(outcome.challenge);
        this.submitting.set(false);

        return;
      }

      // `submitting` sigue encendido hasta que acaba la navegación: así no se
      // ve el formulario un instante con la aplicación ya cargando detrás.
      await this.goHome();
    } catch (error) {
      this.submitting.set(false);
      await this.feedback.error(error, fallback);
    }
  }

  private async goHome(): Promise<void> {
    await this.router.navigateByUrl(this.redirectTo() ?? environment.mainUrl);
    this.submitting.set(false);
  }
}
