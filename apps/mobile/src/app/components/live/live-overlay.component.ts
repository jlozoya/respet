import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterRenderEffect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { LiveComment } from '@social-network/shared';

import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/** Una reacción flotando hacia arriba. */
export interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
}

export const LIVE_REACTIONS = ['❤️', '👍', '😂', '😮', '👏', '🔥'];

/**
 * Lo que va encima del vídeo de un directo: los comentarios que suben, las
 * reacciones que flotan y la caja para escribir, como en Instagram Live.
 */
@Component({
  selector: 'app-live-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, AvatarComponent, FullNamePipe],
  template: `
    <div class="floating" aria-hidden="true">
      @for (reaction of reactions(); track reaction.id) {
        <span class="float" [style.left.%]="reaction.left">{{ reaction.emoji }}</span>
      }
    </div>

    <div class="comments" #list>
      @for (comment of comments(); track comment.id) {
        <div class="comment">
          <app-avatar [user]="comment.author" [size]="28" />
          <span class="bubble">
            <span class="name">{{ comment.author | fullName }}</span>
            <span class="body">{{ comment.body }}</span>
          </span>
        </div>
      }
    </div>

    @if (canComment()) {
      <form class="composer" (submit)="submit($event)">
        <input
          type="text"
          maxlength="300"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          [placeholder]="'LIVE.COMMENT_PLACEHOLDER' | translate"
          [attr.aria-label]="'LIVE.COMMENT_PLACEHOLDER' | translate"
        />
        @if (draft().trim()) {
          <button type="submit" class="icon" [attr.aria-label]="'SEND' | translate"><ion-icon name="send" /></button>
        } @else {
          @for (emoji of emojis; track emoji) {
            <button type="button" class="emoji" (click)="react.emit(emoji)">{{ emoji }}</button>
          }
        }
      </form>
    }
  `,
  styles: `
    :host {
      bottom: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      left: 0;
      padding: 0 12px calc(12px + var(--ion-safe-area-bottom, 0px));
      pointer-events: none;
      position: absolute;
      right: 0;
    }

    .comments {
      display: flex;
      flex-direction: column;
      gap: 6px;
      mask-image: linear-gradient(transparent, #000 30%);
      max-height: 38vh;
      overflow-y: auto;
      pointer-events: auto;
      scrollbar-width: none;
    }

    .comment {
      align-items: flex-start;
      color: #fff;
      display: flex;
      gap: 8px;
      text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
    }

    .bubble {
      display: flex;
      flex-direction: column;
      font-size: 0.875rem;
    }

    .name {
      font-weight: 700;
    }

    .composer {
      align-items: center;
      display: flex;
      gap: 4px;
      pointer-events: auto;
    }

    .composer input {
      background: rgb(0 0 0 / 30%);
      border: 1px solid rgb(255 255 255 / 60%);
      border-radius: 999px;
      color: #fff;
      flex: 1 1 auto;
      height: 42px;
      min-width: 0;
      outline: none;
      padding: 0 16px;
    }

    .composer input::placeholder {
      color: rgb(255 255 255 / 80%);
    }

    .icon,
    .emoji {
      background: none;
      border: 0;
      color: #fff;
      cursor: pointer;
      font-size: 1.4rem;
      padding: 2px;
    }

    .emoji:hover {
      transform: scale(1.2);
    }

    @media (max-width: 420px) {
      .emoji:nth-of-type(n + 4) {
        display: none;
      }
    }

    .floating {
      bottom: 120px;
      height: 50vh;
      pointer-events: none;
      position: absolute;
      right: 8px;
      width: 90px;
    }

    .float {
      animation: rise 2.6s ease-out forwards;
      bottom: 0;
      font-size: 2rem;
      position: absolute;
    }

    @keyframes rise {
      0% {
        opacity: 0;
        transform: translateY(0) scale(0.6);
      }

      15% {
        opacity: 1;
        transform: translateY(-20px) scale(1.1);
      }

      100% {
        opacity: 0;
        transform: translateY(-45vh) scale(1);
      }
    }
  `,
})
export class LiveOverlayComponent {
  readonly comments = input<LiveComment[]>([]);
  readonly reactions = input<FloatingReaction[]>([]);
  readonly canComment = input(true);

  readonly comment = output<string>();
  readonly react = output<string>();

  readonly draft = signal('');
  readonly emojis = LIVE_REACTIONS;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    afterRenderEffect(() => {
      this.comments();
      const element = this.list()?.nativeElement;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  submit(event: Event): void {
    event.preventDefault();
    const body = this.draft().trim();

    if (body) {
      this.comment.emit(body);
      this.draft.set('');
    }
  }
}
