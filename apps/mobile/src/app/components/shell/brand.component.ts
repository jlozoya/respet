import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * La marca: la huella en un círculo con el degradado y el nombre al lado.
 *
 * Dibujada en SVG en lugar de con una imagen para que se vea nítida a
 * cualquier tamaño y cambie con el tema sin tener dos versiones.
 */
@Component({
  selector: 'app-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="respet-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7931e" />
          <stop offset="0.55" stop-color="#f05a22" />
          <stop offset="1" stop-color="#e1306c" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#respet-brand)" />
      <ellipse cx="20" cy="25" rx="7" ry="6" fill="#fff" />
      <ellipse cx="11.5" cy="17" rx="3" ry="3.8" fill="#fff" />
      <ellipse cx="17" cy="11.5" rx="3" ry="3.8" fill="#fff" />
      <ellipse cx="23" cy="11.5" rx="3" ry="3.8" fill="#fff" />
      <ellipse cx="28.5" cy="17" rx="3" ry="3.8" fill="#fff" />
    </svg>
    @if (wordmark()) {
      <span class="word">respet</span>
    }
  `,
  styles: `
    :host {
      align-items: center;
      display: inline-flex;
      gap: 8px;
    }

    .mark {
      display: block;
      height: 40px;
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
  readonly wordmark = input(false);
}
