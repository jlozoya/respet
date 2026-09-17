import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Claves guardadas en el dispositivo.
 *
 * Se agrupan aquí para que sea evidente de un vistazo qué persiste la
 * aplicación; el prefijo evita chocar con lo que guarde cualquier otra cosa
 * servida desde el mismo origen en la versión web.
 */
export const StorageKey = {
  AccessToken: 'respet.accessToken',
  RefreshToken: 'respet.refreshToken',
  SessionId: 'respet.sessionId',
  User: 'respet.user',
  /**
   * El token del dispositivo de confianza de cada cuenta, por correo.
   *
   * Sobrevive al cierre de sesión a propósito: es justo lo que evita que se
   * vuelva a pedir el código al entrar otra vez en este dispositivo.
   */
  TrustedDevices: 'respet.trustedDevices',
  Language: 'respet.language',
  Theme: 'respet.theme',
  HasSeenTutorial: 'respet.hasSeenTutorial',
  CartOrderId: 'respet.cartOrderId',
  /** Mensajes del chat que aún no han llegado al servidor. */
  ChatOutbox: 'respet.chatOutbox',
  /** Borradores de lo que se estaba escribiendo en cada conversación. */
  ChatDrafts: 'respet.chatDrafts',
  RecentSearches: 'respet.recentSearches',
} as const;

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

/**
 * Almacenamiento persistente del dispositivo.
 *
 * `Preferences` de Capacitor usa el almacén nativo de cada plataforma
 * —`SharedPreferences` en Android, `UserDefaults` en iOS y `localStorage` en la
 * web— sin dependencias extra.
 *
 * Todo se serializa a JSON, así que los valores deben ser serializables.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get<T>(key: StorageKey): Promise<T | null> {
    const { value } = await Preferences.get({ key });

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      // Un valor corrupto —por ejemplo de una versión anterior de la app— no
      // debe romper el arranque: se descarta y se sigue como si no existiera.
      await this.remove(key);

      return null;
    }
  }

  async set(key: StorageKey, value: unknown): Promise<void> {
    if (value === undefined || value === null) {
      await this.remove(key);

      return;
    }

    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: StorageKey): Promise<void> {
    await Preferences.remove({ key });
  }

  /** Borra todo lo de la sesión, dejando las preferencias del dispositivo. */
  async clearSession(): Promise<void> {
    await Promise.all([
      this.remove(StorageKey.AccessToken),
      this.remove(StorageKey.RefreshToken),
      this.remove(StorageKey.SessionId),
      this.remove(StorageKey.User),
      this.remove(StorageKey.CartOrderId),
      this.remove(StorageKey.ChatOutbox),
      this.remove(StorageKey.ChatDrafts),
    ]);
  }
}
