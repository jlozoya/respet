import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Comment, Post } from '@social-network/shared';

import { PostsService } from '../../core/api/posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { CommentItemComponent } from './comment-item.component';

const PAGE_SIZE = 10;

interface ReplyState {
  items: Comment[];
  loading: boolean;
}

/**
 * Los comentarios de una publicación y la caja para escribir uno.
 *
 * En el muro arranca con los últimos que trae la propia publicación y pide el
 * resto al pulsar «Ver más comentarios»; en el detalle, con `expanded`, los
 * pide desde el principio. Las respuestas cuelgan de su comentario y se
 * cargan al desplegarlas.
 */
@Component({
  selector: 'app-comments-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, IonSpinner, AvatarComponent, CommentItemComponent],
  template: `
    @if (hasMore() && !loading()) {
      <button type="button" class="rs-text-btn load-more" (click)="loadMore()">
        {{
          (loaded() ? 'COMMENTS_SECTION.VIEW_MORE' : 'COMMENTS_SECTION.VIEW_ALL')
            | translate: { count: post().commentCount }
        }}
      </button>
    }
    @if (loading()) {
      <div class="center"><ion-spinner name="dots" /></div>
    }

    @for (comment of comments(); track comment.id) {
      <app-comment-item
        [comment]="comment"
        [postAuthorId]="post().author.id"
        [canReply]="!post().commentsDisabled"
        [repliesOpen]="hasReplies(comment.id)"
        [loadingReplies]="loadingReplies(comment.id)"
        (reply)="startReply($event)"
        (toggleReplies)="openReplies($event)"
        (changed)="replace($event)"
        (removed)="remove($event)"
      >
        @for (reply of repliesOf(comment.id); track reply.id) {
          <app-comment-item
            [comment]="reply"
            [postAuthorId]="post().author.id"
            [canReply]="!post().commentsDisabled"
            (reply)="startReply($event)"
            (changed)="replace($event)"
            (removed)="remove($event)"
          />
        }
      </app-comment-item>
    }

    @if (post().commentsDisabled) {
      <p class="rs-small rs-muted disabled">{{ 'COMMENTS_SECTION.DISABLED' | translate }}</p>
    } @else if (auth.user(); as me) {
      <form class="composer" (submit)="submit($event)">
        <app-avatar [user]="me" [size]="32" />
        <div class="field">
          @if (replyingTo(); as target) {
            <span class="replying rs-small">
              {{
                'COMMENTS_SECTION.REPLYING_TO'
                  | translate: { name: target.author.firstName || target.author.name }
              }}
              <button type="button" class="rs-text-btn" (click)="replyingTo.set(null)">
                {{ 'CANCEL' | translate }}
              </button>
            </span>
          }
          <span class="input-row">
            <textarea
              #input
              rows="1"
              maxlength="2000"
              [value]="draft()"
              (input)="onInput($any($event.target))"
              (keydown.enter)="onEnter($any($event))"
              [placeholder]="'COMMENTS_SECTION.PLACEHOLDER' | translate"
              [attr.aria-label]="'COMMENTS_SECTION.PLACEHOLDER' | translate"
            ></textarea>
            <button
              type="submit"
              class="send"
              [disabled]="!draft().trim() || sending()"
              [attr.aria-label]="'SEND' | translate"
            >
              <ion-icon name="send" />
            </button>
          </span>
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 4px 16px 12px;
    }

    .load-more {
      font-size: 0.9375rem;
      padding: 6px 0;
    }

    .center {
      display: flex;
      justify-content: center;
    }

    .disabled {
      padding: 8px 0;
    }

    .composer {
      align-items: flex-start;
      display: flex;
      gap: 6px;
      padding-top: 6px;
    }

    .field {
      background: var(--rs-surface-2);
      border-radius: 18px;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
      padding: 6px 6px 6px 12px;
    }

    .replying {
      color: var(--rs-text-2);
    }

    .input-row {
      align-items: flex-end;
      display: flex;
      gap: 4px;
    }

    textarea {
      background: transparent;
      border: 0;
      color: inherit;
      flex: 1 1 auto;
      font: inherit;
      font-size: 0.9375rem;
      max-height: 120px;
      outline: none;
      padding: 3px 0;
      resize: none;
    }

    .send {
      background: none;
      border: 0;
      color: var(--ion-color-primary);
      cursor: pointer;
      font-size: 18px;
      padding: 4px 6px;
    }

    .send:disabled {
      color: var(--rs-text-3);
      cursor: default;
    }
  `,
})
export class CommentsSectionComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly posts = inject(PostsService);
  private readonly feedback = inject(FeedbackService);

  readonly post = input.required<Post>();
  /** Pide todos los comentarios desde el principio, para el detalle. */
  readonly expanded = input(false);

  readonly comments = signal<Comment[]>([]);
  readonly replies = signal<Record<string, ReplyState>>({});
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly page = signal(0);
  readonly lastPage = signal(1);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly replyingTo = signal<Comment | null>(null);

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  readonly hasMore = computed(() =>
    this.loaded()
      ? this.page() < this.lastPage()
      : this.post().commentCount > this.comments().length,
  );

  ngOnInit(): void {
    // Los de la vista previa ya llegan en orden de lectura: el más antiguo arriba.
    this.comments.set(this.post().commentPreview);

    if (this.expanded()) {
      void this.loadMore();
    }
  }

  hasReplies(commentId: string): boolean {
    return commentId in this.replies();
  }

  repliesOf(commentId: string): Comment[] {
    return this.replies()[commentId]?.items ?? [];
  }

  loadingReplies(commentId: string): boolean {
    return this.replies()[commentId]?.loading ?? false;
  }

  focus(): void {
    this.input()?.nativeElement.focus();
  }

  async loadMore(): Promise<void> {
    this.loading.set(true);

    try {
      const next = this.page() + 1;
      const result = await this.posts.comments(this.post().id, { page: next, perPage: PAGE_SIZE });
      const known = this.loaded() ? this.comments() : [];
      const ids = new Set(known.map((item) => item.id));

      this.comments.set([...known, ...result.data.filter((item) => !ids.has(item.id))]);
      this.page.set(next);
      this.lastPage.set(result.meta.lastPage);
      this.loaded.set(true);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async openReplies(comment: Comment): Promise<void> {
    this.replies.update((current) => ({
      ...current,
      [comment.id]: { items: current[comment.id]?.items ?? [], loading: true },
    }));

    try {
      const result = await this.posts.comments(this.post().id, {
        parentId: comment.id,
        perPage: 50,
      });
      this.replies.update((current) => ({
        ...current,
        [comment.id]: { items: result.data, loading: false },
      }));
    } catch (error) {
      this.replies.update((current) => ({
        ...current,
        [comment.id]: { items: [], loading: false },
      }));
      await this.feedback.error(error);
    }
  }

  startReply(comment: Comment): void {
    // Responder a una respuesta cuelga del mismo comentario raíz, como en Facebook.
    const root = comment.parentId
      ? (this.comments().find((item) => item.id === comment.parentId) ?? comment)
      : comment;
    this.replyingTo.set(root);

    if (comment.parentId && !this.draft().includes(`@${comment.author.name}`)) {
      this.draft.set(`@${comment.author.name} ${this.draft()}`);
    }

    this.focus();
  }

  onInput(element: HTMLTextAreaElement): void {
    this.draft.set(element.value);
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }

  onEnter(event: KeyboardEvent): void {
    if (event.shiftKey || window.matchMedia('(hover: none)').matches) {
      return;
    }

    event.preventDefault();
    void this.send();
  }

  submit(event: Event): void {
    event.preventDefault();
    void this.send();
  }

  replace(updated: Comment): void {
    const swap = (items: Comment[]) =>
      items.map((item) => (item.id === updated.id ? updated : item));

    this.comments.update(swap);
    this.replies.update((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, state]) => [
          key,
          { ...state, items: swap(state.items) },
        ]),
      ),
    );
  }

  remove(removed: Comment): void {
    this.replace({ ...removed, deleted: true, body: '' });
  }

  private async send(): Promise<void> {
    const body = this.draft().trim();

    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    const parent = this.replyingTo();

    try {
      const created = await this.posts.createComment(this.post().id, {
        body,
        parentId: parent?.id,
      });

      if (parent) {
        this.replies.update((current) => ({
          ...current,
          [parent.id]: { items: [...(current[parent.id]?.items ?? []), created], loading: false },
        }));
        this.comments.update((items) =>
          items.map((item) =>
            item.id === parent.id ? { ...item, replyCount: item.replyCount + 1 } : item,
          ),
        );
      } else {
        this.comments.update((items) => [...items, created]);
      }

      this.posts.emitUpdate(this.post().id, { commentCount: this.post().commentCount + 1 });
      this.draft.set('');
      this.replyingTo.set(null);

      const element = this.input()?.nativeElement;

      if (element) {
        element.style.height = 'auto';
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.sending.set(false);
    }
  }
}
