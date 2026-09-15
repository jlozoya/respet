import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation } from '@respet/shared';

import { ChatService } from '../../../core/api/chat.service';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

/** Cuántas conversaciones caben abiertas a la vez sin tapar el contenido. */
const MAX_WINDOWS = 3;

/**
 * El muelle del chat: la lista de conversaciones y las ventanas abiertas.
 *
 * Hasta ahora, escribir a alguien obligaba a irse a la pantalla de mensajes y
 * abandonar lo que estuvieras leyendo. Aquí las conversaciones se abren encima
 * del muro, ancladas abajo a la derecha, y se pueden tener varias a la vez.
 *
 * Sólo aparece cuando hay sitio de sobra: en una pantalla estrecha taparía lo
 * que se está leyendo, y allí la pantalla completa de mensajes sigue siendo el
 * camino.
 */
@Component({
  selector: 'app-chat-dock',
  templateUrl: './chat-dock.component.html',
  styleUrls: ['./chat-dock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RelativeTimePipe, ChatWindowComponent, IonIcon, IonBadge],
})
export class ChatDockComponent {
  private readonly chat = inject(ChatService);

  readonly conversations = this.chat.conversations;
  readonly unreadCount = this.chat.unreadCount;

  /** Conversaciones abiertas, de izquierda a derecha. */
  readonly open = signal<readonly string[]>([]);
  readonly listVisible = signal(false);

  /** La lista sólo tiene sentido si hay con quién hablar. */
  readonly hasConversations = computed(() => this.conversations().length > 0);

  toggleList(): void {
    this.listVisible.update((value) => !value);
  }

  /**
   * Abre una conversación, o la trae al frente si ya estaba.
   *
   * Cuando ya hay tres, se cierra la más antigua: cuatro ventanas no caben sin
   * comerse la pantalla.
   */
  openConversation(conversation: Conversation): void {
    this.listVisible.set(false);

    this.open.update((current) => {
      if (current.includes(conversation.id)) {
        return current;
      }

      return [...current, conversation.id].slice(-MAX_WINDOWS);
    });
  }

  closeConversation(id: string): void {
    this.open.update((current) => current.filter((item) => item !== id));
  }

  /** Cuántos mensajes sin leer lleva una conversación. */
  unreadOf(conversation: Conversation): number {
    return conversation.unreadCount;
  }
}
