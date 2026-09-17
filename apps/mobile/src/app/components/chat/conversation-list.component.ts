import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Conversation } from '@respet/shared';

import { ChatService } from '../../core/api/chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { PresenceService } from '../../core/realtime/presence.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ConversationAvatarComponent, conversationTitle } from './conversation-avatar.component';
import { NewConversationModalComponent } from './new-conversation-modal.component';

/**
 * La bandeja de Messenger.
 *
 * La pintan el desplegable de la barra superior, la columna de la pantalla de
 * mensajes y el móvil. Filtra por nombre sin ir al servidor, separa las
 * archivadas y ofrece en cada conversación fijar, silenciar, archivar o
 * vaciar.
 */
@Component({
  selector: 'app-conversation-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, IonSpinner, RelativeTimePipe, ConversationAvatarComponent],
  template: `
    <div class="head">
      <h2>{{ (showArchived() ? 'MESSENGER.ARCHIVED' : 'MESSENGER.TITLE') | translate }}</h2>
      <span class="actions">
        @if (showArchived()) {
          <button type="button" class="rs-icon-btn" (click)="showArchived.set(false)" [attr.aria-label]="'COMMON.BACK' | translate">
            <ion-icon name="arrow-back" />
          </button>
        } @else {
          <button type="button" class="rs-icon-btn" (click)="showArchived.set(true)" [attr.aria-label]="'MESSENGER.ARCHIVED' | translate">
            <ion-icon name="archive-outline" />
          </button>
        }
        <button type="button" class="rs-icon-btn" (click)="compose()" [attr.aria-label]="'MESSENGER.NEW' | translate">
          <ion-icon name="create-outline" />
        </button>
      </span>
    </div>

    <label class="rs-pill-input search">
      <ion-icon name="search" />
      <input type="search" [value]="term()" (input)="term.set($any($event.target).value)" [placeholder]="'MESSENGER.SEARCH' | translate" />
    </label>

    <div class="list">
      @for (conversation of filtered(); track conversation.id) {
        <div
          class="rs-row item"
          role="button"
          tabindex="0"
          [class.active]="conversation.id === activeId()"
          [class.unread]="conversation.unreadCount > 0"
          (click)="selected.emit(conversation)"
          (keydown.enter)="selected.emit(conversation)"
        >
          <app-conversation-avatar [conversation]="conversation" [size]="compact() ? 48 : 56" />
          <span class="rs-row-text">
            <span class="title">{{ titleOf(conversation) }}</span>
            <span class="subtitle preview">
              <span class="rs-ellipsis">{{ previewOf(conversation) }}</span>
              @if (conversation.lastMessageAt) {
                <span class="time">· {{ conversation.lastMessageAt | relativeTime }}</span>
              }
            </span>
          </span>
          <span class="flags">
            @if (conversation.pinned) {
              <ion-icon name="pin" />
            }
            @if (conversation.muted) {
              <ion-icon name="notifications-off" />
            }
            @if (conversation.unreadCount > 0) {
              <span class="dot"></span>
            }
          </span>
          <button type="button" class="rs-icon-btn more" (click)="menu(conversation, $event)" [attr.aria-label]="'COMMON.OPTIONS' | translate">
            <ion-icon name="ellipsis-horizontal" />
          </button>
        </div>
      } @empty {
        @if (!loaded()) {
          <div class="rs-empty"><ion-spinner /></div>
        } @else {
          <div class="rs-empty">
            <ion-icon name="chatbubbles-outline" />
            <p>{{ (term() ? 'MESSENGER.NO_MATCHES' : 'MESSENGER.EMPTY') | translate }}</p>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .head {
      align-items: center;
      display: flex;
      justify-content: space-between;
      padding: 12px 16px 8px;
    }

    h2 {
      font-size: 1.5rem;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .search {
      margin: 0 16px 8px;
    }

    .list {
      padding: 0 8px 8px;
    }

    .item {
      position: relative;
    }

    .item.unread .title,
    .item.unread .preview {
      color: var(--ion-text-color);
      font-weight: 700;
    }

    .preview {
      display: flex;
      gap: 4px;
    }

    .time {
      flex: 0 0 auto;
    }

    .flags {
      align-items: center;
      color: var(--rs-text-3);
      display: flex;
      gap: 6px;
    }

    .dot {
      background: var(--ion-color-primary);
      border-radius: 50%;
      height: 12px;
      width: 12px;
    }

    .more {
      box-shadow: var(--rs-shadow-1);
      height: 32px;
      opacity: 0;
      position: absolute;
      right: 36px;
      width: 32px;
    }

    .item:hover .more,
    .more:focus-visible {
      opacity: 1;
    }

    @media (hover: none) {
      .more {
        display: none;
      }
    }
  `,
})
export class ConversationListComponent {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly feedback = inject(FeedbackService);

