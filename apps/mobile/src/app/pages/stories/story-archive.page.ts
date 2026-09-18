import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Story, StoryHighlight } from '@social-network/shared';

import { StoryViewerService } from '../../components/stories/story-viewer.service';
import { storyBackground, storyFont } from '../../components/stories/story-style';
import { StoriesService } from '../../core/api/stories.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * El archivo de historias: todas las propias, también las caducadas, y las
 * destacadas que se fijan en el perfil a partir de ellas.
 */
@Component({
  selector: 'app-story-archive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, TranslatePipe, IonContent, IonButton, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, PageHeaderComponent],
  template: `
    <app-page-header title="NAV.STORY_ARCHIVE" />

    <ion-content>
      <div class="rs-container">
        <div class="head">
          <h1 class="rs-desktop-only">{{ 'NAV.STORY_ARCHIVE' | translate }}</h1>
          @if (selecting()) {
            <span class="rs-muted">{{ 'STORIES.SELECTED' | translate: { count: selected().size } }}</span>
            <span class="spacer"></span>
            <ion-button class="rs-soft" (click)="cancelSelection()">{{ 'CANCEL' | translate }}</ion-button>
            <ion-button [disabled]="!selected().size" (click)="createHighlight()">{{ 'STORIES.CREATE_HIGHLIGHT' | translate }}</ion-button>
          } @else {
            <span class="spacer"></span>
            <ion-button (click)="selecting.set(true)" [disabled]="!stories().length">
              <ion-icon slot="start" name="add" /> {{ 'PROFILE.NEW_HIGHLIGHT' | translate }}
            </ion-button>
          }
        </div>

        @if (highlights().length) {
          <section class="rs-card highlights">
            <h2 class="rs-card-title">{{ 'STORIES.HIGHLIGHTS' | translate }}</h2>
            <div class="highlight-list">
              @for (highlight of highlights(); track highlight.id) {
                <div class="highlight">
                  <button type="button" class="cover" (click)="play(highlight.stories, 0)">
                    @if (highlight.cover ?? highlight.stories[0]?.media; as cover) {
                      <img [src]="cover.posterUrl ?? cover.url" alt="" />
                    }
                  </button>
                  <span class="rs-small rs-strong">{{ highlight.title }}</span>
                  <button type="button" class="rs-text-btn" (click)="removeHighlight(highlight)">{{ 'DELETE' | translate }}</button>
                </div>
              }
            </div>
          </section>
        }

        <div class="grid">
          @for (story of stories(); track story.id; let index = $index) {
            <button type="button" class="tile" [class.picked]="selected().has(story.id)" (click)="tap(story, index)">
              @switch (story.kind) {
                @case ('text') {
                  <span class="text" [style.background]="background(story)" [style.font-family]="font(story)">{{ story.text }}</span>
                }
                @default {
                  <img [src]="story.media?.posterUrl ?? story.media?.url" alt="" loading="lazy" />
                }
              }
              <span class="date">{{ story.createdAt | slice: 0 : 10 }}</span>
              @if (selecting()) {
                <span class="check">
                  @if (selected().has(story.id)) {
                    <ion-icon name="checkmark" />
                  }
                </span>
              }
            </button>
          } @empty {
            <div class="rs-empty empty">
              <ion-icon name="time-outline" />
              <p>{{ 'STORIES.ARCHIVE_EMPTY' | translate }}</p>
            </div>
          }
        </div>

        <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="loadMore($event)">
          <ion-infinite-scroll-content />
        </ion-infinite-scroll>
      </div>
    </ion-content>
  `,
  styles: `
    .head {
      align-items: center;
      display: flex;
      gap: 8px;
      padding: 8px;
    }

    h1 {
      font-size: 1.5rem;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .highlights {
      padding-bottom: 12px;
    }

    .highlight-list {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding: 8px 16px;
    }

    .highlight {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cover {
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 50%;
      cursor: pointer;
      height: 72px;
      overflow: hidden;
      padding: 0;
      width: 72px;
    }

    .cover img {
      height: 100%;
      object-fit: cover;
      width: 100%;
    }

    .grid {
      display: grid;
      gap: 4px;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .tile {
      aspect-ratio: 9 / 16;
      background: #000;
      border: 0;
      cursor: pointer;
      overflow: hidden;
      padding: 0;
      position: relative;
    }

    .tile.picked {
      outline: 3px solid var(--ion-color-primary);
      outline-offset: -3px;
    }

    .tile img {
      height: 100%;
      object-fit: cover;
      width: 100%;
    }

    .text {
      align-items: center;
      color: #fff;
      display: flex;
      font-size: 0.8125rem;
      font-weight: 700;
      height: 100%;
      justify-content: center;
      overflow: hidden;
      padding: 8px;
    }

    .date {
      background: rgb(0 0 0 / 55%);
      border-radius: 4px;
      color: #fff;
      font-size: 0.6875rem;
      left: 6px;
      padding: 1px 4px;
      position: absolute;
      top: 6px;
    }

    .check {
      align-items: center;
      background: rgb(0 0 0 / 35%);
      border: 2px solid #fff;
      border-radius: 50%;
      color: #fff;
      display: flex;
      height: 24px;
      justify-content: center;
      position: absolute;
      right: 6px;
      top: 6px;
      width: 24px;
    }

    .tile.picked .check {
      background: var(--ion-color-primary);
    }

    .empty {
      grid-column: 1 / -1;
    }
  `,
})
export class StoryArchivePage implements OnInit {
  private readonly storiesService = inject(StoriesService);
  private readonly auth = inject(AuthService);
  private readonly viewer = inject(StoryViewerService);
  private readonly feedback = inject(FeedbackService);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  readonly stories = signal<Story[]>([]);
  readonly highlights = signal<StoryHighlight[]>([]);
  readonly hasMore = signal(false);
  readonly selecting = signal(false);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  private page = 0;

