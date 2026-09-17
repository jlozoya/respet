import { ChangeDetectionStrategy, Component, type OnDestroy, computed, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import { STORY_BACKGROUNDS, STORY_FONTS, type Audience } from '@respet/shared';

import { StoriesService } from '../../core/api/stories.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AUDIENCES } from '../../shared/utils/audience';
import { storyBackground, storyFont } from './story-style';

type Mode = 'choose' | 'text' | 'media';

/**
 * Crear una historia.
 *
 * Primero se elige qué: un texto sobre un fondo de color o una foto o vídeo
 * del dispositivo. El texto se escribe encima de su fondo, con el aspecto que
 * tendrá; la foto se ve tal cual quedará, con su pie opcional.
 */
@Component({
  selector: 'app-story-creator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonButton, IonIcon, IonSelect, IonSelectOption, IonSpinner],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false" class="creator">
      <div class="layout">
        <header class="top">
          <button type="button" class="icon" (click)="mode() === 'choose' ? close() : reset()" [attr.aria-label]="'CLOSE' | translate">
            <ion-icon [name]="mode() === 'choose' ? 'close' : 'arrow-back'" />
          </button>
          <h2>{{ 'STORIES.CREATE' | translate }}</h2>
          <span class="spacer"></span>
          @if (mode() !== 'choose') {
            <ion-select
              class="audience"
              interface="popover"
              [value]="audience()"
              (ionChange)="audience.set($event.detail.value)"
              [attr.aria-label]="'AUDIENCE.TITLE' | translate"
            >
              @for (option of audiences; track option.value) {
                <ion-select-option [value]="option.value">{{ option.label | translate }}</ion-select-option>
              }
            </ion-select>
          }
        </header>

        @switch (mode()) {
          @case ('choose') {
            <div class="choices">
              <button type="button" class="choice photo" (click)="fileInput.click()">
                <span class="choice-icon"><ion-icon name="images" /></span>
                {{ 'STORIES.PHOTO_VIDEO' | translate }}
              </button>
              <button type="button" class="choice text-choice" (click)="mode.set('text')">
                <span class="choice-icon">Aa</span>
                {{ 'STORIES.TEXT' | translate }}
              </button>
            </div>
          }

          @case ('text') {
            <div class="canvas" [style.background]="gradient()">
              <textarea
                class="text-input"
                maxlength="500"
                [style.font-family]="fontFamily()"
                [value]="text()"
                (input)="text.set($any($event.target).value)"
                [placeholder]="'STORIES.START_TYPING' | translate"
                [attr.aria-label]="'STORIES.TEXT' | translate"
              ></textarea>
            </div>

            <div class="tools">
              <div class="swatches">
                @for (name of backgrounds; track name) {
                  <button
                    type="button"
                    class="swatch"
                    [class.active]="background() === name"
                    [style.background]="swatch(name)"
                    (click)="background.set(name)"
                    [attr.aria-label]="name"
                  ></button>
                }
              </div>
              <div class="fonts">
                @for (name of fonts; track name) {
                  <button type="button" class="font" [class.active]="font() === name" [style.font-family]="familyOf(name)" (click)="font.set(name)">
                    Aa
                  </button>
                }
              </div>
            </div>
          }

          @case ('media') {
            <div class="canvas media">
              @if (preview(); as url) {
                @if (isVideo()) {
                  <video [src]="url" autoplay loop muted playsinline></video>
                } @else {
                  <img [src]="url" alt="" />
                }
              }
              <input
                class="caption"
                type="text"
                maxlength="200"
                [value]="text()"
                (input)="text.set($any($event.target).value)"
                [placeholder]="'STORIES.ADD_CAPTION' | translate"
              />
            </div>
          }
        }

        @if (mode() !== 'choose') {
          <footer class="bottom">
            <ion-button class="share" shape="round" [disabled]="!canShare() || busy()" (click)="share()">
              @if (busy()) {
                <ion-spinner name="crescent" />
              } @else {
                <ion-icon slot="start" name="send" />
                {{ 'STORIES.SHARE' | translate }}
              }
            </ion-button>
          </footer>
        }
      </div>

      <input #fileInput type="file" hidden accept="image/*,video/*" (change)="onFile($event)" />
    </ion-content>
  `,
  styleUrl: './story-creator.component.scss',
})
export class StoryCreatorComponent implements OnDestroy {
  private readonly stories = inject(StoriesService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly backgrounds = STORY_BACKGROUNDS;
  readonly fonts = STORY_FONTS;
  readonly audiences = AUDIENCES;

  readonly mode = signal<Mode>('choose');
  readonly text = signal('');
  readonly background = signal<string>('sunset');
  readonly font = signal<string>('modern');
  readonly audience = signal<Audience>('followers');
  readonly file = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly busy = signal(false);

  readonly gradient = computed(() => storyBackground(this.background()));
  readonly fontFamily = computed(() => storyFont(this.font()));
  readonly isVideo = computed(() => this.file()?.type.startsWith('video/') ?? false);
  readonly canShare = computed(() => (this.mode() === 'text' ? this.text().trim().length > 0 : !!this.file()));

  ngOnDestroy(): void {
    this.releasePreview();
  }

  swatch(name: string): string {
    return storyBackground(name);
  }

  familyOf(name: string): string {
    return storyFont(name);
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    this.releasePreview();
    this.file.set(file);
    this.preview.set(URL.createObjectURL(file));
    this.mode.set('media');
  }

  reset(): void {
    this.releasePreview();
    this.file.set(null);
    this.text.set('');
    this.mode.set('choose');
  }

  async share(): Promise<void> {
    this.busy.set(true);

    try {
      const file = this.file();
      const text = this.text().trim() || undefined;

      await this.stories.create(
        file
          ? { text, audience: this.audience(), durationMs: file.type.startsWith('video/') ? await videoDuration(this.preview()) : undefined }
          : { kind: 'text', text, background: this.background(), font: this.font(), audience: this.audience() },
        file,
      );

      await this.feedback.toast('STORIES.PUBLISHED', { color: 'success', duration: 2000 });
      await this.modalCtrl.dismiss(null, 'published');
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  private releasePreview(): void {
    const url = this.preview();

    if (url) {
      URL.revokeObjectURL(url);
      this.preview.set(null);
    }
  }
}

/** La duración de un vídeo local, por si el servidor no tiene FFmpeg para medirla. */
function videoDuration(url: string | null): Promise<number | undefined> {
  if (!url) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined);
    video.onerror = () => resolve(undefined);
    video.src = url;
  });
}
