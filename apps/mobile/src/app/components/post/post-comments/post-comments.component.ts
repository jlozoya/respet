import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonProgressBar } from '@ionic/angular/ion-progress-bar';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Comment } from '@respet/shared';

import { CommentsService } from '../../../core/api/content.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { EntityMenuComponent } from '../../../shared/components/entity-menu.component';

/** Comentarios por página. */
const PER_PAGE = 20;

/**
 * Hilo de comentarios de una publicación.
 *
 * Va empotrado en la página de detalle. Avisa del total cada vez que cambia,
 * para que la pantalla que lo contiene mantenga su contador al día sin tener
 * que volver a preguntar al servidor.
 */
@Component({
  selector: 'app-post-comments',
  templateUrl: './post-comments.component.html',
  styleUrls: ['./post-comments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    IonButton,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonIcon,
    IonTextarea,
    IonProgressBar,
  ],
})
export class PostCommentsComponent {
  private readonly comments = inject(CommentsService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly translate = inject(TranslateService);
  private readonly popoverCtrl = inject(PopoverController);
  private readonly alertCtrl = inject(AlertController);

  readonly postId = input.required<string>();

  /** Cuántos comentarios hay ahora mismo, cada vez que la cifra cambia. */
  readonly counted = output<number>();

  readonly items = signal<readonly Comment[]>([]);
  readonly loading = signal(false);
  readonly hasMore = signal(false);
  readonly total = signal(0);

  draft = '';

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canSend = computed(() => this.draft.trim().length > 0);

  private page = 1;

  constructor() {
    // Dentro de un efecto, y no en el constructor: una entrada obligatoria no
    // tiene valor todavía cuando el componente se construye, y leerla allí
    // lanzaba un error que acababa en un aviso rojo en vez de en el hilo.
    // Así, además, cambiar de publicación recarga los comentarios.
    effect(() => {
      this.postId();

      untracked(() => {
        this.items.set([]);
        void this.load({ reset: true });
      });
    });
  }

  avatarOf(comment: Comment): string {
    return comment.author.avatar?.url ?? './assets/imgs/avatar.png';
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }

  /** Sólo el autor —o quien administra— toca un comentario. */
  canEdit(comment: Comment): boolean {
    if (comment.deleted) {
      return false;
    }

    return comment.author.id === this.auth.user()?.id || this.auth.isAdmin();
  }

  async loadMore(): Promise<void> {
    await this.load({ reset: false });
  }

  /**
   * Envía con Enter, salta de línea con Mayúsculas+Enter.
   *
   * En el móvil el teclado manda su propio salto de línea y no llega aquí, así
   * que el atajo sólo afecta a quien escribe con teclado físico.
   */
  onEnter(event: Event): void {
    const key = event as KeyboardEvent;

    if (key.shiftKey) {
      return;
    }

    key.preventDefault();

    if (this.canSend()) {
      void this.send();
    }
  }

  async send(): Promise<void> {
    const body = this.draft.trim();

    if (!body) {
      return;
    }

    try {
      const created = await this.comments.create(this.postId(), { body });

      this.items.update((current) => [...current, created]);
      this.total.update((count) => count + 1);
      this.counted.emit(this.total());
      this.draft = '';
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async openMenu(event: Event, comment: Comment): Promise<void> {
    const popover = await this.popoverCtrl.create({
      component: EntityMenuComponent,
      componentProps: { canUpdate: true, canDelete: true },
      event,
    });

    await popover.present();

    const { data } = await popover.onWillDismiss<'update' | 'delete'>();

    if (data === 'update') {
      await this.edit(comment);
    } else if (data === 'delete') {
      await this.remove(comment);
    }
  }

  private async edit(comment: Comment): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('COMMENTS.EDIT') as string,
      inputs: [{ name: 'body', type: 'textarea', value: comment.body }],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ACCEPT') as string, role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: { body: string } }>();
    const body = data?.values.body?.trim();

    if (role !== 'confirm' || !body || body === comment.body) {
      return;
    }

    try {
      const updated = await this.comments.update(comment.id, { body });

      this.items.update((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async remove(comment: Comment): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'COMMENTS.DELETE_TITLE',
      message: 'COMMENTS.DELETE_MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.comments.remove(comment.id);

      // El servidor lo conserva marcado como retirado, así que el hilo no se
      // reordena: aquí se refleja igual, sin quitar la fila.
      this.items.update((current) =>
        current.map((item) =>
          item.id === comment.id ? { ...item, deleted: true, body: '' } : item,
        ),
      );
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.comments.list(this.postId(), {
        page: this.page,
        perPage: PER_PAGE,
      });

      this.items.update((current) =>
        options.reset ? result.data : [...current, ...result.data],
      );
      this.total.set(result.meta.total);
      this.counted.emit(result.meta.total);
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      await this.feedback.error(error);
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
