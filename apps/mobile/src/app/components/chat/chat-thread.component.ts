import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Message, UserSummary } from '@social-network/shared';

import { ChatService, type ChatMessage, type OutgoingMessage } from '../../core/api/chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { PresenceService } from '../../core/realtime/presence.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { dayLabel, sameDay } from '../../shared/utils/dates';
import { ChatComposerComponent } from './chat-composer.component';
import { ConversationAvatarComponent, conversationTitle } from './conversation-avatar.component';
import { GroupInfoModalComponent } from './group-info-modal.component';
import { MessageBubbleComponent, type MessageAction } from './message-bubble.component';

/** Cinco minutos sin escribir parten un grupo de burbujas. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** Distancia al final por debajo de la cual un mensaje nuevo baja el hilo solo. */
const STICKY_BOTTOM_PX = 160;

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'system'; key: string; message: ChatMessage }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      own: boolean;
      first: boolean;
      last: boolean;
      showAvatar: boolean;
      showName: boolean;
      showStatus: boolean;
      seenBy: UserSummary | null;
    };

/**
 * Una conversación abierta: cabecera, hilo y caja de escribir.
 *
 * La misma pieza vive a pantalla completa en «Mensajes» y dentro de una
 * ventana del muelle en el escritorio. Se ocupa de:
 *
 * - bajar al final al abrir y cuando llega algo, salvo que se esté leyendo más
 *   arriba, en cuyo caso aparece «Mensajes nuevos»;
 * - cargar lo anterior al subir, sin que el hilo dé un salto;
 * - marcar lo leído mientras está a la vista;
 * - las acciones sobre cada mensaje: responder, reaccionar, editar, borrar.
 */
