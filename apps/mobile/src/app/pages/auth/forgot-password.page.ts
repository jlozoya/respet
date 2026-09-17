import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * «Busca tu cuenta»: pide el correo y manda el enlace para una contraseña
 * nueva.
 *
 * La respuesta es la misma exista o no la cuenta, para no revelar quién está
 * registrado.
 */
@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthLayoutComponent, ControlMessagesComponent, IonInput, IonButton, IonIcon, IonSpinner],
  template: `
    <app-auth-layout [showPitch]="false">
      @if (sent()) {
        <div class="done">
          <ion-icon name="mail-unread-outline" />
          <h2>{{ 'AUTH.CHECK_EMAIL' | translate }}</h2>
          <p class="rs-muted">{{ 'AUTH.RESET_SENT' | translate: { email: form.controls.email.value } }}</p>
          <ion-button routerLink="/login" expand="block">{{ 'AUTH.BACK_TO_LOGIN' | translate }}</ion-button>
        </div>
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="send()">
          <h2>{{ 'AUTH.FIND_ACCOUNT' | translate }}</h2>
          <p class="rs-muted">{{ 'FORGOT_PASSWORD_MESSAGE' | translate }}</p>
          <ion-input fill="outline" formControlName="email" type="email" inputmode="email" autocomplete="email" [placeholder]="'EMAIL' | translate" [attr.aria-label]="'EMAIL' | translate" />
          <app-control-messages [control]="form.controls.email" />
          <div class="actions">
            <ion-button class="rs-soft" routerLink="/login">{{ 'CANCEL' | translate }}</ion-button>
            <ion-button type="submit" [disabled]="busy()">
              @if (busy()) {
                <ion-spinner name="crescent" />
              } @else {
                {{ 'SEND' | translate }}
              }
            </ion-button>
          </div>
        </form>
      }
    </app-auth-layout>
  `,
  styles: `
    .form,
    .done {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .done {
      align-items: center;
      text-align: center;
    }

    .done ion-icon {
      color: var(--ion-color-primary);
      font-size: 56px;
    }

    .done ion-button {
      align-self: stretch;
    }

    h2 {
      font-size: 1.375rem;
    }

    p {
      margin: 0;
    }

    ion-input {
      --border-radius: 8px;
    }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);

  readonly busy = signal(false);
  readonly sent = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async send(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.busy.set(true);

    try {
      await this.auth.forgotPassword(this.form.controls.email.value.trim(), this.language.current());
    } catch {
      // Igual que el servidor: un fallo no debe delatar si la cuenta existe.
    } finally {
      this.busy.set(false);
      this.sent.set(true);
    }
  }
}
