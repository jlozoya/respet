import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { TranslateService } from '@ngx-translate/core';
import type { ReauthRequest } from '@social-network/shared';

import { ApiError } from '../api/api-error';
import { AuthService } from '../auth/auth.service';
import { FeedbackService } from './feedback.service';

/**
 * Confirmar la identidad antes de algo delicado.
 *
 * Borrar la cuenta, desactivar la verificación en dos pasos o sacar códigos de
 * recuperación nuevos piden demostrar que quien toca el teléfono es su dueño.
 * Si se inició sesión hace poco el servidor no lo exige; si no, responde
 * `SERVER.REAUTH_REQUIRED`. Este servicio prueba primero sin nada y, sólo si
 * hace falta, pregunta la contraseña —o el código de la app de autenticación,
 * en las cuentas que entraron con Google o Facebook— y repite.
 */
@Injectable({ providedIn: 'root' })
export class ReauthService {
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  /**
   * Ejecuta la operación, pidiendo la identidad si el servidor la exige.
   *
   * Devuelve `null` si la persona cancela.
   */
  async run<T>(operation: (reauth: ReauthRequest) => Promise<T>): Promise<T | null> {
    try {
      return await operation({});
    } catch (error) {
      if (!(error instanceof ApiError && error.is('SERVER.REAUTH_REQUIRED'))) {
        throw error;
      }
    }

    // Con una contraseña o un código equivocados se vuelve a preguntar, como
    // en cualquier pantalla de acceso.
    for (;;) {
      const reauth = await this.ask();

      if (!reauth) {
        return null;
      }

      try {
        return await operation(reauth);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.is('SERVER.INCORRECT_USER') || error.is('SERVER.INVALID_MFA_CODE'))
        ) {
          await this.feedback.error(error);
          continue;
        }

        throw error;
      }
    }
  }

  private async ask(): Promise<ReauthRequest | null> {
    const user = this.auth.user();
    const usesPassword = user?.provider === 'password';

    if (!usesPassword && !user?.mfaEnabled) {
      // Sin contraseña ni segundo factor la única prueba es haber entrado hace
      // poco: se ofrece volver a entrar.
      const again = await this.feedback.confirm({
        header: 'REAUTH.TITLE',
        message: 'REAUTH.LOGIN_AGAIN',
        confirmText: 'REAUTH.LOGIN_AGAIN_ACTION',
      });

      if (again) {
        await this.auth.logout();
      }

      return null;
    }

    const alert = await this.alertCtrl.create({
      header: this.t('REAUTH.TITLE'),
      message: this.t(usesPassword ? 'REAUTH.PASSWORD_MESSAGE' : 'REAUTH.CODE_MESSAGE'),
      inputs: [
        usesPassword
          ? {
              name: 'value',
              type: 'password',
              placeholder: this.t('PASSWORD'),
              attributes: { autocomplete: 'current-password' },
            }
          : {
              name: 'value',
              type: 'text',
              placeholder: '123456',
              attributes: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 12 },
            },
      ],
      buttons: [
        { text: this.t('CANCEL'), role: 'cancel' },
        { text: this.t('REAUTH.CONFIRM'), role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: { value?: string } }>();
    const value = data?.values.value?.trim();

    if (role !== 'confirm' || !value) {
      return null;
    }

    return usesPassword ? { password: value } : { code: value.replace(/\s+/g, '') };
  }

  private t(key: string): string {
    return this.translate.instant(key) as string;
  }
}
