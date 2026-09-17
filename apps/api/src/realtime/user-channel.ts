import type { ChatEvent, NotificationEvent } from '@respet/shared';

/**
 * Lo que viaja por el tema privado de cada persona.
 *
 * El chat, las notificaciones y los avisos de la cuenta comparten tema —cada
 * conexión escucha uno solo por persona— y se distinguen por el canal. Cada
 * suscripción de GraphQL se queda con el suyo.
 */
export type UserChannelMessage =
  | { channel: 'chat'; event: ChatEvent }
  | { channel: 'notification'; event: NotificationEvent }
  | { channel: 'account'; event: AccountEvent };

/** Algo que ha cambiado en la propia cuenta y que los otros dispositivos deben saber. */
export interface AccountEvent {
  type: 'profile_updated' | 'session_revoked';
  sessionId: string | null;
}
