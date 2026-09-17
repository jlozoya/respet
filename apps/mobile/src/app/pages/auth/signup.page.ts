import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Gender } from '@respet/shared';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { passwordValidator, usernameValidator } from '../../shared/validators/form-validators';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * «Crea una cuenta», con lo mínimo: nombre, nombre de usuario, correo,
 * contraseña y, opcionalmente, fecha de nacimiento y género.
 */
@Component({
  selector: 'app-signup',
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
    IonSpinner,
  ],
  template: `
    <app-auth-layout [showPitch]="false">
      <form class="form" [formGroup]="form" (ngSubmit)="register()">
        <h2>{{ 'SIGNUP_PAGE.TITLE' | translate }}</h2>
        <p class="rs-muted subtitle">{{ 'SIGNUP_PAGE.SUBTITLE' | translate }}</p>
        <hr class="rs-divider" />

        <div class="pair">
          <div>
            <ion-input fill="outline" formControlName="firstName" autocomplete="given-name" [placeholder]="'FIRST_NAME' | translate" [attr.aria-label]="'FIRST_NAME' | translate" />
            <app-control-messages [control]="form.controls.firstName" />
          </div>
          <div>
            <ion-input fill="outline" formControlName="lastName" autocomplete="family-name" [placeholder]="'LAST_NAME' | translate" [attr.aria-label]="'LAST_NAME' | translate" />
            <app-control-messages [control]="form.controls.lastName" />
          </div>
        </div>

        <ion-input fill="outline" formControlName="name" autocomplete="username" autocapitalize="off" [placeholder]="'SIGNUP_PAGE.USERNAME' | translate" [attr.aria-label]="'SIGNUP_PAGE.USERNAME' | translate">
          <span slot="start" class="at">&#64;</span>
        </ion-input>
        <app-control-messages [control]="form.controls.name" />

        <ion-input fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" [placeholder]="'EMAIL' | translate" [attr.aria-label]="'EMAIL' | translate" />
        <app-control-messages [control]="form.controls.email" />

        <ion-input fill="outline" formControlName="password" type="password" autocomplete="new-password" [placeholder]="'NEW_PASSWORD' | translate" [attr.aria-label]="'NEW_PASSWORD' | translate">
          <ion-input-password-toggle slot="end" />
        </ion-input>
        <app-control-messages [control]="form.controls.password" />

        <label class="label rs-small rs-muted" for="birthday">{{ 'BIRTHDAY' | translate }}</label>
        <input id="birthday" class="date" type="date" formControlName="birthday" [max]="today" />

        <span class="label rs-small rs-muted">{{ 'GENDER' | translate }}</span>
        <div class="genders">
          @for (option of genders; track option.value) {
            <button type="button" class="gender" [class.active]="form.controls.gender.value === option.value" (click)="form.controls.gender.setValue(option.value)">
              {{ option.label | translate }}
            </button>
          }
        </div>

        <p class="legal rs-small rs-muted">
          {{ 'BY_CLICKING_TO_REGISTER' | translate }}
          <a routerLink="/politics/end_user_agreement">{{ 'TERMS_AND_CONDITIONS' | translate }}</a> ·
          <a routerLink="/politics/privacy">{{ 'PRIVACY_POLICY' | translate }}</a>
        </p>

        <ion-button type="submit" color="success" class="submit" [disabled]="submitting()">
          @if (submitting()) {
            <ion-spinner name="crescent" />
          } @else {
            {{ 'SIGNUP' | translate }}
          }
        </ion-button>

        <a class="rs-link have-account" routerLink="/login">{{ 'SIGNUP_PAGE.HAVE_ACCOUNT' | translate }}</a>
      </form>
    </app-auth-layout>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    h2 {
      font-size: 1.75rem;
      text-align: center;
    }

    .subtitle {
      margin: 0;
      text-align: center;
    }

    .pair {
      display: grid;
      gap: 8px;
      grid-template-columns: 1fr 1fr;
    }

    ion-input {
      --border-radius: 8px;
    }

    .at {
      color: var(--rs-text-2);
      margin-inline-end: 2px;
    }

    .label {
      margin-top: 6px;
    }

    .date {
      background: var(--rs-surface);
      border: 1px solid var(--rs-divider);
      border-radius: 8px;
      color: inherit;
      font: inherit;
      height: 44px;
      padding: 0 12px;
    }

    .genders {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(3, 1fr);
    }

    .gender {
      background: var(--rs-surface);
      border: 1px solid var(--rs-divider);
      border-radius: 8px;
      color: inherit;
      cursor: pointer;
      height: 40px;
    }

    .gender.active {
      border-color: var(--ion-color-primary);
      box-shadow: inset 0 0 0 1px var(--ion-color-primary);
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .legal {
      margin: 8px 0 0;
    }

    .legal a {
      color: var(--ion-color-primary);
    }

    .submit {
      align-self: center;
      margin-top: 8px;
      min-width: 200px;
    }

    .have-account {
      align-self: center;
      padding: 8px;
    }
  `,
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly genders: readonly { value: Gender; label: string }[] = [
    { value: 'female', label: 'FEMALE' },
    { value: 'male', label: 'MALE' },
    { value: 'unspecified', label: 'PREFER_NOT_TO_SAY' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, usernameValidator()]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordValidator()]],
    birthday: [''],
    gender: new FormControl<Gender | ''>('', { nonNullable: true }),
  });

  constructor() {
    // Propone un nombre de usuario a partir del nombre, hasta que se toque a mano.
    this.form.controls.firstName.valueChanges.subscribe(() => this.suggestUsername());
    this.form.controls.lastName.valueChanges.subscribe(() => this.suggestUsername());
  }

  async register(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);

    try {
      await this.auth.register({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        birthday: value.birthday || undefined,
        gender: value.gender || undefined,
        lang: this.language.current(),
      });

      await this.feedback.toast('SIGNUP_SUCCESS', { color: 'success' });
      await this.router.navigateByUrl(environment.mainUrl);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private suggestUsername(): void {
    const control = this.form.controls.name;

    if (control.dirty) {
      return;
    }

    const base = `${this.form.controls.firstName.value}${this.form.controls.lastName.value}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);

    control.setValue(base, { emitEvent: false });
  }
}
