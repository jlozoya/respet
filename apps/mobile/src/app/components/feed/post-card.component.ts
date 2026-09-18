import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Post, ReactionType } from '@social-network/shared';

import { PostsService } from '../../core/api/posts.service';
import { SocialService } from '../../core/api/social.service';
import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { ShareService } from '../../core/ui/share.service';
import { SendToChatModalComponent } from '../chat/send-to-chat-modal.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { MediaGridComponent } from '../../shared/components/media-grid.component';
import { RichTextComponent } from '../../shared/components/rich-text.component';
import { UserListModalComponent, type UserListPage } from '../../shared/components/user-list-modal.component';
import { UserNameComponent } from '../../shared/components/user-name.component';
import { describeLocation } from '../../shared/location-text';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { fullName } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { audienceIcon } from '../../shared/utils/audience';
import { reactionEmoji } from '../../shared/utils/reactions';
import { CommentsSectionComponent } from './comments-section.component';
import { CreateService } from './create.service';
import { ReactionButtonComponent } from './reaction-button.component';
import { SharedPostPreviewComponent } from './shared-post-preview.component';

/**
 * Una publicación del muro, la tarjeta de Facebook.
 *
 * Cabecera con autor, fecha, público y menú; el texto con sus #etiquetas; las
 * fotos o la publicación compartida; las cifras de reacciones, comentarios y
 * veces compartida; la barra «Me gusta · Comentar · Compartir», y debajo los
 * últimos comentarios con la caja para escribir.
 *
 * Las reacciones cambian en el acto y se corrigen con lo que diga el servidor.
 */
