import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { BrandingService } from '../../core/branding/branding.service';

/**
 * La marca: el logotipo de la instalación y, si se pide, su nombre al lado.
 *
 * Con `APP_LOGO_URL` configurado se pinta esa imagen. Sin ella se dibuja una
 * marca genérica —la inicial del nombre sobre el degradado— que sirve para
 * cualquier nombre y cambia sola con los colores: así una instalación recién
 * levantada, sin logotipo propio, no se ve a medio hacer.
 */
@Component({
  selector: 'app-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (logo(); as url) {
      <img class="logo" [src]="url" [alt]="name()" />
    } @else {
      <span class="mark" aria-hidden="true">{{ initial() }}</span>
    }

    @if (wordmark()) {
      <span class="word">{{ name() }}</span>
    }
  `,
  styles: `
    :host {
      align-items: center;
      display: inline-flex;
      gap: 8px;
    }

    .logo {
      display: block;
      height: 40px;
      object-fit: contain;
      max-width: 160px;
      width: auto;
    }

    .mark {
      align-items: center;
      background: var(--rs-brand-gradient);
      border-radius: 50%;
      color: #fff;
      display: flex;
      font-size: 1.35rem;
      font-weight: 800;
      height: 40px;
      justify-content: center;
      line-height: 1;
      width: 40px;
    }

    .word {
      background: var(--rs-brand-gradient);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1;
    }
  `,
})
export class BrandComponent {
  private readonly branding = inject(BrandingService);

  readonly wordmark = input(false);

  readonly name = this.branding.name;
  readonly logo = computed(() => this.branding.branding().logoUrl);
  readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '·');
}
