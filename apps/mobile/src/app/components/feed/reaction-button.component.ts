import { ChangeDetectionStrategy, Component, type OnDestroy, computed, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { ReactionType } from '@respet/shared';

import { REACTIONS, reactionColor, reactionEmoji, reactionLabel } from '../../shared/utils/reactions';

/** Lo que tarda en abrirse el selector al pasar por encima o mantener pulsado. */
const OPEN_DELAY_MS = 450;

/**
 * El botón «Me gusta» con sus siete reacciones.
 *
 * Un toque pone o quita «Me gusta»; pasar por encima —o mantener pulsado en el
 * móvil— despliega la barra con las demás, que crecen al señalarlas como en
 * Facebook.
 */
@Component({
  selector: 'app-reaction-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon],
  host: {
    '(mouseenter)': 'scheduleOpen()',
    '(mouseleave)': 'scheduleClose()',
  },
  template: `
    @if (open()) {
      <div class="picker" role="menu" (mouseenter)="cancelClose()">
        @for (type of reactions; track type) {
          <button type="button" class="option" role="menuitem" [title]="label(type) | translate" (click)="choose(type, $event)">
            <span class="emoji">{{ emoji(type) }}</span>
          </button>
        }
      </div>
    }

    <button
      type="button"
      class="action"
      [style.color]="current() ? color() : null"
      (click)="toggle()"
      (touchstart)="pressStart()"
      (touchend)="pressEnd($event)"
      (contextmenu)="$event.preventDefault()"
    >
      @if (current(); as type) {
        @if (type === 'like') {
          <ion-icon name="thumbs-up" />
        } @else {
          <span class="chosen">{{ emoji(type) }}</span>
        }
        <span>{{ label(type) | translate }}</span>
      } @else {
        <ion-icon name="thumbs-up-outline" />
        <span>{{ 'REACTIONS.LIKE' | translate }}</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1 1 0;
      position: relative;
    }

    .action {
      align-items: center;
      background: none;
      border: 0;
      border-radius: 6px;
      color: var(--rs-text-2);
      cursor: pointer;
      display: flex;
      flex: 1 1 auto;
      font-size: 0.9375rem;
      font-weight: 600;
      gap: 6px;
      height: 40px;
      justify-content: center;
      -webkit-user-select: none;
      user-select: none;
    }

    .action:hover {
      background: var(--rs-hover);
    }

    .action ion-icon {
      font-size: 20px;
    }

    .chosen {
      font-size: 18px;
    }

    .picker {
      animation: pop 0.18s ease-out;
      background: var(--rs-surface);
      border-radius: 999px;
      bottom: 46px;
      box-shadow: var(--rs-shadow-2);
      display: flex;
      left: 0;
      padding: 4px 6px;
      position: absolute;
      z-index: 10;
    }

    .option {
      background: none;
      border: 0;
      cursor: pointer;
      padding: 2px;
      transition: transform 0.15s ease;
    }

    .option:hover {
      transform: translateY(-6px) scale(1.3);
    }

    .emoji {
      display: block;
      font-size: 2rem;
      line-height: 1;
    }

    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.9);
      }
    }
  `,
})
export class ReactionButtonComponent implements OnDestroy {
  readonly reaction = input<ReactionType | null>(null);
  readonly react = output<ReactionType | null>();

  readonly reactions = REACTIONS;
  readonly open = signal(false);

  readonly current = computed(() => this.reaction());
  readonly color = computed(() => {
    const type = this.current();

    return type ? reactionColor(type) : null;
  });

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressed = false;

  ngOnDestroy(): void {
    this.clearTimers();
  }

  emoji(type: ReactionType): string {
    return reactionEmoji(type);
  }

  label(type: ReactionType): string {
    return reactionLabel(type);
  }

  toggle(): void {
    this.open.set(false);
    this.react.emit(this.current() ? null : 'like');
  }

  choose(type: ReactionType, event: Event): void {
    event.stopPropagation();
    this.open.set(false);
    this.react.emit(type === this.current() ? null : type);
  }

  scheduleOpen(): void {
    if (window.matchMedia('(hover: none)').matches) {
      return;
    }

    this.cancelClose();
    this.openTimer ??= setTimeout(() => {
      this.open.set(true);
      this.openTimer = null;
    }, OPEN_DELAY_MS);
  }

  scheduleClose(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }

    this.closeTimer = setTimeout(() => this.open.set(false), 300);
  }

  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  pressStart(): void {
    this.longPressed = false;
    this.openTimer = setTimeout(() => {
      this.longPressed = true;
      this.open.set(true);
      this.openTimer = null;
    }, OPEN_DELAY_MS);
  }

  pressEnd(event: TouchEvent): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }

    if (this.longPressed) {
      // Soltar tras mantener pulsado deja la barra abierta: la reacción la
      // elige el toque siguiente, y este no cuenta como «Me gusta».
      event.preventDefault();
      this.longPressed = false;
    }
  }

  private clearTimers(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
  }
}
