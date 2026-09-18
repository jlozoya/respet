import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation, Post } from '@social-network/shared';

import { ChatService } from '../../core/api/chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ConversationAvatarComponent, conversationTitle } from './conversation-avatar.component';

/**
 * «Enviar en Messenger»: manda una publicación a una o varias conversaciones.
 *
 * Como en Facebook, cada fila tiene su botón «Enviar» que pasa a «Enviado»,
 * sin cerrar la ventana, para poder mandarla a varias personas seguidas.
 */
@Component({
  selector: 'app-send-to-chat-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ConversationAvatarComponent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'SHARE_MENU.SEND_IN_MESSENGER' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <label class="rs-pill-input search">
        <ion-icon name="search" />
        <input type="search" [value]="term()" (input)="term.set($any($event.target).value)" [placeholder]="'MESSENGER.SEARCH' | translate" />
      </label>

      <textarea class="note" rows="2" maxlength="1000" [value]="note()" (input)="note.set($any($event.target).value)" [placeholder]="'SHARE_MENU.SAY_SOMETHING' | translate"></textarea>

      <div class="list">
        @for (conversation of filtered(); track conversation.id) {
          <div class="rs-row">
            <app-conversation-avatar [conversation]="conversation" [size]="40" />
            <span class="rs-row-text"><span class="title">{{ titleOf(conversation) }}</span></span>
            <ion-button size="small" [class.rs-soft]="sent().has(conversation.id)" [disabled]="sent().has(conversation.id) || conversation.readOnly" (click)="send(conversation)">
              {{ (sent().has(conversation.id) ? 'SHARE_MENU.SENT' : 'SEND') | translate }}
            </ion-button>
          </div>
        } @empty {
          <div class="rs-empty">{{ 'MESSENGER.EMPTY' | translate }}</div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .search {
      margin: 12px 16px 8px;
    }

    .note {
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 12px;
      color: inherit;
      display: block;
      font: inherit;
      margin: 0 16px 8px;
      padding: 10px 12px;
      resize: none;
      width: calc(100% - 32px);
    }

    .list {
      padding: 0 8px 16px;
    }
  `,
})
export class SendToChatModalComponent {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly post = input.required<Post>();

  readonly term = signal('');
  readonly note = signal('');
  readonly sent = signal<ReadonlySet<string>>(new Set());

  readonly filtered = computed(() => {
    const term = this.term().trim().toLowerCase();
    const items = this.chat.conversations();

    return term ? items.filter((item) => this.titleOf(item).toLowerCase().includes(term)) : items;
  });

  titleOf(conversation: Conversation): string {
    return conversationTitle(conversation, this.auth.user()?.id);
  }

  async send(conversation: Conversation): Promise<void> {
    this.sent.update((current) => new Set([...current, conversation.id]));

    try {
      await this.chat.send(conversation.id, { body: this.note(), sharedPostId: this.post().id });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
