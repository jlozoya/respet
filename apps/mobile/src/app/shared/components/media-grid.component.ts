import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import type { Media } from '@social-network/shared';

import { DurationPipe } from '../pipes/duration.pipe';
import { MediaViewerComponent } from './media-viewer.component';

/** Cuántas casillas se enseñan como mucho; el resto va en un «+N». */
const MAX_TILES = 5;

/**
 * Las fotos y vídeos de una publicación, repartidos como en Facebook.
 *
 * Una sola ocupa todo el ancho con su proporción; dos van lado a lado; tres,
 * una grande y dos pequeñas; cuatro o más, en cuadrícula con un «+N» en la
 * última. Tocar cualquiera abre el visor a pantalla completa en esa misma.
 */
@Component({
  selector: 'app-media-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, DurationPipe],
  host: { '[attr.data-count]': 'tiles().length' },
  template: `
    @for (item of tiles(); track item.id; let index = $index) {
      <button
        type="button"
        class="tile"
        [class.single]="tiles().length === 1"
        [style.aspect-ratio]="tiles().length === 1 ? ratio() : null"
        (click)="open(index, $event)"
      >
        @if (item.type === 'video') {
          @if (item.posterUrl) {
            <img [src]="item.posterUrl" [alt]="item.alt" loading="lazy" />
          } @else {
            <video [src]="item.url" preload="metadata" muted playsinline></video>
          }
          <span class="play"><ion-icon name="play" /></span>
          @if (item.durationMs) {
            <span class="duration">{{ item.durationMs | duration }}</span>
          }
        } @else {
          <img [src]="item.url" [alt]="item.alt" loading="lazy" decoding="async" />
        }

        @if (index === tiles().length - 1 && hidden() > 0) {
          <span class="more">+{{ hidden() }}</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 2px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: hidden;
    }

    :host([data-count='1']) {
      grid-template-columns: 1fr;
    }

    :host([data-count='3']) .tile:first-child {
      grid-column: span 2;
    }

    :host([data-count='5']) {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    :host([data-count='5']) .tile:nth-child(-n + 2) {
      grid-column: span 3;
    }

    :host([data-count='5']) .tile:nth-child(n + 3) {
      grid-column: span 2;
    }

    .tile {
      aspect-ratio: 1;
      background: var(--rs-skeleton);
      border: 0;
      cursor: pointer;
      overflow: hidden;
      padding: 0;
      position: relative;
    }

    :host([data-count='3']) .tile:first-child {
      aspect-ratio: 2;
    }

    .tile.single {
      max-height: 680px;
    }

    img,
    video {
      display: block;
      height: 100%;
      object-fit: cover;
      width: 100%;
    }

    .play {
      align-items: center;
      background: rgb(0 0 0 / 55%);
      border: 3px solid #fff;
      border-radius: 50%;
      color: #fff;
      display: flex;
      font-size: 28px;
      height: 60px;
      justify-content: center;
      left: 50%;
      padding-left: 4px;
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
    }

    .duration {
      background: rgb(0 0 0 / 60%);
      border-radius: 4px;
      bottom: 8px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      position: absolute;
      right: 8px;
    }

    .more {
      align-items: center;
      background: rgb(0 0 0 / 45%);
      color: #fff;
      display: flex;
      font-size: 2rem;
      font-weight: 700;
      inset: 0;
      justify-content: center;
      position: absolute;
    }
  `,
})
export class MediaGridComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly media = input.required<readonly Media[]>();

  readonly tiles = computed(() => this.media().slice(0, MAX_TILES));
  readonly hidden = computed(() => Math.max(0, this.media().length - MAX_TILES));

  /**
   * La proporción de una foto suelta, acotada.
   *
   * Una panorámica muy ancha quedaría en una tira y una foto muy alta ocuparía
   * tres pantallas: se deja entre 16:9 apaisado y 4:5 vertical, como Instagram.
   */
  readonly ratio = computed(() => {
    const first = this.media()[0];

    if (!first?.width || !first.height) {
      return '4 / 3';
    }

    const value = Math.min(16 / 9, Math.max(4 / 5, first.width / first.height));

    return String(value);
  });

  async open(index: number, event: Event): Promise<void> {
    event.stopPropagation();

    const modal = await this.modalCtrl.create({
      component: MediaViewerComponent,
      componentProps: { media: this.media(), start: index },
      cssClass: 'rs-fullscreen',
    });

    await modal.present();
  }
}
