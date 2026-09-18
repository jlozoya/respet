import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import type { Media } from '@social-network/shared';

/**
 * Visor de fotos y vídeos a pantalla completa.
 *
 * Fondo negro, flechas a los lados en el escritorio, deslizar en el móvil y
 * las teclas de dirección y Escape, como el visor de Facebook.
 */
@Component({
  selector: 'app-media-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon],
  template: `
    <ion-content [fullscreen]="true" class="viewer">
      <div class="stage" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
        @if (current(); as item) {
          @switch (item.type) {
            @case ('video') {
              <video
                [src]="item.url"
                [poster]="item.posterUrl ?? ''"
                controls
                autoplay
                playsinline
              ></video>
            }
            @case ('audio') {
              <audio [src]="item.url" controls autoplay></audio>
            }
            @default {
              <img [src]="item.url" [alt]="item.alt" />
            }
          }
        }
      </div>

      <button type="button" class="control close" (click)="close()" aria-label="Cerrar">
        <ion-icon name="close" />
      </button>

      @if (media().length > 1) {
        <button
          type="button"
          class="control prev"
          [disabled]="index() === 0"
          (click)="go(-1)"
          aria-label="Anterior"
        >
          <ion-icon name="chevron-back" />
        </button>
        <button
          type="button"
          class="control next"
          [disabled]="index() === media().length - 1"
          (click)="go(1)"
          aria-label="Siguiente"
        >
          <ion-icon name="chevron-forward" />
        </button>
        <span class="counter">{{ index() + 1 }} / {{ media().length }}</span>
      }
    </ion-content>
  `,
  styles: `
    .viewer {
      --background: #000;
    }

    .stage {
      align-items: center;
      display: flex;
      height: 100%;
      justify-content: center;
      width: 100%;
    }

    img,
    video {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }

    .control {
      align-items: center;
      background: rgb(255 255 255 / 12%);
      border: 0;
      border-radius: 50%;
      color: #fff;
      cursor: pointer;
      display: flex;
      font-size: 26px;
      height: 48px;
      justify-content: center;
      position: absolute;
      width: 48px;
    }

    .control:hover {
      background: rgb(255 255 255 / 22%);
    }

    .control:disabled {
      opacity: 0.3;
    }

    .close {
      right: 16px;
      top: calc(16px + var(--ion-safe-area-top, 0px));
    }

    .prev,
    .next {
      top: 50%;
      transform: translateY(-50%);
    }

    .prev {
      left: 16px;
    }

    .next {
      right: 16px;
    }

    .counter {
      bottom: calc(20px + var(--ion-safe-area-bottom, 0px));
      color: #fff;
      font-size: 14px;
      left: 50%;
      position: absolute;
      transform: translateX(-50%);
    }

    @media (max-width: 767.98px) {
      .prev,
      .next {
        display: none;
      }
    }
  `,
})
export class MediaViewerComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly media = input.required<readonly Media[]>();
  readonly start = input(0);

  private readonly offset = signal<number | null>(null);
  private touchX = 0;

  readonly index = computed(() => this.offset() ?? this.start());
  readonly current = computed(() => this.media()[this.index()] ?? null);

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.go(-1);
    } else if (event.key === 'ArrowRight') {
      this.go(1);
    }
  }

  go(step: number): void {
    const next = Math.min(this.media().length - 1, Math.max(0, this.index() + step));
    this.offset.set(next);
  }

  touchStart(event: TouchEvent): void {
    this.touchX = event.changedTouches[0]?.clientX ?? 0;
  }

  touchEnd(event: TouchEvent): void {
    const delta = (event.changedTouches[0]?.clientX ?? 0) - this.touchX;

    if (Math.abs(delta) > 50) {
      this.go(delta < 0 ? 1 : -1);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
