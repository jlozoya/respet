import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation } from '@respet/shared';

import { ChatWindowComponent } from '../../../components/chat/chat-window/chat-window.component';
import { ChatService } from '../../../core/api/chat.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

/** Cuándo caben la lista y el hilo, uno al lado del otro. */
const DOS_COLUMNAS = '(min-width: 992px)';

/**
 * Bandeja de conversaciones.
 *
 * Lista y conversación en la misma pantalla, como en Instagram: se elige a la
 * izquierda y se lee a la derecha, sin perder de vista el resto de hilos. En
 * una pantalla estrecha no caben las dos, así que la lista se queda sola y
 * elegir lleva al hilo a pantalla completa, que es de donde venimos.
 */
@Component({
  selector: 'app-conversations',
  templateUrl: './conversations.page.html',
  styleUrls: ['./conversations.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    RelativeTimePipe,
    PageHeaderComponent,
    ChatWindowComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
  ],
})
export class ConversationsPage {
  private readonly chat = inject(ChatService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Conversación de la dirección, cuando se llega a una concreta. */
  readonly id = input<string | null>(null);

  readonly search = signal('');
  readonly loading = signal(true);
  /** La que se está leyendo en el panel de al lado. */
  readonly selected = signal<string | null>(null);

  private readonly wide = signal(matchMedia(DOS_COLUMNAS).matches);

  readonly items = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.chat.conversations();

    if (!term) {
      return all;
    }

    return all.filter((item) => item.peer.name.toLowerCase().includes(term));
  });

  constructor() {
    const consulta = matchMedia(DOS_COLUMNAS);
    const alCambiar = (evento: MediaQueryListEvent): void => this.wide.set(evento.matches);

    consulta.addEventListener('change', alCambiar);
    this.destroyRef.onDestroy(() => consulta.removeEventListener('change', alCambiar));

    // Al llegar desde un enlace a una conversación, se abre en el panel.
    this.selected.set(this.id() ?? null);

    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);

    try {
      await this.chat.start();
      await this.chat.loadConversations();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(event: Event): Promise<void> {
    await this.load();
    void (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Abre una conversación donde haya sitio.
   *
   * Con dos columnas, al lado de la lista; sin ellas, en su propia pantalla,
   * que es lo único que cabe.
   */
  open(conversation: Conversation): void {
    if (this.wide()) {
      this.selected.set(conversation.id);

      return;
    }

    void this.router.navigate(['/chat', conversation.id]);
  }

  avatarOf(conversation: Conversation): string {
    return conversation.peer.avatar?.url ?? './assets/imgs/avatar.png';
  }

  isOnline(conversation: Conversation): boolean {
    return this.chat.isOnline(conversation.peer.id);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }
}
