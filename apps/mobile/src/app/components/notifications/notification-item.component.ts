import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Notification } from '@social-network/shared';

import { AvatarComponent } from '../../shared/components/avatar.component';
import { fullName } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

/** El icono pequeño sobre el avatar, que dice de un vistazo qué pasó. */
const TYPE_BADGES: Record<Notification['type'], { icon: string; color: string }> = {
  reaction: { icon: 'thumbs-up', color: '#f05a22' },
  comment: { icon: 'chatbubble', color: '#31a24c' },
  reply: { icon: 'chatbubbles', color: '#31a24c' },
  comment_like: { icon: 'heart', color: '#f33e58' },
  mention: { icon: 'at', color: '#1877f2' },
  follow: { icon: 'person-add', color: '#1877f2' },
  follow_request: { icon: 'person-add', color: '#8a3ab9' },
  follow_accepted: { icon: 'checkmark', color: '#31a24c' },
  story_reaction: { icon: 'happy', color: '#e1306c' },
  live_started: { icon: 'videocam', color: '#e41e3f' },
  post_shared: { icon: 'arrow-redo', color: '#14a697' },
  security_alert: { icon: 'shield-checkmark', color: '#e9710f' },
};

/**
 * Un aviso de la lista.
 *
 * Los avisos van agrupados —«Ana y 3 personas más reaccionaron»—, así que el
 * texto se compone con el primer nombre y el resto como número, y la clave de
 * traducción cambia según haya uno, dos o más.
 */
@Component({
  selector: 'app-notification-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, AvatarComponent, RelativeTimePipe],
  template: `
    @let item = notification();
    <button
      type="button"
      class="rs-row item"
      [class.unread]="!item.read"
      (click)="selected.emit(item)"
    >
      <span class="avatar">
        <app-avatar [user]="item.actors[0]" [size]="compact() ? 48 : 56" />
        <span class="type" [style.background]="badge().color"
          ><ion-icon [name]="badge().icon"
        /></span>
      </span>

      <span class="text">
        <span class="line" [innerHTML]="message() | translate: params()"></span>
        @if (item.preview) {
          <span class="preview">«{{ item.preview }}»</span>
        }
        <span class="time" [class.fresh]="!item.read">{{ item.updatedAt | relativeTime }}</span>
      </span>

      @if (item.thumbnail) {
        <img
          class="thumb"
          [src]="item.thumbnail.posterUrl ?? item.thumbnail.url"
          alt=""
          loading="lazy"
        />
      }

      @if (!item.read) {
        <span class="dot"></span>
      }
    </button>
  `,
  styles: `
    .item {
      align-items: center;
    }

    .avatar {
      flex: 0 0 auto;
      position: relative;
    }

    .type {
      align-items: center;
      border: 2px solid var(--rs-surface);
      border-radius: 50%;
      bottom: -3px;
      color: #fff;
      display: flex;
      font-size: 12px;
      height: 24px;
      justify-content: center;
      position: absolute;
      right: -4px;
      width: 24px;
    }

    .text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      font-size: 0.9375rem;
      gap: 2px;
      min-width: 0;
    }

    .line {
      overflow-wrap: anywhere;
    }

    .preview {
      color: var(--rs-text-2);
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .time {
      color: var(--rs-text-2);
      font-size: 0.8125rem;
    }

    .time.fresh {
      color: var(--ion-color-primary);
      font-weight: 600;
    }

    .thumb {
      border-radius: 6px;
      flex: 0 0 48px;
      height: 48px;
      object-fit: cover;
      width: 48px;
    }

    .dot {
      background: var(--ion-color-primary);
      border-radius: 50%;
      flex: 0 0 12px;
      height: 12px;
      width: 12px;
    }
  `,
})
export class NotificationItemComponent {
  readonly notification = input.required<Notification>();
  readonly compact = input(false);
  readonly selected = output<Notification>();

  readonly badge = computed(() => TYPE_BADGES[this.notification().type]);

  readonly message = computed(() => {
    const item = this.notification();
    const plural = item.actorCount > 2 ? 'MANY' : item.actorCount === 2 ? 'TWO' : 'ONE';

    return `NOTIFICATIONS.TYPES.${item.type.toUpperCase()}.${plural}`;
  });

  readonly params = computed(() => {
    const item = this.notification();
    const escape = (value: string) =>
      value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

    return {
      name: `<b>${escape(fullName(item.actors[0]))}</b>`,
      other: `<b>${escape(fullName(item.actors[1]))}</b>`,
      count: item.actorCount - 1,
    };
  });
}
