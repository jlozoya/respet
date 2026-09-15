import { ChangeDetectionStrategy, Component, inject, input, signal, untracked } from '@angular/core';
import { effect } from '@angular/core';
import { Router } from '@angular/router';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonCardTitle } from '@ionic/angular/ion-card-title';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonProgressBar } from '@ionic/angular/ion-progress-bar';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { TranslatePipe } from '@ngx-translate/core';
import type { Post } from '@respet/shared';

import { PostsService } from '../../core/api/content.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { PostCardComponent } from '../../components/post/post-card/post-card.component';
import { PostCommentsComponent } from '../../components/post/post-comments/post-comments.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Detalle de una publicación, con su hilo de comentarios.
 *
 * Es el destino de los enlaces que genera el botón de compartir, que hasta
 * ahora apuntaban a una ruta que no existía.
 */
@Component({
  selector: 'app-post-detail',
  templateUrl: './post.page.html',
  styleUrls: ['./post.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    PostCardComponent,
    PostCommentsComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonProgressBar,
  ],
})
export class PostPage {
  private readonly posts = inject(PostsService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly post = signal<Post | null>(null);
  readonly loading = signal(true);

  constructor() {
    // La carga va dentro de `untracked` porque lee señales que ella misma
    // escribe; sin aislarla el efecto se dispararía a sí mismo sin parar.
    effect(() => {
      const postId = this.id();

      untracked(() => void this.load(postId));
    });
  }

  async refresh(event: Event): Promise<void> {
    await this.load(this.id());
    void (event.target as HTMLIonRefresherElement).complete();
  }

  onUpdated(post: Post): void {
    this.post.set(post);
  }

  /** Borrada la publicación, esta pantalla ya no tiene nada que enseñar. */
  async onDeleted(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  /** El hilo avisa de su total: la tarjeta de arriba refleja la cifra. */
  onCounted(total: number): void {
    this.post.update((current) =>
      current === null || current.commentCount === total
        ? current
        : { ...current, commentCount: total },
    );
  }

  private async load(postId: string): Promise<void> {
    if (!postId) {
      this.loading.set(false);

      return;
    }

    this.loading.set(true);

    try {
      this.post.set(await this.posts.findById(postId));
    } catch (error) {
      this.post.set(null);
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }
}
