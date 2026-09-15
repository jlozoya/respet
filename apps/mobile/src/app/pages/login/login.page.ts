import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SocialLoginService, type SocialProvider } from '../../core/auth/social-login.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ControlMessagesComponent,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialLoginService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);
  private readonly translate = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);

  /** Ruta a la que volver tras iniciar sesión, puesta por `authGuard`. */
  readonly redirectTo = input<string | null>(null);
  /** `1` o `0` cuando se llega desde el enlace de confirmación del correo. */
  readonly verified = input<string | null>(null);

  readonly submitting = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    const verified = this.verified();

    if (verified === '1') {
      void this.feedback.toast('EMAIL_VERIFIED', { color: 'success' });
    } else if (verified === '0') {
      void this.feedback.toast('SERVER.BAD_TOKEN', { color: 'danger' });
    }
  }

  async login(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);

    try {
      await this.auth.login(this.form.getRawValue());
      await this.goHome();
    } catch (error) {
      await this.feedback.error(error, 'SERVER.INCORRECT_USER');
    } finally {
      this.submitting.set(false);
    }
  }

  async loginWith(provider: SocialProvider): Promise<void> {
    this.submitting.set(true);

    try {
      await this.social.signIn(provider, this.language.current());
      await this.goHome();
    } catch (error) {
      await this.feedback.error(error, 'SERVER.INCORRECT_CREDENTIALS');
    } finally {
      this.submitting.set(false);
    }
  }

  /** Pide el correo y manda el enlace para restablecer la contraseña. */
  async recoverPassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('FORGOT_PASSWORD') as string,
      message: this.translate.instant('FORGOT_PASSWORD_MESSAGE') as string,
      inputs: [
        {
          type: 'email',
          name: 'email',
          value: this.form.controls.email.value,
          placeholder: this.translate.instant('EMAIL') as string,
        },
      ],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ACCEPT') as string, role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: { email?: string } }>();
    const email = data?.values.email?.trim();

    if (role !== 'confirm' || !email) {
      return;
    }

    try {
      await this.auth.forgotPassword(email, this.language.current());
    } catch {
      // El servidor responde igual exista o no la cuenta; un fallo de red
      // tampoco debe revelar nada, así que el mensaje es el mismo.
    }

    await this.feedback.toast('SERVER.EMAIL_READY', { color: 'success' });
  }

  goToPolitics(segment: string): void {
    void this.router.navigate(['/politics', segment]);
  }

  private async goHome(): Promise<void> {
    await this.router.navigateByUrl(this.redirectTo() ?? environment.mainUrl);
  }
}
