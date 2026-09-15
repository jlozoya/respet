import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { LoadingController } from '@ionic/angular/loading-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { TranslateService } from '@ngx-translate/core';

import { ApiError } from '../api/api-error';

/**
 * Avisos al usuario: mensajes, indicadores de carga y confirmaciones.
 *
 * En el proyecto anterior cada componente repetía el mismo bloque de seis
 * líneas para crear un toast, y traducía a mano cada mensaje. Aquí eso vive en
 * un sitio, y `error()` sabe además sacar la clave traducible de un `ApiError`,
 * de modo que un fallo del servidor se muestra en el idioma del usuario sin
 * que la pantalla tenga que interpretarlo.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  /** Mensaje breve en la parte inferior. */
  async toast(key: string, options: { duration?: number; color?: string } = {}): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(key) as string,
      duration: options.duration ?? 3000,
      color: options.color,
      position: 'bottom',
      buttons: [{ role: 'cancel', icon: 'close-circle-outline' }],
    });

    await toast.present();
  }

  success(key = 'FORM.SUCCESS'): Promise<void> {
    return this.toast(key, { color: 'success' });
  }

  /**
   * Enseña un error.
   *
   * Con un `ApiError` usa su `code`, que ya es una clave de traducción; con
   * cualquier otra cosa recurre a un mensaje genérico, porque un fallo interno
   * de JavaScript no le dice nada útil a quien está usando la aplicación.
   */
  async error(cause: unknown, fallback = 'FORM.ERROR'): Promise<void> {
    await this.toast(this.messageKeyOf(cause, fallback), { color: 'danger', duration: 5000 });
  }

  messageKeyOf(cause: unknown, fallback = 'FORM.ERROR'): string {
    if (!(cause instanceof ApiError)) {
      return fallback;
    }

    // Si no existe traducción para la clave, `instant` devuelve la clave tal
    // cual; en ese caso vale más el mensaje genérico que un texto en bruto.
    const translated = this.translate.instant(cause.code) as string;

    return translated === cause.code ? fallback : cause.code;
  }

  /**
   * Ejecuta una operación mostrando un indicador de carga.
   *
   * El indicador se cierra pase lo que pase, que es justo lo que se olvidaba
   * en las ramas de error del código anterior y dejaba la pantalla bloqueada.
   */
  async withLoading<T>(operation: () => Promise<T>, messageKey = 'LOADING'): Promise<T> {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant(messageKey) as string,
    });

    await loading.present();

    try {
      return await operation();
    } finally {
      await loading.dismiss();
    }
  }

  /** Pide confirmación antes de una acción destructiva. */
  async confirm(options: {
    header: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      void this.alertCtrl
        .create({
          header: this.translate.instant(options.header) as string,
          message: this.translate.instant(options.message) as string,
          buttons: [
            {
              text: this.translate.instant(options.cancelText ?? 'CANCEL') as string,
              role: 'cancel',
              handler: () => resolve(false),
            },
            {
              text: this.translate.instant(options.confirmText ?? 'ACCEPT') as string,
              role: options.danger ? 'destructive' : 'confirm',
              handler: () => resolve(true),
            },
          ],
        })
        .then((alert) => alert.present());
    });
  }
}
