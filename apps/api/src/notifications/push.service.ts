import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GoogleAuth } from 'google-auth-library';

import type { Model } from '../database/mongoose.js';
import { PushDevice } from '../database/schemas/notification.schema.js';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Datos para la app: a dónde llevar al pulsar la notificación. */
  data?: Record<string, string>;
  /** Agrupa las notificaciones del mismo hilo en el móvil. */
  tag?: string;
}

/**
 * Notificaciones push con Firebase Cloud Messaging.
 *
 * Es opcional: sin `FIREBASE_SERVICE_ACCOUNT` no hace nada y la aplicación
 * sigue enterándose de todo en cuanto se abre, por las suscripciones. Con la
 * cuenta de servicio, lo que pasa mientras está cerrada llega al móvil.
 *
 * Usa la API HTTP v1 directamente con `google-auth-library`, que ya estaba en
 * el proyecto para verificar los inicios de sesión con Google, en lugar de
 * traer el SDK de administración entero para una sola llamada.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly account?: ServiceAccount;
  private readonly auth?: GoogleAuth;

  constructor(
    config: ConfigService,
    @InjectModel(PushDevice.name) private readonly devices: Model<PushDevice>,
  ) {
    const raw = config.get<string>('push.firebaseServiceAccount');

    if (!raw) {
      return;
    }

    try {
      const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      this.account = JSON.parse(json) as ServiceAccount;
      this.auth = new GoogleAuth({
        credentials: { client_email: this.account.client_email, private_key: this.account.private_key },
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
    } catch (error) {
      this.logger.error(`FIREBASE_SERVICE_ACCOUNT no es válida: ${String(error)}`);
    }
  }

  get enabled(): boolean {
    return this.auth !== undefined;
  }

  async register(userId: string, token: string, platform: string, sessionId: string | null): Promise<void> {
    // Un mismo token pasa a quien inicie sesión después en ese dispositivo.
    await this.devices.updateOne(
      { token },
      { $set: { userId, platform, sessionId } },
      { upsert: true },
    );
  }

  async unregister(token: string): Promise<void> {
    await this.devices.deleteOne({ token });
  }

  /** Envía a todos los dispositivos de esas personas. Nunca falla. */
  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    if (!this.auth || !this.account || userIds.length === 0) {
      return;
    }

    try {
      const devices = await this.devices.find({ userId: { $in: userIds } }).select('token').lean();

      if (devices.length === 0) {
        return;
      }

      const client = await this.auth.getClient();
      const { token: accessToken } = await client.getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`;

      await Promise.all(
        devices.map(async (device) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: device.token,
                notification: { title: message.title, body: message.body },
                data: message.data ?? {},
                android: { notification: { tag: message.tag, click_action: 'FCM_PLUGIN_ACTIVITY' } },
                apns: { payload: { aps: { 'thread-id': message.tag } } },
              },
            }),
            signal: AbortSignal.timeout(10_000),
          });

          // Un token que FCM ya no reconoce es un dispositivo desinstalado:
          // se olvida para no seguir intentándolo.
          if (response.status === 404 || response.status === 400) {
            await this.devices.deleteOne({ token: device.token });
          }
        }),
      );
    } catch (error) {
      this.logger.warn(`No se pudo enviar una notificación push: ${String(error)}`);
    }
  }
}
