import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthProvider, type User } from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { SocialLoginService, type SocialProvider } from '../../../../core/auth/social-login.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../../../shared/components/control-messages.component';

/**
 * Con qué se entra a la cuenta: correo, contraseña y cuentas externas.
 *
 * Las tres cosas vivían separadas —los vínculos arriba, el correo al final de
 * la página y la contraseña entre medias— aunque respondan a la misma
 * pregunta. Reunirlas es además lo que permite subirlas juntas por encima del
 * perfil, que es lo que casi nadie vuelve a tocar.
 */
@Component({
  selector: 'app-access',
  templateUrl: './access.component.html',
  styleUrls: ['./access.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    IonList,
    IonItem,
    IonInput,
    IonLabel,
    IonButton,
    IonIcon,
  ],
})
export class AccessComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialLoginService);
  private readonly feedback = inject(FeedbackService);
  private readonly translate = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);
  private readonly builder = inject(FormBuilder);

  readonly user = input.required<User>();

  readonly changed = output<void>();

  readonly working = signal(false);
  readonly changingEmail = signal(false);

  readonly providers = [
    { value: AuthProvider.Google, label: 'Google', icon: 'logo-google' },
    { value: AuthProvider.Facebook, label: 'Facebook', icon: 'logo-facebook' },
  ];

  readonly emailForm = this.builder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /** Vínculo existente para cada proveedor, si lo hay. */
  readonly linkFor = computed(() => {
    const links = this.user().socialLinks;

    return (provider: AuthProvider) => links.find((link) => link.provider === provider) ?? null;
  });

  /**
   * Sólo las cuentas con contraseña la piden y la pueden cambiar.
   *
   * Quien entró con Google o Facebook no tiene ninguna, así que pedírsela para
   * cambiar el correo sería pedirle algo que no existe.
   */
  readonly hasPassword = computed(() => this.user().provider === AuthProvider.Password);

  constructor() {
    // `input.required` no tiene valor al construir; el efecto además recarga el
    // campo si cambia la cuenta que se está viendo.
    effect(() => {
      this.emailForm.patchValue({ email: this.user().email });
    });
  }

  /**
   * Pide el cambio de correo.
   *
   * La contraseña se pregunta aquí, al confirmar, y sólo a quien tiene una:
   * como campo del formulario estaba pedida de antemano y casi siempre vacía,
   * y a quien entró con Google le pedía algo que no existe.
   */
  async changeEmail(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();

      return;
    }

    const password = this.hasPassword() ? await this.askPassword() : null;

    // Cadena vacía significa que se cerró la ventana sin escribir nada.
    if (password === '') {
      return;
    }

    this.changingEmail.set(true);

    try {
      const { email } = this.emailForm.getRawValue();

      await this.users.requestEmailChange({ email, ...(password ? { password } : {}) });
      await this.feedback.toast('EMAIL_CHANGE_REQUESTED', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.changingEmail.set(false);
    }
  }

  /** La contraseña actual, en una ventana. Cadena vacía si se cancela. */
  private async askPassword(): Promise<string> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('CHANGE_EMAIL') as string,
      message: this.translate.instant('EMAIL_CHANGE_PASSWORD') as string,
      inputs: [
        {
          type: 'password',
          name: 'password',
          attributes: { autocomplete: 'current-password' },
          placeholder: this.translate.instant('CURRENT_PASSWORD') as string,
        },
      ],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ACCEPT') as string, role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: { password?: string } }>();

    return role === 'confirm' ? (data?.values.password ?? '') : '';
  }

  async toggleLink(provider: SocialProvider): Promise<void> {
    const existing = this.linkFor()(provider);

    this.working.set(true);

    try {
      if (existing) {
        await this.users.unlinkSocialAccount(existing.id);
        await this.social.signOut(provider);
      } else {
        // Entrar con el proveedor es lo que crea el vínculo: el servidor lo
        // asocia a la cuenta cuyo correo ya está verificado.
        await this.social.signIn(provider);
      }

      await this.auth.refreshUser();
      this.changed.emit();
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.working.set(false);
    }
  }

  /** Cambia la contraseña pidiendo la actual y la nueva. */
  async changePassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('CHANGE_PASSWORD') as string,
      inputs: [
        {
          type: 'password',
          name: 'currentPassword',
          placeholder: this.translate.instant('CURRENT_PASSWORD') as string,
        },
        {
          type: 'password',
          name: 'newPassword',
          placeholder: this.translate.instant('NEW_PASSWORD') as string,
        },
      ],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ACCEPT') as string, role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{
      values: { currentPassword?: string; newPassword?: string };
    }>();

    if (role !== 'confirm' || !data?.values.currentPassword || !data.values.newPassword) {
      return;
    }

    try {
      await this.auth.changePassword({
        currentPassword: data.values.currentPassword,
        newPassword: data.values.newPassword,
      });

      // Cambiar la contraseña revoca todas las sesiones, también la actual.
      await this.feedback.toast('PASSWORD_CHANGED_LOGIN_AGAIN', { color: 'success' });
      await this.router.navigateByUrl('/login');
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
