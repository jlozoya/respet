import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { matchFields, passwordValidator } from '../../shared/validators/form-validators';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * Elegir una contraseña nueva desde el enlace del correo.
 *
 * Al guardarla el servidor cierra todas las sesiones abiertas: quien pidió el
 * cambio puede que lo hiciera porque alguien más tenía la suya.
 */
@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthLayoutComponent, ControlMessagesComponent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner],
  template: `
    <app-auth-layout [showPitch]="false">
      @if (token()) {
        <form class="form" [formGroup]="form" (ngSubmit)="save()">
          <h2>{{ 'AUTH.NEW_PASSWORD_TITLE' | translate }}</h2>
          <p class="rs-muted">{{ 'AUTH.NEW_PASSWORD_HINT' | translate }}</p>

          <ion-input fill="outline" formControlName="password" type="password" autocomplete="new-password" [placeholder]="'NEW_PASSWORD' | translate" [attr.aria-label]="'NEW_PASSWORD' | translate">
            <ion-input-password-toggle slot="end" />
          </ion-input>
          <app-control-messages [control]="form.controls.password" />

          <ion-input fill="outline" formControlName="confirmation" type="password" autocomplete="new-password" [placeholder]="'PASSWORD_CONFIRMATION' | translate" [attr.aria-label]="'PASSWORD_CONFIRMATION' | translate">
            <ion-input-password-toggle slot="end" />
          </ion-input>
          <app-control-messages [control]="form.controls.confirmation" />

          <ion-button type="submit" expand="block" [disabled]="busy()">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ 'SAVE' | translate }}
            }
          </ion-button>
        </form>
      } @else {
        <div class="form">
          <h2>{{ 'AUTH.LINK_INVALID' | translate }}</h2>
          <p class="rs-muted">{{ 'AUTH.LINK_INVALID_HINT' | translate }}</p>
          <ion-button routerLink="/forgot-password" expand="block">{{ 'AUTH.REQUEST_NEW_LINK' | translate }}</ion-button>
        </div>
      }
    </app-auth-layout>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
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
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  /** Llega en la dirección del correo: `/reset-password?token=…`. */
  readonly token = input<string | null>(null);

  readonly busy = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, passwordValidator()]],
      confirmation: ['', [Validators.required]],
    },
    { validators: matchFields('password', 'confirmation') },
  );

  async save(): Promise<void> {
    const token = this.token();

    if (this.form.invalid || !token) {
      this.form.markAllAsTouched();

      return;
    }

    this.busy.set(true);

    try {
      await this.auth.resetPassword(token, this.form.controls.password.value);
      await this.auth.forgetSession({ redirect: false });
      await this.feedback.toast('PASSWORD_CHANGED_LOGIN_AGAIN', { color: 'success' });
      await this.router.navigateByUrl('/login');
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
