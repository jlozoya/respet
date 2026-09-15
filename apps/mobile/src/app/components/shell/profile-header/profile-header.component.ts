import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { PublicProfile } from '@respet/shared';

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/**
 * La ficha de una persona, encabezando su muro.
 *
 * Antes era una fila de lista con el avatar pequeño y las cifras en letra
 * menuda, indistinguible de una publicación más. Aquí ocupa lo que ocupa una
 * portada: una franja de color, el avatar grande montado encima, el nombre en
 * grande y, debajo, lo que se puede hacer con esa persona.
 *
 * No hay foto de portada que enseñar —el perfil no la tiene—, así que la
 * franja es un degradado; el día que exista, entra aquí sin tocar nada más.
 */
@Component({
  selector: 'app-profile-header',
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonButton, IonIcon],
})
export class ProfileHeaderComponent {
  readonly profile = input.required<PublicProfile>();
  /** Cierto cuando quien mira puede escribirle: hay sesión y no es él mismo. */
  readonly canMessage = input(false);
  /** Cierto en la ficha propia: allí no se sigue ni se escribe, se edita. */
  readonly isOwn = input(false);

  readonly followToggled = output<void>();
  readonly messageRequested = output<void>();

  readonly avatarUrl = computed(() => this.profile().avatar?.url ?? FALLBACK_AVATAR);

  /** Nulo significa «no hay a quién referirlo»: sin sesión, o en el propio perfil. */
  readonly canFollow = computed(() => this.profile().followedByMe !== null);

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_AVATAR;
  }
}
