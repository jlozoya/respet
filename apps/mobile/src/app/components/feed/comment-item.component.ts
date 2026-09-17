import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Comment } from '@respet/shared';

import { PostsService } from '../../core/api/posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { RichTextComponent } from '../../shared/components/rich-text.component';
import { UserNameComponent } from '../../shared/components/user-name.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

/**
 * Un comentario, con sus respuestas plegadas debajo.
 *
 * La burbuja gris con el nombre en negrita y, debajo, «Me gusta · Responder ·
 * hace 2 h», como en Facebook. Las respuestas se piden al desplegarlas; un
 * comentario no anida más de un nivel, igual que allí.
 */
@Component({
  selector: 'app-comment-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonIcon,
    IonSpinner,
    AvatarComponent,
    RichTextComponent,
    UserNameComponent,
    CompactNumberPipe,
    RelativeTimePipe,
  ],
  template: `
    @let item = comment();
    <div class="comment" [class.reply]="isReply()">
      <app-avatar [user]="item.author" [size]="isReply() ? 28 : 34" />

      <div class="main">
        @if (editing()) {
          <div class="edit">
            <textarea rows="2" [value]="draft()" (input)="draft.set($any($event.target).value)" (keydown.escape)="editing.set(false)"></textarea>
            <span class="rs-small">
              <button type="button" class="rs-text-btn" (click)="saveEdit()">{{ 'SAVE' | translate }}</button> ·
              <button type="button" class="rs-text-btn" (click)="editing.set(false)">{{ 'CANCEL' | translate }}</button>
            </span>
          </div>
        } @else {
          <div class="bubble-wrap">
            <div class="bubble" [class.deleted]="item.deleted">
              <app-user-name class="author" [user]="item.author" />
              @if (item.deleted) {
                <span class="rs-muted">{{ 'COMMENTS_SECTION.DELETED' | translate }}</span>
              } @else {
                <app-rich-text [text]="item.body" [clamp]="300" />
              }
            </div>
            @if (likeCount() > 0) {
              <span class="likes"><span class="heart">👍</span>{{ likeCount() | compactNumber }}</span>
            }
            @if (!item.deleted) {
              <button type="button" class="rs-icon-btn plain more" (click)="menu()" [attr.aria-label]="'COMMON.OPTIONS' | translate">
                <ion-icon name="ellipsis-horizontal" />
              </button>
            }
          </div>

          @if (!item.deleted) {
            <div class="actions">
              <button type="button" class="rs-text-btn" [class.liked]="liked()" (click)="toggleLike()">{{ 'REACTIONS.LIKE' | translate }}</button>
              @if (canReply()) {
                <button type="button" class="rs-text-btn" (click)="reply.emit(item)">{{ 'COMMENTS_SECTION.REPLY' | translate }}</button>
              }
              <span class="time">{{ item.createdAt | relativeTime }}</span>
              @if (item.editedAt) {
                <span class="time">{{ 'COMMENTS_SECTION.EDITED' | translate }}</span>
              }
            </div>
          }
        }

        @if (!isReply() && item.replyCount > 0 && !repliesOpen()) {
          <button type="button" class="rs-text-btn show-replies" (click)="toggleReplies.emit(item)">
            <ion-icon name="return-down-forward" />
            {{ 'COMMENTS_SECTION.VIEW_REPLIES' | translate: { count: item.replyCount } }}
          </button>
        }
        @if (loadingReplies()) {
          <ion-spinner name="dots" />
        }
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .comment {
      display: flex;
      gap: 6px;
      padding: 4px 0;
    }

    .main {
      flex: 1 1 auto;
      min-width: 0;
    }

    .bubble-wrap {
      align-items: center;
      display: flex;
      gap: 4px;
      position: relative;
    }

    .bubble {
      background: var(--rs-surface-2);
      border-radius: 18px;
      font-size: 0.9375rem;
      max-width: 100%;
      padding: 8px 12px;
    }

    .author {
      display: flex;
      font-size: 0.8125rem;
    }

    .likes {
      align-items: center;
      align-self: flex-end;
      background: var(--rs-surface);
      border-radius: 999px;
      box-shadow: var(--rs-shadow-1);
      color: var(--rs-text-2);
      display: inline-flex;
      font-size: 0.75rem;
      gap: 2px;
      margin: 0 0 -6px -18px;
      padding: 1px 5px;
    }

    .heart {
      font-size: 0.75rem;
    }

    .more {
      height: 30px;
      opacity: 0;
      width: 30px;
    }

    .bubble-wrap:hover .more,
    .more:focus-visible {
      opacity: 1;
    }

    @media (hover: none) {
      .more {
        opacity: 1;
      }
    }

    .actions {
      align-items: center;
      display: flex;
      gap: 12px;
      padding: 2px 12px;
    }

    .liked {
      color: var(--ion-color-primary);
    }

    .time {
      color: var(--rs-text-2);
      font-size: 0.75rem;
    }

    .show-replies {
      align-items: center;
      display: inline-flex;
      gap: 6px;
      padding: 4px 12px;
    }

    .edit textarea {
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 14px;
      color: inherit;
      font: inherit;
      padding: 8px 12px;
      resize: vertical;
      width: 100%;
    }
  `,
})
export class CommentItemComponent {
  private readonly posts = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);

  readonly comment = input.required<Comment>();
  /** El autor de la publicación, que puede retirar cualquier comentario de ella. */
  readonly postAuthorId = input<string | null>(null);
  readonly canReply = input(true);
  readonly repliesOpen = input(false);
  readonly loadingReplies = input(false);

  readonly reply = output<Comment>();
  readonly toggleReplies = output<Comment>();
  readonly changed = output<Comment>();
  readonly removed = output<Comment>();

  readonly editing = signal(false);
  readonly draft = signal('');
  private readonly likeOverride = signal<{ liked: boolean; count: number } | null>(null);

  readonly isReply = computed(() => this.comment().parentId !== null);
  readonly liked = computed(() => this.likeOverride()?.liked ?? this.comment().likedByMe);
  readonly likeCount = computed(() => this.likeOverride()?.count ?? this.comment().likeCount);

  async toggleLike(): Promise<void> {
    const liked = this.liked();
    const count = this.likeCount();
    this.likeOverride.set({ liked: !liked, count: count + (liked ? -1 : 1) });

    try {
      const result = liked ? await this.posts.unlikeComment(this.comment().id) : await this.posts.likeComment(this.comment().id);
      this.likeOverride.set({ liked: result.likedByMe, count: result.likeCount });
    } catch (error) {
      this.likeOverride.set({ liked, count });
      await this.feedback.error(error);
    }
  }

  async menu(): Promise<void> {
    const item = this.comment();
    const me = this.auth.user()?.id;
    const own = item.author.id === me;
    const canDelete = own || this.postAuthorId() === me || this.auth.isAdmin();
    const t = (key: string) => this.translate.instant(key) as string;

    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        ...(own ? [{ text: t('EDIT'), icon: 'create-outline', data: 'edit' }] : []),
        ...(canDelete ? [{ text: t('DELETE'), icon: 'trash-outline', role: 'destructive', data: 'delete' }] : []),
        ...(!own ? [{ text: t('REPORT'), icon: 'flag-outline', data: 'report' }] : []),
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    if (data === 'edit') {
      this.draft.set(item.body);
      this.editing.set(true);
    } else if (data === 'delete') {
      await this.remove();
    } else if (data === 'report') {
      await this.reports.report('comment', item.id);
    }
  }

  async saveEdit(): Promise<void> {
    const body = this.draft().trim();

    if (!body) {
      return;
    }

    try {
      const updated = await this.posts.updateComment(this.comment().id, { body });
      this.editing.set(false);
      this.changed.emit(updated);
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async remove(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'COMMENTS_SECTION.DELETE_TITLE',
      message: 'COMMENTS_SECTION.DELETE_MESSAGE',
      confirmText: 'DELETE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.posts.removeComment(this.comment().id);
      this.removed.emit(this.comment());
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
