import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation, Message } from '@respet/shared';

import { ChatService } from '../../../core/api/chat.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { MessageBubbleComponent, type BubbleMessage } from '../message-bubble/message-bubble.component';

/** Cuántos mensajes trae la ventana al abrirse. */
const PAGE = 20;

/** Separación a partir de la cual dos mensajes seguidos dejan de agruparse. */
const GROUP_GAP_MS = 5 * 60_000;

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/**
 * Una conversación en una ventana pequeña, anclada abajo a la derecha.
 *
 * Es el hilo de siempre reducido a lo que se hace sin salir de lo que estabas
 * mirando: leer los últimos mensajes y contestar. Lo demás —buscar hacia
 * atrás, mandar fotos, retirar un mensaje— sigue en la pantalla completa, a un
 * clic desde la cabecera.
 */
@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.panel]': 'embedded()' },
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    MessageBubbleComponent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonTextarea,
  ],
})
export class ChatWindowComponent {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly conversationId = input.required<string>();
  /**
   * Cierto cuando la ventana es el panel de la bandeja y no una ventanita.
   *
   * Allí ocupa todo el hueco y pierde los mandos de plegar y cerrar: no hay
   * nada de lo que quitarse de encima, la conversación *es* la pantalla.
   */
  readonly embedded = input(false);

  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');

  readonly closed = output<string>();

  readonly conversation = signal<Conversation | null>(null);
  readonly messages = signal<readonly Message[]>([]);
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly sending = signal(false);
  /** Plegada deja sólo la cabecera, como en Messenger. */
  readonly collapsed = signal(false);

  readonly peerOnline = computed(() => {
    const peer = this.conversation()?.peer;

    return peer ? this.chat.isOnline(peer.id) : false;
  });

  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.sending());

  readonly avatarUrl = computed(() => this.conversation()?.peer.avatar?.url ?? FALLBACK_AVATAR);

  /** Los mensajes con su presentación resuelta, igual que en la pantalla completa. */
  readonly bubbles = computed<readonly BubbleMessage[]>(() => {
    const items = this.messages();
    const ownId = this.auth.user()?.id;

    return items.map((message, index) => {
      const previous = items[index - 1];
      const next = items[index + 1];
      const own = message.sender.id === ownId;

      const startsGroup =
        !previous ||
        previous.sender.id !== message.sender.id ||
        gapBetween(previous, message) > GROUP_GAP_MS;

      const endsGroup =
        !next || next.sender.id !== message.sender.id || gapBetween(message, next) > GROUP_GAP_MS;

      return {
        message,
        own,
        startsGroup,
        endsGroup,
        showAvatar: !own && endsGroup,
        showTime: endsGroup,
      };
    });
  });

  constructor() {
    void this.load();

    // Lo que llega por el socket entra en la ventana si es de este hilo.
    this.chat.incoming.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      if (message.conversationId !== this.conversationId()) {
        return;
      }

      this.messages.update((current) => [...current, message]);
      this.scrollToBottom();

      // Si está plegada, el mensaje se queda sin leer hasta que se despliegue.
      if (!this.collapsed()) {
        void this.chat.markRead(message.conversationId);
      }
    });

    this.chat.deletions.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.messages.update((current) =>
        current.map((item) => (item.id === message.id ? message : item)),
      );
    });
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_AVATAR;
  }

  toggle(): void {
    this.collapsed.update((value) => !value);

    if (!this.collapsed()) {
      void this.chat.markRead(this.conversationId());
    }
  }

  close(): void {
    this.closed.emit(this.conversationId());
  }

  onDraftChange(value: string): void {
    this.draft.set(value);
  }

  async send(): Promise<void> {
    const body = this.draft().trim();

    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.draft.set('');

    try {
      const message = await this.chat.send(this.conversationId(), body);
      this.messages.update((current) => [...current, message]);
      this.scrollToBottom();
    } catch (error) {
      // Se devuelve el texto al campo para no perder lo escrito.
      this.draft.set(body);
      await this.feedback.error(error);
    } finally {
      this.sending.set(false);
    }
  }

  /** Enter envía; con la tecla de mayúsculas, salta de línea. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  private async load(): Promise<void> {
    const id = this.conversationId();

    try {
      const [conversation, page] = await Promise.all([
        this.chat.findConversation(id),
        this.chat.messages(id, { limit: PAGE }),
      ]);

      this.conversation.set(conversation);
      this.messages.set(page.data);
      this.scrollToBottom();
      await this.chat.markRead(id);
    } catch (error) {
      await this.feedback.error(error);
      this.close();
    } finally {
      this.loading.set(false);
    }
  }

  /** Deja a la vista el último mensaje, que es a lo que se mira. */
  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const element = this.hilo()?.nativeElement;

      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }
}

function gapBetween(first: Message, second: Message): number {
  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}