  readonly compact = input(false);
  readonly activeId = input<string | null>(null);
  readonly selected = output<Conversation>();

  readonly term = signal('');
  readonly showArchived = signal(false);
  readonly loaded = this.chat.loaded;

  readonly filtered = computed(() => {
    const source = this.showArchived() ? this.chat.archived() : this.chat.conversations();
    const term = this.term().trim().toLowerCase();

    return term ? source.filter((item) => this.titleOf(item).toLowerCase().includes(term)) : source;
  });

  constructor() {
    // Se vigila la presencia de las personas con las que se habla, sigan o no.
    effect(() => {
      const peers = this.chat
        .conversations()
        .map((conversation) => conversation.peer?.id)
        .filter((id): id is string => !!id);

      if (peers.length) {
        this.presence.track(peers);
      }
    });
  }

  titleOf(conversation: Conversation): string {
    return conversationTitle(conversation, this.auth.user()?.id);
  }

  previewOf(conversation: Conversation): string {
    if (!conversation.lastPreview) {
      return this.translate.instant(conversation.type === 'group' ? 'MESSENGER.GROUP_CREATED' : 'MESSENGER.SAY_HI') as string;
    }

    const own = conversation.lastSenderId === this.auth.user()?.id;

    return own ? `${this.translate.instant('MESSENGER.YOU') as string}: ${conversation.lastPreview}` : conversation.lastPreview;
  }

  async compose(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: NewConversationModalComponent, cssClass: 'rs-dialog' });
    await modal.present();

    const { data } = await modal.onWillDismiss<Conversation>();

    if (data) {
      this.selected.emit(data);
    }
  }

  async menu(conversation: Conversation, event: Event): Promise<void> {
    event.stopPropagation();

    const t = (key: string) => this.translate.instant(key) as string;
    const sheet = await this.actionSheetCtrl.create({
      header: this.titleOf(conversation),
      buttons: [
        { text: t(conversation.pinned ? 'MESSENGER.UNPIN' : 'MESSENGER.PIN'), icon: 'pin-outline', data: 'pin' },
        {
          text: t(conversation.muted ? 'MESSENGER.UNMUTE' : 'MESSENGER.MUTE'),
          icon: conversation.muted ? 'notifications-outline' : 'notifications-off-outline',
          data: 'mute',
        },
        { text: t(conversation.archived ? 'MESSENGER.UNARCHIVE' : 'MESSENGER.ARCHIVE'), icon: 'archive-outline', data: 'archive' },
        { text: t('MESSENGER.DELETE_CHAT'), icon: 'trash-outline', role: 'destructive', data: 'clear' },
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    try {
      switch (data) {
        case 'pin':
          await this.chat.setPinned(conversation.id, !conversation.pinned);
          break;
        case 'mute':
          await this.chat.setMuted(conversation.id, !conversation.muted);
          break;
        case 'archive':
          await this.chat.setArchived(conversation.id, !conversation.archived);
          break;
        case 'clear':
          if (
            await this.feedback.confirm({
              header: 'MESSENGER.DELETE_CHAT',
              message: 'MESSENGER.DELETE_CHAT_MESSAGE',
              confirmText: 'DELETE',
              danger: true,
            })
          ) {
            await this.chat.clear(conversation.id);
          }
          break;
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
