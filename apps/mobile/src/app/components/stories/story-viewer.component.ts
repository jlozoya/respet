import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  type OnDestroy,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Story } from '@social-network/shared';

import { StoriesService } from '../../core/api/stories.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { UserListModalComponent, type UserListPage } from '../../shared/components/user-list-modal.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { storyBackground, storyFont } from './story-style';
import type { StoryReel } from './story-viewer.service';

/** Lo que dura en pantalla una foto o un texto sin duración propia. */
const DEFAULT_DURATION_MS = 5000;
/** Las reacciones rápidas de las historias, como en Instagram. */
const QUICK_REACTIONS = ['😂', '😮', '😍', '😢', '👏', '🔥'];

/**
 * El visor de historias.
 *
 * Barras de progreso arriba, un toque a la derecha para seguir y a la
 * izquierda para volver, mantener pulsado para pausar. Al acabar las de una
 * persona pasa a las de la siguiente. En las propias se ve quién las vio; en
 * las ajenas se puede contestar o reaccionar, y eso llega por privado.
 */
@Component({
  selector: 'app-story-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonIcon, AvatarComponent, CompactNumberPipe, FullNamePipe, RelativeTimePipe],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false" class="viewer">
      <div class="frame">
        @if (story(); as item) {
          <div class="stage" [style.background]="item.kind === 'text' ? background(item) : '#000'">
            @switch (item.kind) {
              @case ('image') {
                <img class="media" [src]="item.media?.url" [alt]="item.text ?? ''" (load)="mediaReady()" />
              }
              @case ('video') {
                <video
                  #video
                  class="media"
                  [src]="item.media?.url"
                  [poster]="item.media?.posterUrl ?? ''"
                  [muted]="muted()"
                  playsinline
                  autoplay
                  (loadeddata)="mediaReady()"
                  (ended)="next()"
                ></video>
              }
              @default {
                <p class="text" [style.font-family]="font(item)">{{ item.text }}</p>
              }
            }
            @if (item.kind !== 'text' && item.text) {
              <p class="caption">{{ item.text }}</p>
            }
          </div>

          <div
            class="zones"
            (pointerdown)="hold()"
            (pointerup)="release($event)"
            (pointerleave)="releaseSilently()"
            (contextmenu)="$event.preventDefault()"
          ></div>

          <header class="top">
            <div class="bars">
              @for (entry of reel()?.stories ?? []; track entry.id; let index = $index) {
                <span class="bar"><span class="fill" [style.width.%]="barFill(index)"></span></span>
              }
            </div>
            <div class="who">
              <app-avatar [user]="item.author" [size]="36" />
              <span class="name">{{ item.author | fullName }}</span>
              <span class="time">{{ reel()?.title ?? (item.createdAt | relativeTime) }}</span>
              <span class="spacer"></span>
              @if (item.kind === 'video') {
                <button type="button" class="icon" (click)="muted.set(!muted())" [attr.aria-label]="'STORIES.MUTE' | translate">
                  <ion-icon [name]="muted() ? 'volume-mute' : 'volume-high'" />
                </button>
              }
              <button type="button" class="icon" (click)="togglePause()" [attr.aria-label]="'STORIES.PAUSE' | translate">
                <ion-icon [name]="paused() ? 'play' : 'pause'" />
              </button>
              <button type="button" class="icon" (click)="menu()" [attr.aria-label]="'COMMON.OPTIONS' | translate">
                <ion-icon name="ellipsis-horizontal" />
              </button>
              <button type="button" class="icon" (click)="close()" [attr.aria-label]="'CLOSE' | translate">
                <ion-icon name="close" />
              </button>
            </div>
          </header>

          <footer class="bottom">
            @if (isOwn()) {
              <button type="button" class="viewers" (click)="showViewers()">
                <ion-icon name="eye" /> {{ item.viewCount ?? 0 | compactNumber }}
                @if (item.reactionCount) {
                  · <ion-icon name="heart" /> {{ item.reactionCount | compactNumber }}
                }
              </button>
            } @else if (item.canReply) {
              <div class="reply">
                <input
                  type="text"
                  maxlength="1000"
                  [value]="replyText()"
                  (input)="replyText.set($any($event.target).value)"
                  (focus)="pause()"
                  (blur)="resume()"
                  (keydown.enter)="sendReply()"
                  [placeholder]="'STORIES.REPLY_TO' | translate: { name: item.author.firstName || item.author.name }"
                />
                @if (replyText().trim()) {
                  <button type="button" class="icon" (click)="sendReply()" [attr.aria-label]="'SEND' | translate">
                    <ion-icon name="send" />
                  </button>
                } @else {
                  @for (emoji of reactions; track emoji) {
                    <button type="button" class="quick" [class.mine]="item.myReaction === emoji" (click)="react(emoji)">{{ emoji }}</button>
                  }
                }
              </div>
            }
          </footer>

          @if (burst(); as emoji) {
            <span class="burst">{{ emoji }}</span>
          }
        }

        <button type="button" class="nav prev" (click)="previous()" [attr.aria-label]="'COMMON.PREVIOUS' | translate">
          <ion-icon name="chevron-back" />
        </button>
        <button type="button" class="nav next" (click)="next()" [attr.aria-label]="'COMMON.NEXT' | translate">
          <ion-icon name="chevron-forward" />
        </button>
      </div>
    </ion-content>
  `,
  styleUrl: './story-viewer.component.scss',
})
export class StoryViewerComponent implements OnInit, OnDestroy {
  private readonly stories = inject(StoriesService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly reels = input.required<readonly StoryReel[]>();
  readonly startReel = input(0);
  readonly startStoryId = input<string | null>(null);

  readonly reelIndex = signal(0);
  readonly storyIndex = signal(0);
  readonly progress = signal(0);
  readonly paused = signal(false);
  readonly muted = signal(false);
  readonly replyText = signal('');
  readonly burst = signal<string | null>(null);
  readonly reactions = QUICK_REACTIONS;

  /** Las historias con los cambios hechos aquí: vistas, reacciones, borradas. */
  private readonly local = signal<Record<string, Partial<Story> | null>>({});
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly reel = computed(() => {
    const reel = this.reels()[this.reelIndex()];

    if (!reel) {
      return null;
    }

    const local = this.local();

    return {
      ...reel,
      stories: reel.stories
        .filter((story) => local[story.id] !== null)
        .map((story) => ({ ...story, ...(local[story.id] ?? {}) })),
    };
  });

  readonly story = computed(() => this.reel()?.stories[this.storyIndex()] ?? null);
  readonly storyId = computed(() => this.story()?.id ?? null);
  readonly isOwn = computed(() => this.story()?.author.id === this.auth.user()?.id);

  private frame = 0;
  private startedAt = 0;
  private elapsedBeforePause = 0;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private held = false;
  private ready = false;

  constructor() {
    // Cada historia nueva arranca su cuenta y se apunta como vista. Se vigila
    // sólo el id: una reacción cambia la historia, pero no debe reiniciarla.
    effect(() => {
      this.storyId();

      untracked(() => {
        const story = this.story();

        cancelAnimationFrame(this.frame);
        this.progress.set(0);
        this.elapsedBeforePause = 0;
        this.ready = story?.kind === 'text';
        this.startedAt = performance.now();
        this.replyText.set('');

        if (!story) {
          return;
        }

        if (!this.isOwn()) {
          void this.stories.markViewed(story);
        }

        this.tick();
      });
    });
  }

  ngOnInit(): void {
    const reels = this.reels();
    const start = Math.min(this.startReel(), reels.length - 1);
    const reel = reels[start];
    const wanted = this.startStoryId();
    let index = wanted ? (reel?.stories.findIndex((story) => story.id === wanted) ?? -1) : -1;

    // Sin historia concreta, se empieza por la primera sin ver.
    if (index < 0) {
      index = Math.max(0, reel?.stories.findIndex((story) => !story.seen) ?? 0);
    }

    this.reelIndex.set(Math.max(0, start));
    this.storyIndex.set(index);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if ((event.target as HTMLElement | null)?.tagName === 'INPUT') {
      return;
    }

    if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.previous();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.togglePause();
    }
  }

  background(story: Story): string {
    return storyBackground(story.style.background);
  }

  font(story: Story): string {
    return storyFont(story.style.font);
  }

  barFill(index: number): number {
    const current = this.storyIndex();

    if (index < current) {
      return 100;
    }

    return index === current ? this.progress() * 100 : 0;
  }

  mediaReady(): void {
    this.ready = true;
    this.startedAt = performance.now();
  }

  next(): void {
    const reel = this.reel();

    if (reel && this.storyIndex() < reel.stories.length - 1) {
      this.storyIndex.update((value) => value + 1);
    } else if (this.reelIndex() < this.reels().length - 1) {
      this.reelIndex.update((value) => value + 1);
      this.storyIndex.set(Math.max(0, this.reels()[this.reelIndex()]?.stories.findIndex((story) => !story.seen) ?? 0));
    } else {
      this.close();
    }
  }

  previous(): void {
    if (this.storyIndex() > 0) {
      this.storyIndex.update((value) => value - 1);
    } else if (this.reelIndex() > 0) {
      this.reelIndex.update((value) => value - 1);
      this.storyIndex.set(0);
    } else {
      this.startedAt = performance.now();
      this.elapsedBeforePause = 0;
    }
  }

  hold(): void {
    this.held = false;
    this.holdTimer = setTimeout(() => {
      this.held = true;
      this.pause();
    }, 200);
  }

  release(event: PointerEvent): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
    }

    if (this.held) {
      this.held = false;
      this.resume();

      return;
    }

    const width = (this.host.nativeElement as HTMLElement).clientWidth;

    if (event.clientX < width / 3) {
      this.previous();
    } else {
      this.next();
    }
  }

  releaseSilently(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
    }

    if (this.held) {
      this.held = false;
      this.resume();
    }
  }

  togglePause(): void {
    if (this.paused()) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause(): void {
    if (this.paused()) {
      return;
    }

    this.paused.set(true);
    this.elapsedBeforePause += performance.now() - this.startedAt;
    this.video()?.nativeElement.pause();
  }

  resume(): void {
    if (!this.paused()) {
      return;
    }

    this.paused.set(false);
    this.startedAt = performance.now();
    void this.video()?.nativeElement.play().catch(() => undefined);
  }

  async react(emoji: string): Promise<void> {
    const story = this.story();

    if (!story) {
      return;
    }

    this.burst.set(emoji);
    setTimeout(() => this.burst.set(null), 900);

    try {
      const updated = await this.stories.react(story.id, emoji);
      this.patch(story.id, { myReaction: updated.myReaction });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async sendReply(): Promise<void> {
    const story = this.story();
    const body = this.replyText().trim();

    if (!story || !body) {
      return;
    }

    this.replyText.set('');

    try {
      await this.stories.reply(story.id, body);
      await this.feedback.toast('STORIES.REPLY_SENT', { color: 'success', duration: 1500 });
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.resume();
    }
  }

  async showViewers(): Promise<void> {
    const story = this.story();

    if (!story) {
      return;
    }

    this.pause();

    const load = async (page: number): Promise<UserListPage> => {
      const result = await this.stories.viewers(story.id, page, 50);

      return {
        entries: result.data.map((entry) => ({ user: entry.user, badge: entry.reaction })),
        hasMore: result.meta.hasNextPage,
      };
    };

    const modal = await this.modalCtrl.create({
      component: UserListModalComponent,
      componentProps: { title: 'STORIES.VIEWERS', load, showFollow: false, emptyText: 'STORIES.NO_VIEWERS' },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    await modal.onWillDismiss();
    this.resume();
  }

  async menu(): Promise<void> {
    const story = this.story();

    if (!story) {
      return;
    }

    this.pause();
    const t = (key: string) => this.translate.instant(key) as string;
    const sheet = await this.actionSheetCtrl.create({
      buttons: this.isOwn()
        ? [
            { text: t('STORIES.ARCHIVE'), icon: 'time-outline', data: 'archive' },
            { text: t('STORIES.DELETE'), icon: 'trash-outline', role: 'destructive', data: 'delete' },
            { text: t('CANCEL'), role: 'cancel' },
          ]
        : [
            { text: t('STORIES.VIEW_PROFILE'), icon: 'person-circle-outline', data: 'profile' },
            { text: t('REPORT'), icon: 'flag-outline', data: 'report' },
            { text: t('CANCEL'), role: 'cancel' },
          ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    switch (data) {
      case 'delete':
        try {
          await this.stories.remove(story.id);
          const remaining = (this.reel()?.stories.length ?? 1) - 1;
          this.patch(story.id, null);

          if (remaining === 0) {
            this.close();
          } else if (this.storyIndex() >= remaining) {
            this.storyIndex.set(remaining - 1);
          }
        } catch (error) {
          await this.feedback.error(error);
        }
        break;
      case 'archive':
        this.close();
        await this.router.navigateByUrl('/stories/archive');
        break;
      case 'profile':
        this.close();
        await this.router.navigate(['/profile', story.author.name]);
        break;
      case 'report':
        await this.reports.report('story', story.id);
        break;
    }

    this.resume();
  }

  close(): void {
    cancelAnimationFrame(this.frame);
    void this.modalCtrl.dismiss();
  }

  private patch(id: string, changes: Partial<Story> | null): void {
    this.local.update((current) => ({ ...current, [id]: changes === null ? null : { ...(current[id] ?? {}), ...changes } }));
  }

  private tick(): void {
    this.frame = requestAnimationFrame(() => {
      const story = this.story();

      if (!story) {
        return;
      }

      if (!this.paused() && this.ready) {
        const video = this.video()?.nativeElement;
        let progress: number;

        if (story.kind === 'video' && video?.duration) {
          progress = video.currentTime / video.duration;
        } else {
          const elapsed = this.elapsedBeforePause + performance.now() - this.startedAt;
          progress = elapsed / (story.kind === 'video' ? story.durationMs || 15000 : story.durationMs || DEFAULT_DURATION_MS);
        }

        this.progress.set(Math.min(1, progress));

        if (progress >= 1 && story.kind !== 'video') {
          this.next();

          return;
        }
      }

      this.tick();
    });
  }
}
