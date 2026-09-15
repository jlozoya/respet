import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonRow } from '@ionic/angular/ion-row';
import { IonText } from '@ionic/angular/ion-text';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { matchFields, passwordValidator } from '../../shared/validators/form-validators';

/**
 * Destino del enlace de recuperación de contraseña.
 *
 * El correo lleva a `/reset-password?token=…`; el token se enlaza solo gracias
 * a `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    ControlMessagesComponent,
    IonContent,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonText,
  ],
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly token = input<string | null>(null);

  readonly submitting = signal(false);
  readonly hasToken = computed(() => Boolean(this.token()));

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, passwordValidator()]],
      passwordConfirmation: ['', [Validators.required]],
    },
    { validators: matchFields('password', 'passwordConfirmation') },
  );

  async submit(): Promise<void> {
    const token = this.token();

    if (!token || this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);

    try {
      await this.auth.resetPassword(token, this.form.getRawValue().password);
      await this.feedback.toast('PASSWORD_CHANGED', { color: 'success' });
      await this.router.navigateByUrl('/login');
    } catch (error) {
      await this.feedback.error(error, 'SERVER.BAD_TOKEN');
    } finally {
      this.submitting.set(false);
    }
  }
}
