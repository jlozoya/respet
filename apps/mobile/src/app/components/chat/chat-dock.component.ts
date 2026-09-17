import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Conversation } from '@respet/shared';

import { ChatService } from '../../core/api/chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConversationAvatarComponent, conversationTitle } from './conversation-avatar.component';
import { ChatThreadComponent } from './chat-thread.component';

/**
 * Las ventanas de chat del escritorio, abajo a la derecha, como en Facebook.
 *
 * Cada una es un hilo completo que sigue abierto al cambiar de página. Las
 * minimizadas quedan como una burbuja con la cara de la conversación y su
 * contador, apiladas en el borde.
 */
@Component({
  selector: 'app-chat-dock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatThreadComponent, ConversationAvatarComponent],
  template: `
    <div class="windows">
      @for (id of open(); track id) {
        <section class="window">
          <app-chat-thread [conversationId]="id" mode="dock" (closed)="chat.closeWindow(id)" (minimize)="chat.toggleMinimized(id)" />
        </section>
      }
    </div>

    <div class="bubbles">
      @for (conversation of minimized(); track conversation.id) {
        <button type="button" class="bubble" [title]="titleOf(conversation)" (click)="chat.toggleMinimized(conversation.id)">
          <app-conversation-avatar [conversation]="conversation" [size]="48" />
          @if (conversation.unreadCount > 0) {
            <span class="rs-badge">{{ conversation.unreadCount }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      bottom: 0;
      display: flex;
      gap: 12px;
      pointer-events: none;
      position: fixed;
      right: 16px;
      z-index: 10;
    }

    @media (max-width: 1199.98px) {
      :host {
        display: none;
      }
    }

    .windows {
      align-items: flex-end;
      display: flex;
      gap: 10px;
    }

    .window {
      border-radius: 8px 8px 0 0;
      box-shadow: var(--rs-shadow-2);
      height: 455px;
      overflow: hidden;
      pointer-events: auto;
      width: 338px;
    }

    .bubbles {
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      padding-bottom: 16px;
    }

    .bubble {
      background: none;
      border: 0;
      border-radius: 50%;
      box-shadow: var(--rs-shadow-2);
      cursor: pointer;
      padding: 0;
      pointer-events: auto;
      position: relative;
    }
  `,
})
export class ChatDockComponent {
  readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);

  readonly open = computed(() => this.chat.dock().filter((id) => !this.chat.minimized().has(id)));

  readonly minimized = computed(() => {
    const hidden = this.chat.minimized();
    const conversations = [...this.chat.conversations(), ...this.chat.archived()];

    return this.chat
      .dock()
      .filter((id) => hidden.has(id))
      .map((id) => conversations.find((item) => item.id === id))
      .filter((item): item is Conversation => item !== undefined);
  });

  titleOf(conversation: Conversation): string {
    return conversationTitle(conversation, this.auth.user()?.id);
  }
}
