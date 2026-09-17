import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Post } from '@respet/shared';

import { PostCardComponent } from '../../components/feed/post-card.component';
import { ApiError } from '../../core/api/api-error';
import { PostsService } from '../../core/api/posts.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Una publicación sola, con todos sus comentarios: el destino de los enlaces
 * compartidos y de los avisos.
 */
@Component({
  selector: 'app-post-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, IonIcon, IonButton, IonSpinner, PageHeaderComponent, PostCardComponent],
  template: `
    <app-page-header title="POST.TITLE" />

    <ion-content>
      <div class="rs-container">
        @if (post(); as item) {
          <app-post-card [post]="item" [detail]="true" />
        } @else if (error(); as code) {
          <div class="rs-empty">
            <ion-icon [name]="code === 'SERVER.PRIVATE_CONTENT' ? 'lock-closed-outline' : 'document-outline'" />
            <h3>{{ (code === 'SERVER.PRIVATE_CONTENT' ? 'POST.PRIVATE_TITLE' : 'POST.NOT_FOUND_TITLE') | translate }}</h3>
            <p>{{ (code === 'SERVER.PRIVATE_CONTENT' ? 'POST.PRIVATE' : 'POST.NOT_FOUND') | translate }}</p>
            <ion-button routerLink="/">{{ 'NAV_TO_MAIN_PAGE' | translate }}</ion-button>
          </div>
        } @else {
          <div class="rs-empty"><ion-spinner /></div>
        }
      </div>
    </ion-content>
  `,
})
export class PostDetailPage {
  private readonly posts = inject(PostsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  readonly post = signal<Post | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });

    this.posts.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((change) => {
      const current = this.post();

      if (!current || change.type === 'created') {
        return;
      }

      if (change.type === 'deleted' && change.id === current.id) {
        this.post.set(null);
        this.error.set('SERVER.NOT_FOUND');
      } else if (change.type === 'updated' && change.id === current.id) {
        this.post.set({ ...current, ...change.changes });
      }
    });
  }

  private async load(id: string): Promise<void> {
    this.post.set(null);
    this.error.set(null);

    try {
      this.post.set(await this.posts.findById(id));
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.code : 'SERVER.ERROR');
    }
  }
}
