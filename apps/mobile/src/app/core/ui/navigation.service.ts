import { Injectable, computed, inject } from '@angular/core';

import { ChatService } from '../api/chat.service';
import { NotificationsService } from '../api/notifications.service';
import { OrdersService } from '../api/store.service';
import { StoriesService } from '../api/stories.service';
import { AuthService } from '../auth/auth.service';
import { PushService } from '../push/push.service';
import { PresenceService } from '../realtime/presence.service';
import { RealtimeService } from '../realtime/realtime.service';

/** Un sitio al que se puede ir desde los menús. */
export interface NavEntry {
  /** Clave de traducción del rótulo. */
  title: string;
  link: string;
  icon: string;
  /** Color del icono, como los atajos de colores de Facebook. */
  color?: string;
  badge?: number;
}

/**
 * Qué se puede visitar, según quién mire, y cómo se sale.
 *
 * La misma lista la pintan la columna izquierda del escritorio, el menú del
 * móvil y el desplegable de la cuenta: vive aquí para que no dejen de
 * coincidir.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly notifications = inject(NotificationsService);
  private readonly orders = inject(OrdersService);
  private readonly stories = inject(StoriesService);
  private readonly realtime = inject(RealtimeService);
  private readonly push = inject(PushService);
  private readonly presence = inject(PresenceService);

  /** Los atajos de siempre: lo social primero y luego la tienda y las herramientas. */
  readonly shortcuts = computed<NavEntry[]>(() => {
    const user = this.auth.user();
    const entries: NavEntry[] = [
      { title: 'NAV.MESSAGES', link: '/messages', icon: 'chatbubble-ellipses', color: '#0a7cff', badge: this.chat.unreadConversations() },
      { title: 'NAV.NOTIFICATIONS', link: '/notifications', icon: 'notifications', color: '#f05a22', badge: this.notifications.unreadCount() },
      { title: 'NAV.EXPLORE', link: '/explore', icon: 'compass', color: '#14a697' },
      { title: 'NAV.LIVE', link: '/live', icon: 'videocam', color: '#e41e3f' },
      { title: 'NAV.SAVED', link: '/saved', icon: 'bookmark', color: '#8a3ab9' },
      { title: 'NAV.STORY_ARCHIVE', link: '/stories/archive', icon: 'time', color: '#1877f2' },
    ];

    if (user?.permissions?.privateProfile) {
      entries.push({ title: 'NAV.FOLLOW_REQUESTS', link: '/follow-requests', icon: 'person-add', color: '#31a24c' });
    }

    entries.push(
      { title: 'NAV.STORE', link: '/products', icon: 'storefront', color: '#e9710f' },
      { title: 'NAV.CART', link: '/cart', icon: 'cart', color: '#d99a00', badge: this.orders.itemCount() },
      { title: 'NAV.ORDERS', link: '/orders', icon: 'cube', color: '#65676b' },
      { title: 'NAV.DEVELOPERS', link: '/developers', icon: 'code-slash', color: '#1c1e21' },
    );

    return entries;
  });

  /** Lo de gestión que corresponde al rol. */
  readonly management = computed<NavEntry[]>(() => {
    const entries: NavEntry[] = [];

    if (this.auth.isAdmin()) {
      entries.push(
        { title: 'NAV.MODERATION', link: '/admin/reports', icon: 'shield-half', color: '#e41e3f' },
        { title: 'NAV.ANALYTICS', link: '/analytics', icon: 'analytics', color: '#1877f2' },
        { title: 'NAV.USERS', link: '/users', icon: 'people-circle', color: '#31a24c' },
        { title: 'NAV.BULLETINS', link: '/bulletins', icon: 'megaphone', color: '#f05a22' },
        { title: 'NAV.WAREHOUSES', link: '/warehouses', icon: 'business', color: '#65676b' },
      );
    }

    return entries;
  });

  /**
   * Arranca lo que depende de la sesión: la conexión en tiempo real, el chat,
   * los avisos, las historias y las notificaciones push.
   */
  startSession(): void {
    this.realtime.start();
    this.chat.start();
    this.notifications.start();
    void this.presence.start();
    void this.stories.loadFeed().catch(() => undefined);
    void this.orders.loadCart().catch(() => undefined);
    void this.push.start();
  }

  /** Suelta todo lo anterior, cuando la sesión se cierra por la razón que sea. */
  stopSession(): void {
    this.chat.stop();
    this.notifications.stop();
    this.presence.stop();
    this.stories.reset();
    this.orders.clearCart();
    this.realtime.stop();
  }

  /** Cierra la sesión a petición de quien la usa. */
  async closeSession(options: { everywhere?: boolean } = {}): Promise<void> {
    await this.push.stop();
    this.stopSession();
    await this.auth.logout(options);
  }
}
