import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type Token } from '@capacitor/push-notifications';

import { NotificationsService } from '../api/notifications.service';

/**
 * Notificaciones push del móvil.
 *
 * Registra el dispositivo en Firebase Cloud Messaging y le da el token al
 * servidor, que es quien decide cuándo avisar: un mensaje a quien no está
 * conectado, una reacción, un directo que empieza.
 *
 * En el navegador no hace nada; ahí los avisos llegan por la suscripción
 * mientras la pestaña está abierta.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private token: string | null = null;
  private listening = false;

  private readonly permissionSignal = signal<'granted' | 'denied' | 'prompt' | 'unsupported'>(
    Capacitor.isNativePlatform() ? 'prompt' : 'unsupported',
  );

  readonly permission = this.permissionSignal.asReadonly();
  readonly supported = Capacitor.isNativePlatform();

  /** Pide permiso si hace falta y registra el dispositivo. */
  async start(): Promise<void> {
    if (!this.supported) {
      return;
    }

    try {
      this.listen();

      let status = await PushNotifications.checkPermissions();

      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions();
      }

      this.permissionSignal.set(status.receive === 'granted' ? 'granted' : 'denied');

      if (status.receive === 'granted') {
        await PushNotifications.register();
      }
    } catch (error) {
      // Sin `google-services.json` el registro falla; la app sigue sin push.
      console.warn('No se pudieron activar las notificaciones push', error);
    }
  }

  /** Da de baja el dispositivo al cerrar sesión, para no avisar a quien ya salió. */
  async stop(): Promise<void> {
    if (!this.supported || !this.token) {
      return;
    }

    const token = this.token;
    this.token = null;

    await this.notifications.unregisterPushDevice(token).catch(() => undefined);
    await PushNotifications.unregister().catch(() => undefined);
  }

  private listen(): void {
    if (this.listening) {
      return;
    }

    this.listening = true;

    void PushNotifications.addListener('registration', (token: Token) => {
      this.token = token.value;
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      void this.notifications.registerPushDevice(token.value, platform).catch(() => undefined);
    });

    void PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const link = linkOf(action.notification.data as Record<string, string> | undefined);
      this.zone.run(() => void this.router.navigateByUrl(link));
    });
  }
}

/** Adónde lleva tocar una notificación push, según lo que traiga. */
function linkOf(data: Record<string, string> | undefined): string {
  if (!data) {
    return '/notifications';
  }

  if (data['conversationId']) {
    return `/messages/${data['conversationId']}`;
  }

  if (data['liveStreamId']) {
    return `/live/${data['liveStreamId']}`;
  }

  if (data['postId']) {
    return `/post/${data['postId']}`;
  }

  if (data['type'] === 'follow_request') {
    return '/follow-requests';
  }

  if (data['type'] === 'security_alert') {
    return '/settings/security';
  }

  return '/notifications';
}