@Component({
  selector: 'app-post-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonIcon,
    AvatarComponent,
    MediaGridComponent,
    RichTextComponent,
    UserNameComponent,
    CompactNumberPipe,
    RelativeTimePipe,
    CommentsSectionComponent,
    ReactionButtonComponent,
    SharedPostPreviewComponent,
  ],
  template: `
    @let item = view();
    <article class="rs-card card">
      <header class="head">
        <a [routerLink]="['/profile', item.author.name]" class="avatar-link">
          <app-avatar [user]="item.author" [size]="40" />
        </a>
        <div class="meta">
          <span class="line">
            <app-user-name [user]="item.author" />
            @if (item.sharedPost || item.sharedPostUnavailable) {
              <span class="rs-muted">{{ 'POST.SHARED_A_POST' | translate }}</span>
            }
            @if (item.authorFollowState === 'none' && !isOwn()) {
              · <button type="button" class="follow" (click)="follow()">{{ 'FOLLOW.FOLLOW' | translate }}</button>
            }
          </span>
          <span class="sub">
            <a [routerLink]="['/post', item.id]" class="date">{{ item.createdAt | relativeTime }}</a>
            @if (item.editedAt) {
              · <span>{{ 'POST.EDITED' | translate }}</span>
            }
            · <ion-icon [name]="audience()" />
            @if (item.kind !== 'general') {
              · <span class="kind">{{ 'POST_KINDS.' + item.kind.toUpperCase() | translate }}</span>
            }
          </span>
        </div>
        <button type="button" class="rs-icon-btn plain" (click)="menu()" [attr.aria-label]="'COMMON.OPTIONS' | translate">
          <ion-icon name="ellipsis-horizontal" />
        </button>
      </header>

      @if (item.description) {
        <app-rich-text class="text" [class.big]="bigText()" [text]="item.description" [clamp]="detail() ? 0 : 480" />
      }

      @if (item.location; as place) {
        <div class="place rs-small rs-muted">
          <ion-icon name="location" /> {{ placeLabel(item) }}
        </div>
      }

      @if (item.sharedPost || item.sharedPostUnavailable) {
        <app-shared-post-preview class="shared" [post]="item.sharedPost" />
      }

      @if (item.media.length) {
        <app-media-grid class="media" [media]="item.media" />
      }

      @if (item.reactionCount || item.commentCount || item.shareCount) {
        <div class="stats">
          @if (item.reactionCount) {
            <button type="button" class="reactions" (click)="showReactors()">
              <span class="emojis">
                @for (entry of topReactions(); track entry.type) {
                  <span class="emoji">{{ emoji(entry.type) }}</span>
                }
              </span>
              <span>{{ reactionText() }}</span>
            </button>
          }
          <span class="counts">
            @if (item.commentCount) {
              <button type="button" (click)="openComments()">{{ 'POST.COMMENT_COUNT' | translate: { count: (item.commentCount | compactNumber) } }}</button>
            }
            @if (item.shareCount) {
              <span>{{ 'POST.SHARE_COUNT' | translate: { count: (item.shareCount | compactNumber) } }}</span>
            }
          </span>
        </div>
      }

      <div class="actions">
        <app-reaction-button [reaction]="item.myReaction" (react)="react($event)" />
        <button type="button" class="action" (click)="openComments()" [disabled]="item.commentsDisabled && !item.commentCount">
          <ion-icon name="chatbubble-outline" /> {{ 'POST.COMMENT' | translate }}
        </button>
        <button type="button" class="action" (click)="share()">
          <ion-icon name="arrow-redo-outline" /> {{ 'POST.SHARE' | translate }}
        </button>
      </div>

      @if (showComments()) {
        <app-comments-section #comments [post]="item" [expanded]="detail()" />
      }
    </article>
  `,
  styleUrl: './post-card.component.scss',
})
export class PostCardComponent {
  private readonly posts = inject(PostsService);
  private readonly users = inject(UsersService);
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly shareService = inject(ShareService);
  private readonly creator = inject(CreateService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly post = input.required<Post>();
  /** En su pantalla propia: texto entero y comentarios desplegados. */
  readonly detail = input(false);

  readonly removed = output<string>();

  /**
   * Cambios locales encima de lo recibido.
   *
   * Se vacían en cuanto llega una versión nueva de la publicación —el cambio
   * ya viene en ella—, para que una reacción hecha en otra pantalla no quede
   * tapada por una hecha aquí antes.
   */
  private readonly overrides = linkedSignal<Post, Partial<Post>>({ source: this.post, computation: () => ({}) });
  private readonly commentsOpen = signal(false);
  private readonly comments = viewChild<CommentsSectionComponent>('comments');

  readonly view = computed<Post>(() => ({ ...this.post(), ...this.overrides() }));
  readonly isOwn = computed(() => this.post().author.id === this.auth.user()?.id);
  readonly audience = computed(() => audienceIcon(this.view().audience));
  readonly bigText = computed(() => {
    const item = this.view();

    return !item.media.length && !item.sharedPost && item.description.length < 90;
  });
  readonly topReactions = computed(() => this.view().reactionSummary.slice(0, 3));
  readonly showComments = computed(
    () => this.detail() || this.commentsOpen() || this.view().commentPreview.length > 0,
  );

  readonly reactionText = computed(() => {
    const item = this.view();
    const count = item.reactionCount;

    if (item.myReaction) {
      return count === 1
        ? (this.translate.instant('POST.REACTED_YOU') as string)
        : (this.translate.instant('POST.REACTED_YOU_AND', { count: count - 1 }) as string);
    }

    return String(count);
  });

  emoji(type: ReactionType): string {
    return reactionEmoji(type);
  }

  placeLabel(post: Post): string {
    return post.location ? (describeLocation(post.location, post.locationAccuracy > 0) ?? '') : '';
  }

  async react(type: ReactionType | null): Promise<void> {
    const before = this.view();
    this.overrides.update((current) => ({ ...current, ...optimisticReaction(before, type) }));

    try {
      const result = type ? await this.posts.react(before.id, type) : await this.posts.unreact(before.id);
      this.overrides.update((current) => ({ ...current, ...result }));
    } catch (error) {
      this.overrides.update((current) => ({
        ...current,
        myReaction: before.myReaction,
        reactionCount: before.reactionCount,
        reactionSummary: before.reactionSummary,
      }));
      await this.feedback.error(error);
    }
  }

  openComments(): void {
    if (this.detail()) {
      this.comments()?.focus();

      return;
    }

    this.commentsOpen.set(true);
    setTimeout(() => this.comments()?.focus(), 50);
  }

  async follow(): Promise<void> {
    try {
      const result = await this.users.follow(this.post().author.id);
      this.overrides.update((current) => ({ ...current, authorFollowState: result.followState }));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async showReactors(): Promise<void> {
    const id = this.post().id;
    const load = async (page: number): Promise<UserListPage> => {
      const result = await this.posts.reactors(id, { page, perPage: 30 });

      return {
        entries: result.data.map((entry) => ({ user: entry.user, badge: reactionEmoji(entry.type), followState: entry.followState })),
        hasMore: result.meta.hasNextPage,
      };
    };

    const modal = await this.modalCtrl.create({
      component: UserListModalComponent,
      componentProps: { title: 'POST.REACTIONS', load },
      cssClass: 'rs-dialog',
    });

    await modal.present();
  }

  async share(): Promise<void> {
    const t = (key: string) => this.translate.instant(key) as string;
    // Compartir algo compartido comparte la original, como en Facebook.
    const target = this.view().sharedPost ?? this.view();
    const sheet = await this.actionSheetCtrl.create({
      header: t('POST.SHARE'),
      buttons: [
        { text: t('SHARE_MENU.SHARE_NOW'), icon: 'arrow-redo-outline', data: 'now' },
        { text: t('SHARE_MENU.WRITE_POST'), icon: 'create-outline', data: 'write' },
        { text: t('SHARE_MENU.SEND_IN_MESSENGER'), icon: 'chatbubble-ellipses-outline', data: 'messenger' },
        { text: t('SHARE_MENU.MORE_OPTIONS'), icon: 'share-social-outline', data: 'external' },
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    try {
      switch (data) {
        case 'now':
          await this.posts.create({ sharedPostId: target.id, audience: 'public' });
          this.overrides.update((current) => ({ ...current, shareCount: this.view().shareCount + 1 }));
          await this.feedback.toast('SHARE_MENU.SHARED', { color: 'success' });
          break;
        case 'write':
          if (await this.creator.post({ share: target })) {
            this.overrides.update((current) => ({ ...current, shareCount: this.view().shareCount + 1 }));
          }
          break;
        case 'messenger': {
          const modal = await this.modalCtrl.create({
            component: SendToChatModalComponent,
            componentProps: { post: target },
            cssClass: 'rs-dialog',
          });
          await modal.present();
          break;
        }
        case 'external':
          await this.shareService.share({
            title: fullName(target.author),
            text: target.description.slice(0, 140),
            path: `/post/${target.id}`,
          });
          break;
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async menu(): Promise<void> {
    const item = this.view();
    const t = (key: string, params?: Record<string, unknown>) => this.translate.instant(key, params) as string;
    const buttons = [
      { text: t(item.saved ? 'POST.UNSAVE' : 'POST.SAVE'), icon: item.saved ? 'bookmark' : 'bookmark-outline', data: 'save' },
      { text: t('POST.COPY_LINK'), icon: 'link-outline', data: 'link' },
      ...(this.isOwn()
        ? [
            { text: t('POST.EDIT'), icon: 'create-outline', data: 'edit' },
            { text: t('POST.DELETE'), icon: 'trash-outline', role: 'destructive', data: 'delete' },
          ]
        : [
            ...(item.authorFollowState === 'following'
              ? [{ text: t('FOLLOW.UNFOLLOW_NAME', { name: item.author.firstName || item.author.name }), icon: 'person-remove-outline', data: 'unfollow' }]
              : []),
            { text: t('POST.REPORT'), icon: 'flag-outline', data: 'report' },
            { text: t('PROFILE.BLOCK_NAME', { name: item.author.firstName || item.author.name }), icon: 'ban-outline', role: 'destructive', data: 'block' },
          ]),
      ...(this.auth.isAdmin() && !this.isOwn() ? [{ text: t('POST.DELETE'), icon: 'trash-outline', role: 'destructive', data: 'delete' }] : []),
      { text: t('CANCEL'), role: 'cancel' },
    ];

    const sheet = await this.actionSheetCtrl.create({ buttons });
    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    try {
      switch (data) {
        case 'save': {
          const saved = item.saved ? await this.posts.unsave(item.id) : await this.posts.save(item.id);
          this.overrides.update((current) => ({ ...current, saved }));
          await this.feedback.toast(saved ? 'POST.SAVED' : 'POST.UNSAVED');
          break;
        }
        case 'link':
          await navigator.clipboard.writeText(`${window.location.origin}/post/${item.id}`);
          await this.feedback.toast('SHARE.LINK_COPIED', { color: 'success' });
          break;
        case 'edit': {
          const updated = await this.creator.post({ edit: item });

          if (updated) {
            this.overrides.set(updated);
          }
          break;
        }
        case 'delete':
          if (
            await this.feedback.confirm({ header: 'POST.DELETE_TITLE', message: 'POST.DELETE_MESSAGE', confirmText: 'DELETE', danger: true })
          ) {
            await this.posts.remove(item.id);
            this.removed.emit(item.id);

            if (this.detail()) {
              await this.router.navigateByUrl('/');
            }
          }
          break;
        case 'unfollow': {
          const result = await this.users.unfollow(item.author.id);
          this.overrides.update((current) => ({ ...current, authorFollowState: result.followState }));
          break;
        }
        case 'report':
          await this.reports.report('post', item.id);
          break;
        case 'block':
          if (
            await this.feedback.confirm({ header: 'PROFILE.BLOCK', message: 'PROFILE.BLOCK_MESSAGE', confirmText: 'PROFILE.BLOCK', danger: true })
          ) {
            await this.social.block(item.author.id);
            this.removed.emit(item.id);
            await this.feedback.toast('PROFILE.BLOCKED', { color: 'success' });
          }
          break;
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}

/** Cómo quedan las cifras al cambiar la reacción propia, sin esperar al servidor. */
function optimisticReaction(post: Post, type: ReactionType | null): Partial<Post> {
  const summary = new Map(post.reactionSummary.map((entry) => [entry.type, entry.count]));
  let count = post.reactionCount;

  if (post.myReaction) {
    summary.set(post.myReaction, (summary.get(post.myReaction) ?? 1) - 1);
    count--;
  }

  if (type) {
    summary.set(type, (summary.get(type) ?? 0) + 1);
    count++;
  }

  return {
    myReaction: type,
    reactionCount: Math.max(0, count),
    reactionSummary: [...summary.entries()]
      .filter(([, value]) => value > 0)
      .map(([entryType, value]) => ({ type: entryType, count: value }))
      .sort((a, b) => b.count - a.count),
  };
}
