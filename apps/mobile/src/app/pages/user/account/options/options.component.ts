import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthProvider, type User } from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { SocialLoginService, type SocialProvider } from '../../../../core/auth/social-login.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';

/** Acciones de la cuenta: contraseña, vínculos externos y baja. */
@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonList, IonItem, IonLabel, IonButton, IonIcon],
})
export class OptionsComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialLoginService);
  private readonly feedback = inject(FeedbackService);
  private readonly translate = inject(TranslateService);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);

  readonly user = input.required<User>();
  readonly isSelf = input(true);

  readonly changed = output<void>();

  readonly working = signal(false);

  readonly providers = [
    { value: AuthProvider.Google, label: 'Google', icon: 'logo-google' },
    { value: AuthProvider.Facebook, label: 'Facebook', icon: 'logo-facebook' },
  ];

  /** Vínculo existente para cada proveedor, si lo hay. */
  readonly linkFor = computed(() => {
    const links = this.user().socialLinks;

    return (provider: AuthProvider) => links.find((link) => link.provider === provider) ?? null;
  });

  /** Sólo las cuentas con contraseña pueden cambiarla. */
  readonly hasPassword = computed(() => this.user().provider === AuthProvider.Password);

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

  async deleteAccount(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_ACCOUNT.TITLE',
      message: 'ALERTS.DELETE_ACCOUNT.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      if (this.isSelf()) {
        await this.users.deleteMyAccount();
        await this.auth.logout();
      } else {
        await this.users.remove(this.user().id);
        await this.router.navigateByUrl('/users');
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  /** Descarga los datos del perfil en un archivo JSON. */
  downloadMyInfo(): void {
    const blob = new Blob([JSON.stringify(this.user(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `respet-${this.user().id}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  }
}
