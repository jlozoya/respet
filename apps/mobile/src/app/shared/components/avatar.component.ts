import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Media } from '@social-network/shared';

interface AvatarUser {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  avatar?: Pick<Media, 'url'> | null;
}

/** Colores de fondo para las iniciales, elegidos por el id para que no cambien. */
const PALETTE = ['#f05a22', '#1877f2', '#31a24c', '#8a3ab9', '#e1306c', '#14a697', '#d99a00', '#e9710f'];

/**
 * La foto de una persona, en un círculo.
 *
 * Sin foto pinta sus iniciales sobre un color fijo para esa persona, como
 * Messenger, en lugar de la silueta gris de siempre. Con `ring` rodea el
 * círculo con el degradado de las historias —vivo si hay alguna sin ver, gris
 * si ya se vieron, rojo si está en directo— y con `online` añade el punto
 * verde de conectado.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--size.px]': 'size()',
    '[class.ring-unseen]': "ring() === 'unseen'",
    '[class.ring-seen]': "ring() === 'seen'",
    '[class.ring-live]': "ring() === 'live'",
  },
  template: `
    <span class="frame">
      @if (url(); as src) {
        <img class="rs-avatar" [src]="src" [alt]="alt()" loading="lazy" decoding="async" />
      } @else {
        <span class="rs-avatar initials" [style.background]="color()" role="img" [attr.aria-label]="alt()">
          {{ initials() }}
        </span>
      }
    </span>
    @if (online()) {
      <span class="rs-online-dot"></span>
    }
  `,
  styles: `
    :host {
      --size: 40px;
      display: inline-flex;
      flex: 0 0 auto;
      height: var(--size);
      position: relative;
      width: var(--size);
    }

    .frame {
      border-radius: 50%;
      display: block;
      height: 100%;
      width: 100%;
    }

    .rs-avatar {
      --size: 100%;
      height: 100%;
      width: 100%;
    }

    .initials {
      align-items: center;
      color: #fff;
      display: flex;
      font-weight: 700;
      justify-content: center;
      text-transform: uppercase;
    }

    :host(.ring-unseen) .frame,
    :host(.ring-seen) .frame,
    :host(.ring-live) .frame {
      background: var(--rs-story-ring);
      padding: 2px;
    }

    :host(.ring-seen) .frame {
      background: var(--rs-divider);
    }

    :host(.ring-live) .frame {
      background: var(--rs-live);
    }

    :host(.ring-unseen) .rs-avatar,
    :host(.ring-seen) .rs-avatar,
    :host(.ring-live) .rs-avatar {
      border: 2px solid var(--rs-surface);
    }
  `,
})
export class AvatarComponent {
  readonly user = input<AvatarUser | null | undefined>(null);
  /** Una foto suelta, para lo que no es una persona: un grupo, una aplicación. */
  readonly src = input<string | null | undefined>(null);
  /** Nombre para las iniciales cuando no hay persona. */
  readonly label = input<string | null>(null);
  readonly size = input(40);
  readonly ring = input<'none' | 'unseen' | 'seen' | 'live'>('none');
  readonly online = input(false);

  readonly url = computed(() => this.src() ?? this.user()?.avatar?.url ?? null);

  readonly alt = computed(() => {
    const user = this.user();

    return this.label() ?? ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || '');
  });

  readonly initials = computed(() => {
    const user = this.user();
    const words = user
      ? [user.firstName, user.lastName].filter((part): part is string => !!part)
      : (this.label() ?? '').split(/\s+/).slice(0, 2);
    const letters = words.map((part) => part.charAt(0)).join('') || (user?.name?.charAt(0) ?? '');

    return letters.slice(0, 2) || '?';
  });

  readonly color = computed(() => {
    const seed = this.user()?.id ?? this.label() ?? '';
    let hash = 0;

    for (const char of seed) {
      hash = (hash * 31 + char.charCodeAt(0)) | 0;
    }

    return PALETTE[Math.abs(hash) % PALETTE.length];
  });
}
