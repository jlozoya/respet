import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation } from '@respet/shared';

import { ChatThreadComponent } from '../../components/chat/chat-thread.component';
import { ConversationListComponent } from '../../components/chat/conversation-list.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Messenger a pantalla completa.
 *
 * En el escritorio, la bandeja a la izquierda y la conversación a la derecha;
 * en el móvil, una cosa u otra según la dirección, para que el botón de volver
 * del sistema lleve de la conversación a la bandeja.
 */
@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, PageHeaderComponent, ConversationListComponent, ChatThreadComponent],
  template: `
    @if (!id()) {
      <app-page-header title="MESSENGER.TITLE" />
    }

    <ion-content [scrollY]="false">
      <div class="layout" [class.has-thread]="!!id()">
        <aside class="inbox">
          <app-conversation-list class="list" [activeId]="id() ?? null" (selected)="open($event)" />
        </aside>

        <section class="thread">
          @if (id(); as conversationId) {
            <app-chat-thread [conversationId]="conversationId" mode="page" />
          } @else {
            <div class="rs-empty placeholder">
              <ion-icon name="chatbubbles-outline" />
              <h3>{{ 'MESSENGER.PICK_TITLE' | translate }}</h3>
              <p>{{ 'MESSENGER.PICK' | translate }}</p>
            </div>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      height: 100%;
    }

    .inbox {
      background: var(--rs-surface);
      border-right: 1px solid var(--rs-divider);
      min-height: 0;
      overflow-y: auto;
    }

    .list {
      min-height: 100%;
    }

    .thread {
      min-height: 0;
    }

    .placeholder {
      height: 100%;
      justify-content: center;
    }

    @media (max-width: 991.98px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .layout.has-thread .inbox,
      .layout:not(.has-thread) .thread {
        display: none;
      }

      .inbox {
        border-right: 0;
      }
    }
  `,
})
export class MessagesPage {
  private readonly router = inject(Router);

  readonly id = input<string | undefined>(undefined);

  open(conversation: Conversation): void {
    void this.router.navigate(['/messages', conversation.id]);
  }
}
