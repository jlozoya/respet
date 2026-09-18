import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Media, UserSummary } from '@social-network/shared';

import type { ChatMessage } from '../../core/api/chat.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { MediaGridComponent } from '../../shared/components/media-grid.component';
import { RichTextComponent } from '../../shared/components/rich-text.component';
import { DurationPipe, FileSizePipe } from '../../shared/pipes/duration.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { QUICK_EMOJIS } from '../../shared/utils/reactions';

/** Lo que se puede hacer con un mensaje. */
export type MessageAction =
  | { type: 'reply' }
  | { type: 'react'; emoji: string }
  | { type: 'edit' }
  | { type: 'copy' }
  | { type: 'delete' }
  | { type: 'hide' }
  | { type: 'retry' }
  | { type: 'discard' }
  | { type: 'report' };

/** Minutos durante los que se puede editar un mensaje propio. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Un mensaje del hilo.
 *
 * Las burbujas seguidas de la misma persona se juntan —sólo la última lleva
 * el avatar y las esquinas se redondean según su sitio en el grupo—, como en
 * Messenger. En el escritorio las acciones aparecen al pasar por encima; en el
 * móvil, manteniendo pulsado.
 */
@Component({
  selector: 'app-message-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonIcon,
    IonSpinner,
    AvatarComponent,
    MediaGridComponent,
    RichTextComponent,
    DurationPipe,
    FileSizePipe,
    FullNamePipe,
  ],
  host: {
    '[class.own]': 'own()',
    '[class.first]': 'first()',
    '[class.last]': 'last()',
    '(mouseleave)': 'picker.set(false)',
  },
  template: `
    @let item = message();
    @if (showName()) {
      <span class="sender-name">{{ item.sender | fullName }}</span>
    }

    <div class="row">
      <span class="avatar-slot">
        @if (showAvatar()) {
          <app-avatar [user]="item.sender" [size]="28" />
        }
      </span>

      <div
        class="stack"
        (contextmenu)="openSheet($event)"
        (touchstart)="pressStart()"
        (touchend)="pressEnd()"
        (touchmove)="pressEnd()"
      >
        @if (item.replyTo; as quoted) {
          <div class="quote">
            <span class="quote-label">
              <ion-icon name="arrow-undo" />
              {{ 'MESSENGER.REPLYING_TO' | translate: { name: (quoted.sender | fullName) } }}
            </span>
            <span class="quote-body">
              @if (quoted.deleted) {
                {{ 'MESSENGER.DELETED' | translate }}
              } @else {
                {{ quoted.body || ('MESSENGER.ATTACHMENT' | translate) }}
              }
            </span>
          </div>
        }

        @if (item.deleted) {
          <div class="bubble deleted">{{ 'MESSENGER.DELETED' | translate }}</div>
        } @else {
          @if (item.story; as story) {
            <div class="story-ref">
              <span class="rs-muted rs-small">{{ 'MESSENGER.REPLIED_TO_STORY' | translate }}</span>
              @if (!story.expired && story.media) {
                <img [src]="story.media.posterUrl ?? story.media.url" alt="" />
              } @else if (!story.expired && story.text) {
                <span class="story-text">{{ story.text }}</span>
              } @else {
                <span class="rs-muted rs-small">{{ 'STORIES.EXPIRED' | translate }}</span>
              }
            </div>
          }

          @if (visualMedia().length) {
            <app-media-grid class="media" [media]="visualMedia()" />
          }

          @for (file of audioMedia(); track file.id) {
            <div class="bubble audio">
              <audio [src]="file.url" controls preload="metadata"></audio>
              @if (file.durationMs) {
                <span class="rs-small">{{ file.durationMs | duration }}</span>
              }
            </div>
          }

          @for (file of fileMedia(); track file.id) {
            <a class="bubble file" [href]="file.url" target="_blank" rel="noopener" download>
              <ion-icon name="document-text" />
              <span class="file-info">
                <span class="rs-strong rs-ellipsis">{{ file.fileName ?? file.alt }}</span>
                <span class="rs-small">{{ file.sizeBytes | fileSize }}</span>
              </span>
              <ion-icon name="download-outline" />
            </a>
          }

          @if (item.sharedPost; as post) {
            <a class="shared-post" [routerLink]="['/post', post.id]">
              @if (post.media[0]; as cover) {
                <img [src]="cover.posterUrl ?? cover.url" alt="" />
              }
              <span class="shared-body">
                <span class="rs-strong">{{ post.author | fullName }}</span>
                <span class="rs-small rs-muted clamp">{{ post.description }}</span>
              </span>
            </a>
          }

          @if (item.body && !isJumbo()) {
            <div class="bubble text">
              <app-rich-text [text]="item.body" />
            </div>
          } @else if (item.body) {
            <div class="jumbo">{{ item.body }}</div>
          }
        }

        @if (item.reactions.length) {
          <div class="reactions">
            @for (group of item.reactions; track group.emoji) {
              <button
                type="button"
                class="reaction"
                [class.mine]="group.reactedByMe"
                (click)="act({ type: 'react', emoji: group.emoji })"
              >
                {{ group.emoji }}
                @if (group.count > 1) {
                  <span>{{ group.count }}</span>
                }
              </button>
            }
          </div>
        }
      </div>

      @if (!item.deleted && item.status !== 'sending' && item.status !== 'failed') {
        <div class="tools">
          <button
            type="button"
            class="tool"
            (click)="picker.set(!picker())"
            [attr.aria-label]="'MESSENGER.REACT' | translate"
          >
            <ion-icon name="happy-outline" />
          </button>
          <button
            type="button"
            class="tool"
            (click)="act({ type: 'reply' })"
            [attr.aria-label]="'MESSENGER.REPLY' | translate"
          >
            <ion-icon name="arrow-undo-outline" />
          </button>
          <button
            type="button"
            class="tool"
            (click)="openSheet($event)"
            [attr.aria-label]="'COMMON.OPTIONS' | translate"
          >
            <ion-icon name="ellipsis-vertical" />
          </button>
          @if (picker()) {
            <div class="picker">
              @for (emoji of emojis; track emoji) {
                <button type="button" (click)="act({ type: 'react', emoji }); picker.set(false)">
                  {{ emoji }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>

    <div class="meta">
      @switch (item.status) {
        @case ('sending') {
          <span class="status"
            ><ion-spinner name="dots" /> {{ 'MESSENGER.SENDING' | translate }}</span
          >
        }
        @case ('failed') {
          <span class="status failed">
            <ion-icon name="alert-circle" /> {{ 'MESSENGER.FAILED' | translate }} ·
            <button type="button" class="rs-text-btn" (click)="act({ type: 'retry' })">
              {{ 'MESSENGER.RETRY' | translate }}
            </button>
            ·
            <button type="button" class="rs-text-btn" (click)="act({ type: 'discard' })">
              {{ 'MESSENGER.DISCARD' | translate }}
            </button>
          </span>
        }
        @default {
          @if (item.editedAt && !item.deleted) {
            <span class="status">{{ 'MESSENGER.EDITED' | translate }}</span>
          }
          @if (statusLabel(); as label) {
            <span class="status">{{ label | translate: { count: item.readCount } }}</span>
          }
          @if (seenBy(); as reader) {
            <app-avatar class="seen" [user]="reader" [size]="14" />
          }
        }
      }
    </div>
  `,
  styleUrl: './message-bubble.component.scss',
})
export class MessageBubbleComponent {
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);

  readonly message = input.required<ChatMessage>();
  readonly own = input(false);
  readonly first = input(true);
  readonly last = input(true);
  readonly showAvatar = input(false);
  readonly showName = input(false);
  readonly isGroup = input(false);
  /** Enseñar el estado de entrega: sólo en el último mensaje propio. */
  readonly showStatus = input(false);
  /** Quien vio este mensaje el último, para la carita diminuta de «visto». */
  readonly seenBy = input<UserSummary | null>(null);

  readonly action = output<MessageAction>();

  readonly picker = signal(false);
  readonly emojis = QUICK_EMOJIS;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;

  readonly visualMedia = computed<Media[]>(() =>
    this.message().attachments.filter((item) => item.type === 'image' || item.type === 'video'),
  );
  readonly audioMedia = computed(() =>
    this.message().attachments.filter((item) => item.type === 'audio'),
  );
  readonly fileMedia = computed(() =>
    this.message().attachments.filter(
      (item) => item.type !== 'image' && item.type !== 'video' && item.type !== 'audio',
    ),
  );

  /** Un mensaje de sólo uno a tres emojis se enseña grande y sin burbuja. */
  readonly isJumbo = computed(() => {
    const body = this.message().body?.trim() ?? '';

    return (
      body.length > 0 &&
      body.length <= 12 &&
      /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,8}$/u.test(body) &&
      !/\d/.test(body)
    );
  });

  readonly statusLabel = computed(() => {
    const item = this.message();

    if (!this.own() || !this.showStatus() || item.deleted || this.seenBy()) {
      return null;
    }

    if (this.isGroup() && item.readCount > 0) {
      return 'MESSENGER.SEEN_BY';
    }

    switch (item.status) {
      case 'read':
        return 'MESSENGER.SEEN';
      case 'delivered':
        return 'MESSENGER.DELIVERED';
      case 'sent':
        return 'MESSENGER.SENT';
      default:
        return null;
    }
  });

  act(action: MessageAction): void {
    this.action.emit(action);
  }

  pressStart(): void {
    this.pressTimer = setTimeout(() => void this.openSheet(), 450);
  }

  pressEnd(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  async openSheet(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();

    const item = this.message();

    if (item.deleted || item.status === 'sending') {
      return;
    }

    const t = (key: string) => this.translate.instant(key) as string;
    const canEdit =
      this.own() &&
      !!item.body &&
      Date.now() - Date.parse(item.createdAt) < EDIT_WINDOW_MS &&
      item.kind === 'text';

    const buttons = [
      ...QUICK_EMOJIS.map((emoji) => ({
        text: emoji,
        data: { type: 'react', emoji },
        cssClass: 'emoji-button',
      })),
      {
        text: t('MESSENGER.REPLY'),
        icon: 'arrow-undo-outline',
        data: { type: 'reply' } as MessageAction,
      },
      ...(item.body
        ? [
            {
              text: t('MESSENGER.COPY'),
              icon: 'copy-outline',
              data: { type: 'copy' } as MessageAction,
            },
          ]
        : []),
      ...(canEdit
        ? [
            {
              text: t('MESSENGER.EDIT'),
              icon: 'create-outline',
              data: { type: 'edit' } as MessageAction,
            },
          ]
        : []),
      ...(this.own()
        ? [
            {
              text: t('MESSENGER.DELETE_FOR_ALL'),
              icon: 'trash-outline',
              role: 'destructive',
              data: { type: 'delete' } as MessageAction,
            },
          ]
        : [{ text: t('REPORT'), icon: 'flag-outline', data: { type: 'report' } as MessageAction }]),
      {
        text: t('MESSENGER.DELETE_FOR_ME'),
        icon: 'eye-off-outline',
        data: { type: 'hide' } as MessageAction,
      },
      { text: t('CANCEL'), role: 'cancel' },
    ];

    const sheet = await this.actionSheetCtrl.create({ buttons, cssClass: 'rs-message-sheet' });
    await sheet.present();

    const { data } = await sheet.onWillDismiss<MessageAction>();

    if (data) {
      this.action.emit(data);
    }
  }
}