  readonly me = computed(() => this.auth.user());

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const me = this.me();

    await Promise.all([
      this.fetch(),
      me ? this.storiesService.highlights(me.id).then((items) => this.highlights.set(items), () => undefined) : Promise.resolve(),
    ]);
  }

  background(story: Story): string {
    return storyBackground(story.style.background);
  }

  font(story: Story): string {
    return storyFont(story.style.font);
  }

  async loadMore(event: CustomEvent): Promise<void> {
    await this.fetch();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  async tap(story: Story, index: number): Promise<void> {
    if (!this.selecting()) {
      await this.play(this.stories(), index);

      return;
    }

    this.selected.update((current) => {
      const next = new Set(current);

      if (next.has(story.id)) {
        next.delete(story.id);
      } else {
        next.add(story.id);
      }

      return next;
    });
  }

  async play(stories: Story[], index: number): Promise<void> {
    const me = this.me();
    const start = stories[index];

    if (me && start) {
      await this.viewer.open([{ user: me, stories }], 0, start.id);
    }
  }

  cancelSelection(): void {
    this.selecting.set(false);
    this.selected.set(new Set());
  }

  async createHighlight(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('STORIES.HIGHLIGHT_NAME') as string,
      inputs: [{ name: 'title', attributes: { maxlength: 40 }, placeholder: this.translate.instant('STORIES.HIGHLIGHT_PLACEHOLDER') as string }],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ADD') as string, role: 'confirm' },
      ],
    });

    await alert.present();
    const { data, role } = await alert.onWillDismiss<{ values: { title?: string } }>();
    const title = data?.values.title?.trim();

    if (role !== 'confirm' || !title) {
      return;
    }

    try {
      const ids = this.stories().filter((story) => this.selected().has(story.id)).map((story) => story.id);
      const highlight = await this.storiesService.createHighlight({ title, storyIds: ids });
      this.highlights.update((items) => [highlight, ...items]);
      this.cancelSelection();
      await this.feedback.toast('STORIES.HIGHLIGHT_CREATED', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async removeHighlight(highlight: StoryHighlight): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'STORIES.DELETE_HIGHLIGHT',
      message: 'STORIES.DELETE_HIGHLIGHT_MESSAGE',
      confirmText: 'DELETE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.storiesService.removeHighlight(highlight.id);
      this.highlights.update((items) => items.filter((item) => item.id !== highlight.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async fetch(): Promise<void> {
    try {
      const next = this.page + 1;
      const result = await this.storiesService.archive(next, 30);
      this.stories.update((items) => [...items, ...result.data]);
      this.page = next;
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      this.hasMore.set(false);
      await this.feedback.error(error);
    }
  }
}
