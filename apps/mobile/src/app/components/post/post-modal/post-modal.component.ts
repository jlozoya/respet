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
import type { Post } from '@respet/shared';

import { CarouselComponent } from '../../gallery/carousel/carousel.component';
import { PostCardComponent } from '../post-card/post-card.component';
import { PostCommentsComponent } from '../post-comments/post-comments.component';

/**
 * Detalle de una publicación en una ventana: fotos y comentarios juntos.
 *
 * Antes eran dos cosas distintas —el visor enseñaba la foto a pantalla completa
 * y el hilo vivía en otra pantalla—, así que para leer un comentario sobre lo
 * que se estaba mirando había que cerrar la foto. Aquí conviven: en pantalla
 * ancha, la foto a un lado y la conversación al otro; en el móvil, una debajo
 * de la otra.
 *
 * La tarjeta se reutiliza tal cual, sin sus fotos, que ya están arriba: así los
 * votos, el menú y el resto de acciones no se escriben dos veces.
 */
@Component({
  selector: 'app-post-modal',
  templateUrl: './post-modal.component.html',
  styleUrls: ['./post-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    CarouselComponent,
    PostCardComponent,
    PostCommentsComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
})
export class PostModalComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly post = input.required<Post>();
  readonly startIndex = input(0);

  /** Copia viva: dentro se puede votar, comentar o editar. */
  private readonly overrides = signal<Post | null>(null);
  readonly current = computed(() => this.overrides() ?? this.post());
  readonly images = computed(() => this.current().media);

  /** Índice visible, que el carrusel va cantando. */
  readonly currentIndex = signal(0);

  onUpdated(post: Post): void {
    this.overrides.set(post);
  }

  /** El hilo avisa de su total: el contador de la tarjeta lo refleja. */
  onCounted(total: number): void {
    const post = this.current();

    if (post.commentCount !== total) {
      this.overrides.set({ ...post, commentCount: total });
    }
  }

  /**
   * Devuelve la publicación al cerrarse.
   *
   * Quien abrió la ventana enseña la misma tarjeta por debajo; sin esto, los
   * votos y los comentarios de aquí dentro no se verían al volver al muro.
   */
  dismiss(): void {
    void this.modalCtrl.dismiss(this.current());
  }

  /** Borrada la publicación, la ventana ya no tiene nada que enseñar. */
  onDeleted(): void {
    void this.modalCtrl.dismiss();
  }
}