@Component({
  selector: 'app-chat-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonIcon,
    IonSpinner,
    AvatarComponent,
    RelativeTimePipe,
    ChatComposerComponent,
    ConversationAvatarComponent,
    MessageBubbleComponent,
  ],
  template: `
    @if (conversation(); as item) {
      <header class="head" [class.dock]="mode() === 'dock'">
        @if (mode() === 'page') {
          <button type="button" class="rs-icon-btn plain rs-mobile-only back" (click)="back()" [attr.aria-label]="'COMMON.BACK' | translate">
            <ion-icon name="arrow-back" />
          </button>
        }

        <button type="button" class="who" (click)="headerClick()">
          <app-conversation-avatar [conversation]="item" [size]="mode() === 'dock' ? 32 : 40" />
          <span class="rs-row-text">
            <span class="title">{{ title() }}</span>
            <span class="subtitle">
              @if (typingUsers().length) {
                {{ 'MESSENGER.TYPING' | translate }}
              } @else if (item.type === 'group') {
                {{ 'MESSENGER.MEMBER_COUNT' | translate: { count: item.members.length } }}
              } @else if (peerOnline()) {
                {{ 'PRESENCE.ACTIVE_NOW' | translate }}
              } @else if (peerLastSeen(); as seen) {
                {{ 'PRESENCE.ACTIVE_AGO' | translate: { time: (seen | relativeTime) } }}
              }
            </span>
          </span>
        </button>

        <span class="head-actions">
          <button type="button" class="rs-icon-btn plain accent" (click)="openInfo()" [attr.aria-label]="'MESSENGER.INFO' | translate">
            <ion-icon name="information-circle" />
          </button>
          @if (mode() === 'dock') {
            <button type="button" class="rs-icon-btn plain accent" (click)="minimize.emit()" [attr.aria-label]="'MESSENGER.MINIMIZE' | translate">
              <ion-icon name="remove" />
            </button>
            <button type="button" class="rs-icon-btn plain accent" (click)="closed.emit()" [attr.aria-label]="'CLOSE' | translate">
              <ion-icon name="close" />
            </button>
          }
        </span>
      </header>

      <div class="scroller" #scroller (scroll)="onScroll()">
        @if (thread().loadingOlder) {
          <div class="loading-older"><ion-spinner name="dots" /></div>
        }

        @if (thread().loaded && !thread().hasOlder) {
          <div class="intro">
            <app-conversation-avatar [conversation]="item" [size]="mode() === 'dock' ? 60 : 88" />
            <h3>{{ title() }}</h3>
            @if (item.peer; as peer) {
              <a class="rs-muted" [routerLink]="['/profile', peer.name]">{{ 'MESSENGER.VIEW_PROFILE' | translate }}</a>
            } @else {
              <span class="rs-muted">{{ 'MESSENGER.MEMBER_COUNT' | translate: { count: item.members.length } }}</span>
            }
          </div>
        }

        @if (!thread().loaded) {
          <div class="rs-empty"><ion-spinner /></div>
        }

        @for (row of rows(); track row.key) {
          @switch (row.kind) {
            @case ('day') {
              <div class="day">{{ row.label }}</div>
            }
            @case ('system') {
              <div class="system">{{ systemText(row.message) }}</div>
            }
            @case ('message') {
              <app-message-bubble
                [message]="row.message"
                [own]="row.own"
                [first]="row.first"
                [last]="row.last"
                [showAvatar]="row.showAvatar"
                [showName]="row.showName"
                [showStatus]="row.showStatus"
                [seenBy]="row.seenBy"
                [isGroup]="item.type === 'group'"
                (action)="onAction(row.message, $event)"
              />
            }
          }
        }

        @if (typingUsers().length) {
          <div class="typing">
            <app-avatar [user]="typingUsers()[0]" [size]="28" />
            <span class="dots"><span></span><span></span><span></span></span>
          </div>
        }
      </div>

      @if (unseenBelow()) {
        <button type="button" class="new-pill" (click)="scrollToBottom(true)">
          <ion-icon name="arrow-down" /> {{ 'MESSENGER.NEW_MESSAGES' | translate }}
        </button>
      }

      <app-chat-composer
        #composer
        [conversationId]="item.id"
        [readOnly]="item.readOnly"
        [replyTo]="replyTo()"
        [editing]="editing()"
        (send)="send($event)"
        (edit)="saveEdit($event)"
        (typing)="chat.typing(item.id)"
        (cancelReply)="replyTo.set(null)"
        (cancelEdit)="editing.set(null)"
      />
    } @else {
      <div class="rs-empty"><ion-spinner /></div>
    }
  `,
  styleUrl: './chat-thread.component.scss',
})
export class ChatThreadComponent implements OnDestroy {
  readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly translate = inject(TranslateService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  readonly conversationId = input.required<string>();
  readonly mode = input<'page' | 'dock'>('page');

  readonly closed = output<void>();
  readonly minimize = output<void>();

  readonly replyTo = signal<Message | null>(null);
  readonly editing = signal<Message | null>(null);
  readonly unseenBelow = signal(false);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<ChatComposerComponent>('composer');

  readonly conversation = computed(() => this.chat.conversation(this.conversationId())());
  readonly thread = computed(() => this.chat.thread(this.conversationId())());
  readonly typingUsers = computed(() => this.chat.typingIn(this.conversationId())());
  readonly title = computed(() => {
    const item = this.conversation();

    return item ? conversationTitle(item, this.auth.user()?.id) : '';
  });

  readonly peerOnline = computed(() => {
    const peer = this.conversation()?.peer;

    return peer ? this.presence.isOnline(peer.id)() : false;
  });

  readonly peerLastSeen = computed(() => {
    const peer = this.conversation()?.peer;

    return peer ? this.presence.lastSeen(peer.id)() : null;
  });

  readonly rows = computed<Row[]>(() => this.buildRows());

  /** Lo necesario para decidir cómo mover el hilo tras pintar. */
  private lastCount = 0;
  private lastNewestId: string | null = null;
  private oldestId: string | null = null;
  private heightBeforeOlder = 0;
  private focusedId: string | null = null;

  constructor() {
    // Al cambiar de conversación: se carga, se marca a la vista y se suelta la anterior.
    effect(() => {
      const id = this.conversationId();

      untracked(() => {
        if (this.focusedId) {
          this.chat.blur(this.focusedId);
        }

        this.focusedId = id;
        this.lastCount = 0;
        this.lastNewestId = null;
        this.oldestId = null;
        this.replyTo.set(null);
        this.editing.set(null);
        this.chat.focus(id);

        if (!this.chat.conversation(id)()) {
          void this.chat.fetchConversation(id).catch(() => this.feedback.toast('SERVER.NOT_FOUND', { color: 'danger' }));
        }

        void this.chat.openThread(id).catch((error: unknown) => this.feedback.error(error));
      });
    });

    // Tras cada pintado se ajusta el desplazamiento según lo que cambió.
    afterRenderEffect(() => {
      const messages = this.thread().messages;
      const element = this.scroller()?.nativeElement;

      if (!element || messages.length === 0) {
        return;
      }

      const newest = messages[messages.length - 1];
      const oldest = messages[0];

      if (this.lastCount === 0) {
        element.scrollTop = element.scrollHeight;
      } else if (oldest && this.oldestId && oldest.id !== this.oldestId && this.heightBeforeOlder) {
        // Se cargó lo anterior: se mantiene a la vista lo que se estaba leyendo.
        element.scrollTop += element.scrollHeight - this.heightBeforeOlder;
        this.heightBeforeOlder = 0;
      } else if (newest && newest.id !== this.lastNewestId) {
        const own = newest.sender.id === this.auth.user()?.id;
        const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICKY_BOTTOM_PX + 200;

        if (own || nearBottom) {
          element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
        } else {
          untracked(() => this.unseenBelow.set(true));
        }
      }

      this.lastCount = messages.length;
      this.lastNewestId = newest?.id ?? null;
      this.oldestId = oldest?.id ?? null;
    });
  }

  ngOnDestroy(): void {
    if (this.focusedId) {
      this.chat.blur(this.focusedId);
    }
  }

  onScroll(): void {
    const element = this.scroller()?.nativeElement;

    if (!element) {
      return;
    }

    if (element.scrollHeight - element.scrollTop - element.clientHeight < STICKY_BOTTOM_PX) {
      this.unseenBelow.set(false);
    }

    if (element.scrollTop < 200 && this.thread().hasOlder && !this.thread().loadingOlder && this.thread().loaded) {
      this.heightBeforeOlder = element.scrollHeight;
      void this.chat.loadOlder(this.conversationId()).catch(() => undefined);
    }
  }

  scrollToBottom(smooth = false): void {
    const element = this.scroller()?.nativeElement;
    element?.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.unseenBelow.set(false);
  }

  async send(outgoing: OutgoingMessage): Promise<void> {
    this.replyTo.set(null);
    await this.chat.send(this.conversationId(), outgoing);
  }

  async saveEdit(body: string): Promise<void> {
    const message = this.editing();
    this.editing.set(null);

    if (!message || body === message.body) {
      return;
    }

    try {
      await this.chat.edit(message, body);
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async onAction(message: ChatMessage, action: MessageAction): Promise<void> {
    try {
      switch (action.type) {
        case 'reply':
          this.replyTo.set(message);
          this.composer()?.focus();
          break;
        case 'react':
          await this.chat.react(message, action.emoji);
          break;
        case 'edit':
          this.editing.set(message);
          break;
        case 'copy':
          await navigator.clipboard.writeText(message.body ?? '');
          await this.feedback.toast('MESSENGER.COPIED');
          break;
        case 'delete':
          if (
            await this.feedback.confirm({
              header: 'MESSENGER.DELETE_FOR_ALL',
              message: 'MESSENGER.DELETE_FOR_ALL_MESSAGE',
              confirmText: 'DELETE',
              danger: true,
            })
          ) {
            await this.chat.deleteForEveryone(message);
          }
          break;
        case 'hide':
          await this.chat.hide(message);
          break;
        case 'retry':
          await this.chat.retry(message);
          break;
        case 'discard':
          await this.chat.discard(message);
          break;
        case 'report':
          await this.reports.report('message', message.id);
          break;
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  headerClick(): void {
    const peer = this.conversation()?.peer;

    if (peer && this.mode() === 'page') {
      void this.router.navigate(['/profile', peer.name]);
    } else {
      void this.openInfo();
    }
  }

  async openInfo(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: GroupInfoModalComponent,
      componentProps: { conversationId: this.conversationId() },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    const { data } = await modal.onWillDismiss<'left' | 'cleared'>();

    if (data === 'left') {
      this.closed.emit();

      if (this.mode() === 'page') {
        await this.router.navigateByUrl('/messages');
      }
    }
  }

  back(): void {
    void this.router.navigateByUrl('/messages');
  }

  systemText(message: ChatMessage): string {
    const system = message.system;

    if (!system) {
      return message.body ?? '';
    }

    const names = system.targets.map((user) => user.firstName || user.name).join(', ');

    return this.translate.instant(`MESSENGER.SYSTEM.${system.action.toUpperCase()}`, {
      actor: message.sender.firstName || message.sender.name,
      targets: names,
      value: system.value ?? '',
    }) as string;
  }

  private buildRows(): Row[] {
    const messages = this.thread().messages;
    const conversation = this.conversation();
    const me = this.auth.user()?.id;
    const locale = this.translate.currentLang() ?? 'es';
    const today = this.translate.instant('TIME.TODAY') as string;
    const yesterday = this.translate.instant('TIME.YESTERDAY') as string;
    const isGroup = conversation?.type === 'group';
    const rows: Row[] = [];

    // El último mensaje propio es el que lleva el estado de entrega; en una
    // conversación de dos, el último que la otra persona leyó lleva su carita.
    const lastOwn = [...messages].reverse().find((message) => message.sender.id === me && message.kind !== 'system');
    const peer = conversation?.type === 'direct' ? conversation.peer : null;
    const peerMember = peer ? conversation?.members.find((member) => member.user.id === peer.id) : null;
    const peerReadAt = peerMember?.lastReadAt ? Date.parse(peerMember.lastReadAt) : 0;
    const lastSeenOwn = peer
      ? [...messages]
          .reverse()
          .find((message) => message.sender.id === me && (message.status === 'read' || Date.parse(message.createdAt) <= peerReadAt))
      : undefined;

    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];

      if (!previous || !sameDay(previous.createdAt, message.createdAt)) {
        rows.push({ kind: 'day', key: `day:${message.createdAt.slice(0, 10)}:${message.id}`, label: dayLabel(message.createdAt, locale, today, yesterday) });
      }

      if (message.kind === 'system') {
        rows.push({ kind: 'system', key: message.clientId ?? message.id, message });

        return;
      }

      const own = message.sender.id === me;
      const joinsPrevious =
        !!previous &&
        previous.kind !== 'system' &&
        previous.sender.id === message.sender.id &&
        Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_GAP_MS &&
        sameDay(previous.createdAt, message.createdAt);
      const joinsNext =
        !!next &&
        next.kind !== 'system' &&
        next.sender.id === message.sender.id &&
        Date.parse(next.createdAt) - Date.parse(message.createdAt) < GROUP_GAP_MS &&
        sameDay(next.createdAt, message.createdAt);

      rows.push({
        kind: 'message',
        // El `clientId` mantiene la misma fila cuando la copia optimista se
        // cambia por la del servidor: sin él, la burbuja parpadearía.
        key: message.clientId ?? message.id,
        message,
        own,
        first: !joinsPrevious,
        last: !joinsNext,
        showAvatar: !own && !joinsNext,
        showName: isGroup && !own && !joinsPrevious,
        showStatus: message === lastOwn || message.status === 'failed',
        seenBy: peer && message === lastSeenOwn ? peer : null,
      });
    });

    return rows;
  }
}
