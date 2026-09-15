import { Injectable, computed, inject } from '@angular/core';

import { ChatService } from '../api/chat.service';
import { OrdersService } from '../api/store.service';
import { AuthService } from '../auth/auth.service';

/** Entrada de navegación: un sitio al que se puede ir. */
export interface NavEntry {
  /** Clave de traducción del rótulo. */
  title: string;
  link: string;
  icon: string;
}

/**
 * Qué se puede visitar, según quién mire.
 *
 * Vivía dentro del componente raíz, cuando sólo lo usaba el menú lateral. Desde
 * que la portada enseña la misma navegación en una columna —como hace
 * Facebook—, dos sitios distintos necesitan la misma lista, y duplicarla sería
 * garantizar que un día dejen de coincidir.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly orders = inject(OrdersService);
  private readonly chat = inject(ChatService);

  /**
   * Lo que se puede visitar.
   *
   * El chat vivía en el grupo de la cuenta, entre los ajustes de privacidad,
   * cuando en realidad es un sitio al que se va, no algo que se configura.
   */
  readonly browsePages: readonly NavEntry[] = [
    { title: 'NAV.WALL', link: '/', icon: 'newspaper-outline' },
    { title: 'NAV.CHAT', link: '/chat', icon: 'chatbubbles-outline' },
  ];

  /*
    Una sola entrada: la configuración son pestañas de la cuenta, no otra
    pantalla, y dos enlaces al mismo sitio obligaban a adivinar cuál llevaba a
    qué.
  */
  readonly accountPages: readonly NavEntry[] = [
    { title: 'NAV.SETTINGS', link: '/account', icon: 'settings-outline' },
  ];

  private readonly staffPages: readonly NavEntry[] = [
    { title: 'NAV.ORDERS', link: '/orders', icon: 'cube-outline' },
  ];

  private readonly adminPages: readonly NavEntry[] = [
    { title: 'NAV.ANALYTICS', link: '/analytics', icon: 'analytics-outline' },
    { title: 'NAV.USERS', link: '/users', icon: 'people-circle-outline' },
    // Los avisos se leen en el muro; esto es el panel desde el que se
    // escriben, así que va con el resto de la administración.
    { title: 'NAV.BULLETINS', link: '/bulletins', icon: 'notifications-outline' },
  ];

  /** Páginas de gestión que corresponden al rol actual. */
  readonly managementPages = computed<readonly NavEntry[]>(() => {
    if (this.auth.isAdmin()) {
      return [...this.staffPages, ...this.adminPages];
    }

    return this.auth.isStaff() ? this.staffPages : [];
  });

  /**
   * Cierra la sesión y deja limpio lo que dependía de ella.
   *
   * Vive aquí, y no en `AuthService`, porque cerrar sesión es más que olvidar
   * el token: hay que vaciar el carrito y soltar el socket del chat. Y vive en
   * un solo sitio porque ahora se puede cerrar desde dos —el menú lateral y la
   * columna del muro—, y dos copias de esto acabarían diferenciándose.
   */
  async closeSession(): Promise<void> {
    this.orders.clearCart();
    this.chat.stop();
    await this.auth.logout();
  }
}
