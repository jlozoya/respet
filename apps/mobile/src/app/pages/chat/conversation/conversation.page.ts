import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation, Message } from '@respet/shared';

import { ChatService } from '../../../core/api/chat.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { EntityMenuComponent } from '../../../shared/components/entity-menu.component';
import {
  MessageBubbleComponent,
  type BubbleMessage,
} from '../../../components/chat/message-bubble/message-bubble.component';

/** Espera antes de anunciar que se dejó de escribir. */
const TYPING_IDLE_MS = 1500;

/** Separación a partir de la cual dos mensajes seguidos dejan de agruparse. */
const GROUP_GAP_MS = 5 * 60_000;

/**
 * Hilo de conversación.
 *
 * La disposición imita la de Messenger: burbujas a la derecha para lo propio y
 * a la izquierda para lo ajeno, mensajes seguidos del mismo autor agrupados en
 * un bloque, avatar sólo en el último de cada bloque, y la hora únicamente
 * cuando pasa un rato entre uno y otro. Todo eso se calcula una vez en
 * `bubbles()` en lugar de dejarlo en la plantilla.
 */
@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.page.html',
  styleUrls: ['./conversation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    MessageBubbleComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonAvatar,
    IonContent,
    IonFooter,
    IonTextarea,
    IonButton,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class ConversationPage {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly picker = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly popoverCtrl = inject(PopoverController);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  readonly conversation = signal<Conversation | null>(null);
  readonly messages = signal<readonly Message[]>([]);
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly hasMore = signal(false);

  private cursor: string | null = null;
  private typingTimer?: ReturnType<typeof setTimeout>;
  private announcedTyping = false;
  private joinedId?: string;

  readonly peerOnline = computed(() => {
    const peer = this.conversation()?.peer;

    return peer ? this.chat.isOnline(peer.id) : false;
  });

  readonly peerTyping = computed(() => {
    const conversation = this.conversation();

    return conversation ? this.chat.isTyping(conversation.id) : false;
  });

  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.sending());

  /**
   * Mensajes con la información de presentación ya resuelta: si abren o cierran
   * un bloque, si llevan avatar y si toca enseñar la hora.
   */
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
        // El avatar va sólo en el último del bloque, que es donde queda a la
        // altura de la última línea, como en Messenger.
        showAvatar: !own && endsGroup,
        showTime: endsGroup,
      };
    });
  });

  constructor() {
    effect(() => {
      const conversationId = this.id();

      if (conversationId) {
        void this.open(conversationId);
      }
    });

    // Los mensajes que llegan por el socket se añaden al hilo abierto.
    this.chat.incoming.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      if (message.conversationId !== this.id()) {
        return;
      }

      this.messages.update((current) => [...current, message]);
      void this.chat.markRead(message.conversationId);
      this.scrollToBottom();
    });

    this.chat.deletions.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.messages.update((current) =>
        current.map((item) => (item.id === message.id ? message : item)),
      );
    });

    this.destroyRef.onDestroy(() => {
      this.stopTyping();

      if (this.joinedId) {
        this.chat.leaveConversation(this.joinedId);
      }
    });
  }

  /** Carga el tramo anterior al desplazarse hacia arriba. */
  async loadOlder(event: Event): Promise<void> {
    if (!this.cursor) {
      void (event.target as HTMLIonInfiniteScrollElement).complete();

      return;
    }

    try {
      const page = await this.chat.messages(this.id(), { before: this.cursor });

      // Los antiguos se anteponen; el navegador conserva la posición porque el
      // contenido crece por arriba.
      this.messages.update((current) => [...page.data, ...current]);
      this.cursor = page.nextCursor;
      this.hasMore.set(page.nextCursor !== null);
    } catch (error) {
      await this.feedback.error(error);
      this.hasMore.set(false);
    } finally {
      void (event.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  onDraftChange(value: string): void {
    this.draft.set(value);
    this.announceTyping();
  }

  async send(): Promise<void> {
    const body = this.draft().trim();

    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.draft.set('');
    this.stopTyping();

    try {
      const message = await this.chat.send(this.id(), body);
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

  async sendImage(): Promise<void> {
    const blob = await this.picker.pick({ aspectRatio: 4 / 3, targetWidth: 1280 });

    if (!blob) {
      return;
    }

    this.sending.set(true);

    try {
      const message = await this.chat.sendImage(this.id(), blob);
      this.messages.update((current) => [...current, message]);
      this.scrollToBottom();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.sending.set(false);
    }
  }

  /** Menú de un mensaje propio: por ahora, retirarlo. */
  async openMessageMenu(event: Event, message: Message): Promise<void> {
    if (message.sender.id !== this.auth.user()?.id || message.deleted) {
      return;
    }

    const popover = await this.popoverCtrl.create({
      component: EntityMenuComponent,
      componentProps: { canDelete: true },
      event,
    });

    await popover.present();

    const { data } = await popover.onWillDismiss<'delete'>();

    if (data !== 'delete') {
      return;
    }

    try {
      const updated = await this.chat.deleteMessage(message.id);
      this.messages.update((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async toggleMute(): Promise<void> {
    const conversation = this.conversation();

    if (!conversation) {
      return;
    }

    try {
      await this.chat.setMuted(conversation.id, !conversation.muted);
      this.conversation.set({ ...conversation, muted: !conversation.muted });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  avatarUrl(): string {
    return this.conversation()?.peer.avatar?.url ?? './assets/imgs/avatar.png';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }

  private async open(conversationId: string): Promise<void> {
    this.loading.set(true);
    this.messages.set([]);

    try {
      await this.chat.start();

      if (this.joinedId && this.joinedId !== conversationId) {
        this.chat.leaveConversation(this.joinedId);
      }

      this.chat.joinConversation(conversationId);
      this.joinedId = conversationId;

      this.conversation.set(await this.chat.findConversation(conversationId));

      const page = await this.chat.messages(conversationId);
      this.messages.set(page.data);
      this.cursor = page.nextCursor;
      this.hasMore.set(page.nextCursor !== null);

      await this.chat.markRead(conversationId);
      this.scrollToBottom();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Avisa de que se está escribiendo, sin inundar el socket.
   *
   * Se manda una sola señal al empezar y otra al parar, en lugar de una por
   * tecla pulsada.
   */
  private announceTyping(): void {
    const conversationId = this.id();

    if (!this.announcedTyping) {
      this.announcedTyping = true;
      this.chat.notifyTyping(conversationId, true);
    }

    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), TYPING_IDLE_MS);
  }

  private stopTyping(): void {
    clearTimeout(this.typingTimer);

    if (this.announcedTyping) {
      this.announcedTyping = false;
      this.chat.notifyTyping(this.id(), false);
    }
  }

  /**
   * Lleva el hilo al final.
   *
   * Se aplaza un ciclo porque el mensaje recién añadido todavía no está en el
   * DOM cuando se llama, y sin la espera el desplazamiento se quedaría corto.
   */
  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const content = document.querySelector('ion-content.chat-content');
      void (content as HTMLIonContentElement | null)?.scrollToBottom(200);
    });
  }
}

function gapBetween(first: Message, second: Message): number {
  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}
