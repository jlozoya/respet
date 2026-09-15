import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { ChatService } from '../../../core/api/chat.service';
import { AuthService } from '../../../core/auth/auth.service';
import { NavigationService } from '../../../core/ui/navigation.service';

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/**
 * La navegación de la aplicación: a dónde se puede ir.
 *
 * Es el contenido del menú, y por tanto el único sitio donde se escriben las
 * entradas. En una pantalla ancha el panel que la contiene se queda fijo al
 * lado del contenido —siempre a la vista, como en cualquier red social de
 * escritorio— y en una estrecha se abre por encima; lo que se ve es lo mismo
 * en los dos casos.
 */
@Component({
  selector: 'app-nav-rail',
  templateUrl: './nav-rail.component.html',
  styleUrls: ['./nav-rail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IonIcon, IonBadge],
})
export class NavRailComponent {
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  private readonly chat = inject(ChatService);

  readonly user = this.auth.user;
  readonly unreadMessages = this.chat.unreadCount;

  readonly browsePages = this.navigation.browsePages;
  readonly managementPages = this.navigation.managementPages;
  readonly accountPages = this.navigation.accountPages;

  readonly avatarUrl = computed(() => this.user()?.avatar?.url ?? FALLBACK_AVATAR);

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_AVATAR;
  }

  /** Cierra la sesión, igual que la entrada equivalente del menú lateral. */
  async logout(): Promise<void> {
    await this.navigation.closeSession();
  }

  /** Cuántos avisos lleva una entrada, si lleva alguno. */
  /** La única cifra que se enseña en la columna es la de mensajes sin leer. */
  badgeOf(link: string): number {
    return link === '/chat' ? this.unreadMessages() : 0;
  }
}
