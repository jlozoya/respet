import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PublicProfile, StoryHighlight } from '@respet/shared';

import { CreateService } from '../../components/feed/create.service';
import { PostFeedComponent } from '../../components/feed/post-feed.component';
import { PostGridComponent } from '../../components/feed/post-grid.component';
import { StoryViewerService } from '../../components/stories/story-viewer.service';
import { ChatService } from '../../core/api/chat.service';
import { SocialService } from '../../core/api/social.service';
import { StoriesService } from '../../core/api/stories.service';
import { UsersService } from '../../core/api/users.service';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { ImagePickerService } from '../../core/media/image-picker.service';
import { PresenceService } from '../../core/realtime/presence.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { ShareService } from '../../core/ui/share.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FollowButtonComponent } from '../../shared/components/follow-button.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RichTextComponent } from '../../shared/components/rich-text.component';
import { UserListModalComponent, type UserListPage } from '../../shared/components/user-list-modal.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { FullNamePipe, fullName } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

type Tab = 'posts' | 'photos';

/**
 * El perfil: portada, foto, nombre, cifras, destacadas y lo publicado.
 *
 * Mezcla la cabecera de Facebook —portada con la foto encima— con la de
 * Instagram —publicaciones, seguidores y seguidos en fila, y las destacadas en
 * círculos—. Si la cuenta es privada y no la sigues sólo se ve la cabecera.
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    AvatarComponent,
    FollowButtonComponent,
    PageHeaderComponent,
    RichTextComponent,
    PostFeedComponent,
    PostGridComponent,
    CompactNumberPipe,
    FullNamePipe,
    RelativeTimePipe,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly users = inject(UsersService);
  private readonly social = inject(SocialService);
  private readonly storiesService = inject(StoriesService);
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);
  private readonly images = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly shareService = inject(ShareService);
  private readonly creator = inject(CreateService);
  private readonly viewer = inject(StoryViewerService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly handle = input.required<string>();

  readonly profile = signal<PublicProfile | null>(null);
  readonly highlights = signal<StoryHighlight[]>([]);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('posts');
  readonly uploading = signal<'avatar' | 'cover' | null>(null);

  readonly isOwn = computed(() => this.profile()?.id === this.auth.user()?.id);
  readonly canView = computed(() => this.isOwn() || (this.profile()?.canViewContent ?? false));
  readonly online = computed(() => {
    const profile = this.profile();

    return profile ? this.presence.isOnline(profile.id)() || profile.isOnline === true : false;
  });
  readonly feedQuery = computed(() => ({ userId: this.profile()?.id }));
  readonly photosQuery = computed(() => ({ userId: this.profile()?.id, withMediaOnly: true }));
  readonly ring = computed(() => {
    const profile = this.profile();

    if (!profile?.hasActiveStory) {
      return 'none';
    }

    return profile.hasUnseenStory ? 'unseen' : 'seen';
  });

  constructor() {
    effect(() => {
      const handle = this.handle();
      untracked(() => void this.load(handle));
    });
  }

  async load(handle: string): Promise<void> {
    this.error.set(null);

    if (this.profile()?.name !== handle && this.profile()?.id !== handle) {
      this.profile.set(null);
      this.highlights.set([]);
      this.tab.set('posts');
    }

    try {
      const profile = await this.users.profile(handle);
      this.profile.set(profile);
      this.presence.set(profile.id, profile.isOnline, profile.lastSeenAt);
      this.presence.track([profile.id]);

      if (profile.canViewContent || profile.id === this.auth.user()?.id) {
        this.highlights.set(await this.storiesService.highlights(profile.id).catch(() => []));
      }
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.code : 'SERVER.ERROR');
    }
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.load(this.handle());
    await (event.target as HTMLIonRefresherElement).complete();
  }

  onFollowChanged(result: { followerCount: number; followState: PublicProfile['followState'] }): void {
    this.profile.update((current) =>
      current ? { ...current, followerCount: result.followerCount, followState: result.followState } : current,
    );

    // Seguir a una cuenta privada aceptada, o dejar de seguirla, cambia lo que se ve.
    void this.load(this.handle());
  }

  async openStories(): Promise<void> {
    const profile = this.profile();

    if (!profile) {
      return;
    }

    if (!profile.hasActiveStory) {
      if (this.isOwn()) {
        await this.avatarMenu();
      }

      return;
    }

    const stories = await this.storiesService.userStories(profile.id);
    await this.viewer.open([{ user: profile, stories }]);
    this.profile.update((current) => (current ? { ...current, hasUnseenStory: false } : current));
  }

  async openHighlight(highlight: StoryHighlight): Promise<void> {
    const profile = this.profile();

    if (profile && highlight.stories.length) {
      await this.viewer.open([{ user: profile, stories: highlight.stories, title: highlight.title }]);
    }
  }

  async avatarMenu(): Promise<void> {
    const profile = this.profile();
    const t = (key: string) => this.translate.instant(key) as string;
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        ...(profile?.hasActiveStory ? [{ text: t('PROFILE.VIEW_STORY'), icon: 'book-outline', data: 'story' }] : []),
        { text: t('PROFILE.CHANGE_AVATAR'), icon: 'camera-outline', data: 'change' },
        ...(profile?.avatar ? [{ text: t('PROFILE.REMOVE_AVATAR'), icon: 'trash-outline', role: 'destructive', data: 'remove' }] : []),
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    if (data === 'story') {
      await this.openStories();
    } else if (data === 'change') {
      await this.changeImage('avatar');
    } else if (data === 'remove') {
      await this.guard(async () => {
        await this.users.removeAvatar();
        await this.afterImageChange();
      });
    }
  }

  async changeImage(kind: 'avatar' | 'cover'): Promise<void> {
    const file = await this.images.pick(kind === 'avatar' ? { aspectRatio: 1, targetWidth: 720 } : { aspectRatio: 16 / 6, targetWidth: 1640 });

    if (!file) {
      return;
    }

    this.uploading.set(kind);

    await this.guard(async () => {
      if (kind === 'avatar') {
        await this.users.updateAvatar(file);
      } else {
        await this.users.updateCover(file);
      }

      await this.afterImageChange();
    });

    this.uploading.set(null);
  }

  async removeCover(): Promise<void> {
    await this.guard(async () => {
      await this.users.removeCover();
      await this.afterImageChange();
    });
  }

  async message(): Promise<void> {
    const profile = this.profile();

    if (profile) {
      await this.guard(() => this.chat.openWith(profile.id));
    }
  }

  addStory(): void {
    void this.creator.story().then((published) => {
      if (published) {
        void this.load(this.handle());
      }
    });
  }

  async showFollowers(kind: 'followers' | 'following'): Promise<void> {
    const profile = this.profile();

    if (!profile || !this.canView()) {
      return;
    }

    const load = async (page: number): Promise<UserListPage> => {
      const result =
        kind === 'followers'
          ? await this.users.followers(profile.id, { page, perPage: 30 })
          : await this.users.following(profile.id, { page, perPage: 30 });

      return { entries: result.data.map((user) => ({ user })), hasMore: result.meta.hasNextPage };
    };

    const modal = await this.modalCtrl.create({
      component: UserListModalComponent,
      componentProps: { title: kind === 'followers' ? 'PROFILE.FOLLOWERS' : 'PROFILE.FOLLOWING', load, showFollow: false },
      cssClass: 'rs-dialog',
    });

    await modal.present();
  }

  async menu(): Promise<void> {
    const profile = this.profile();

    if (!profile) {
      return;
    }

    const t = (key: string, params?: Record<string, unknown>) => this.translate.instant(key, params) as string;
    const name = profile.firstName || profile.name;
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        { text: t('PROFILE.SHARE'), icon: 'share-social-outline', data: 'share' },
        ...(this.isOwn()
          ? [
              { text: t('NAV.STORY_ARCHIVE'), icon: 'time-outline', data: 'archive' },
              { text: t('NAV.SETTINGS'), icon: 'settings-outline', data: 'settings' },
            ]
          : [
              profile.blockedByViewer
                ? { text: t('PROFILE.UNBLOCK_NAME', { name }), icon: 'ban-outline', data: 'unblock' }
                : { text: t('PROFILE.BLOCK_NAME', { name }), icon: 'ban-outline', role: 'destructive', data: 'block' },
              { text: t('REPORT'), icon: 'flag-outline', data: 'report' },
            ]),
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    switch (data) {
      case 'share':
        await this.shareService.share({ title: fullName(profile), text: profile.bio ?? '', path: `/profile/${profile.name}` });
        break;
      case 'archive':
        await this.router.navigateByUrl('/stories/archive');
        break;
      case 'settings':
        await this.router.navigateByUrl('/settings');
        break;
      case 'block':
        if (await this.feedback.confirm({ header: 'PROFILE.BLOCK', message: 'PROFILE.BLOCK_MESSAGE', confirmText: 'PROFILE.BLOCK', danger: true })) {
          await this.guard(async () => {
            await this.social.block(profile.id);
            await this.feedback.toast('PROFILE.BLOCKED', { color: 'success' });
            await this.load(this.handle());
          });
        }
        break;
      case 'unblock':
        await this.unblock();
        break;
      case 'report':
        await this.reports.report('user', profile.id);
        break;
    }
  }

  async unblock(): Promise<void> {
    const profile = this.profile();

    if (profile) {
      await this.guard(async () => {
        await this.social.unblock(profile.id);
        await this.load(this.handle());
      });
    }
  }

  private async afterImageChange(): Promise<void> {
    await Promise.all([this.load(this.handle()), this.auth.refreshUser()]);
  }

  private async guard(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
