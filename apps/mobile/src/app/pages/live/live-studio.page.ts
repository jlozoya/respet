import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  type OnDestroy,
  type OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Audience, LiveComment, LiveStream } from '@social-network/shared';
import type { LocalAudioTrack, LocalVideoTrack, Room } from 'livekit-client';
import type { Subscription } from 'rxjs';

import {
  LiveOverlayComponent,
  type FloatingReaction,
} from '../../components/live/live-overlay.component';
import { LiveService } from '../../core/api/live.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { AUDIENCES } from '../../shared/utils/audience';

/** Cada cuánto avisa quien emite de que sigue ahí. */
const HEARTBEAT_MS = 10_000;

type Phase = 'checking' | 'disabled' | 'preview' | 'starting' | 'live' | 'ended';

/**
 * El estudio para emitir en directo.
 *
 * Primero la vista previa de la cámara con el título y quién puede verlo;
 * luego, en directo, el vídeo propio con los comentarios y reacciones que van
 * llegando y el contador de espectadores. El vídeo viaja por LiveKit; la API
 * reparte el pase y recibe una señal de vida cada pocos segundos, sin la cual
 * da el directo por terminado.
 */
@Component({
  selector: 'app-live-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    LiveOverlayComponent,
    CompactNumberPipe,
    DurationPipe,
  ],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false" class="studio">
      <div class="stage">
        <video
          #preview
          class="video"
          autoplay
          muted
          playsinline
          [class.hidden]="!cameraOn()"
        ></video>
        @if (!cameraOn() && phase() !== 'checking' && phase() !== 'disabled') {
          <div class="camera-off"><ion-icon name="videocam-off" /></div>
        }

        <header class="top">
          <button
            type="button"
            class="icon"
            (click)="leave()"
            [attr.aria-label]="'CLOSE' | translate"
          >
            <ion-icon name="close" />
          </button>
          @if (phase() === 'live') {
            <span class="rs-live-badge">{{ 'LIVE.BADGE' | translate }}</span>
            <span class="pill">{{ elapsed() | duration }}</span>
            <span class="pill"><ion-icon name="eye" /> {{ viewers() | compactNumber }}</span>
          }
          <span class="spacer"></span>
          @if (phase() === 'preview' || phase() === 'live') {
            <button
              type="button"
              class="icon"
              (click)="toggleMic()"
              [attr.aria-label]="'LIVE.MIC' | translate"
            >
              <ion-icon [name]="micOn() ? 'mic' : 'mic-off'" />
            </button>
            <button
              type="button"
              class="icon"
              (click)="toggleCamera()"
              [attr.aria-label]="'LIVE.CAMERA' | translate"
            >
              <ion-icon [name]="cameraOn() ? 'videocam' : 'videocam-off'" />
            </button>
            <button
              type="button"
              class="icon"
              (click)="flipCamera()"
              [attr.aria-label]="'LIVE.FLIP' | translate"
            >
              <ion-icon name="camera-reverse" />
            </button>
          }
        </header>

        @switch (phase()) {
          @case ('checking') {
            <div class="center"><ion-spinner name="crescent" /></div>
          }
          @case ('disabled') {
            <div class="center panel">
              <ion-icon name="videocam-off-outline" />
              <p>{{ 'LIVE.DISABLED' | translate }}</p>
              <ion-button routerLink="/live">{{ 'COMMON.BACK' | translate }}</ion-button>
            </div>
          }
          @case ('preview') {
            <div class="setup">
              <input
                class="title"
                type="text"
                maxlength="120"
                [value]="title()"
                (input)="title.set($any($event.target).value)"
                [placeholder]="'LIVE.TITLE_PLACEHOLDER' | translate"
                [attr.aria-label]="'LIVE.TITLE_PLACEHOLDER' | translate"
              />
              <div class="row">
                <ion-select
                  class="audience"
                  interface="popover"
                  [value]="audience()"
                  (ionChange)="audience.set($event.detail.value)"
                  [attr.aria-label]="'AUDIENCE.TITLE' | translate"
                >
                  @for (option of audiences; track option.value) {
                    <ion-select-option [value]="option.value">{{
                      option.label | translate
                    }}</ion-select-option>
                  }
                </ion-select>
                <ion-button color="danger" shape="round" (click)="start()">
                  <ion-icon slot="start" name="radio-button-on" /> {{ 'LIVE.GO_LIVE' | translate }}
                </ion-button>
              </div>
            </div>
          }
          @case ('starting') {
            <div class="center">
              <ion-spinner name="crescent" />
              <p>{{ 'LIVE.STARTING' | translate }}</p>
            </div>
          }
          @case ('live') {
            <app-live-overlay
              [comments]="comments()"
              [reactions]="reactions()"
              [canComment]="true"
              (comment)="comment($event)"
              (react)="react($event)"
            />
            <ion-button class="end" color="danger" size="small" (click)="end()">{{
              'LIVE.END' | translate
            }}</ion-button>
          }
          @case ('ended') {
            <div class="center panel">
              <ion-icon name="checkmark-circle" />
              <h2>{{ 'LIVE.ENDED_TITLE' | translate }}</h2>
              @if (stream(); as summary) {
                <p>
                  {{
                    'LIVE.SUMMARY'
                      | translate
                        : {
                            peak: summary.peakViewerCount,
                            comments: summary.commentCount,
                            reactions: summary.reactionCount,
                          }
                  }}
                </p>
              }
              <ion-button routerLink="/">{{ 'NAV_TO_MAIN_PAGE' | translate }}</ion-button>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styleUrl: './live.scss',
})
export class LiveStudioPage implements OnInit, OnDestroy {
  private readonly live = inject(LiveService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly audiences = AUDIENCES;
  readonly phase = signal<Phase>('checking');
  readonly title = signal('');
  readonly audience = signal<Audience>('public');
  readonly micOn = signal(true);
  readonly cameraOn = signal(true);
  readonly viewers = signal(0);
  readonly elapsed = signal(0);
  readonly stream = signal<LiveStream | null>(null);
  readonly comments = signal<LiveComment[]>([]);
  readonly reactions = signal<FloatingReaction[]>([]);

  private readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');

  private room: Room | null = null;
  private videoTrack: LocalVideoTrack | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private facing: 'user' | 'environment' = 'user';
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private events: Subscription | null = null;
  private reactionId = 0;

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!(await this.live.enabled())) {
        this.phase.set('disabled');

        return;
      }

      await this.openCamera();
      this.phase.set('preview');
    } catch (error) {
      this.phase.set('disabled');
      await this.feedback.error(error, 'LIVE.CAMERA_DENIED');
    }
  }

  ngOnDestroy(): void {
    const stream = this.stream();

    if (this.phase() === 'live' && stream) {
      void this.live.end(stream.id).catch(() => undefined);
    }

    this.teardown();
  }

  async start(): Promise<void> {
    this.phase.set('starting');

    try {
      const { Room } = await import('livekit-client');
      const connection = await this.live.start({
        title: this.title().trim() || undefined,
        audience: this.audience(),
      });

      this.stream.set(connection.stream);
      this.room = new Room({ adaptiveStream: false, dynacast: true });
      await this.room.connect(connection.serverUrl, connection.token);

      if (this.videoTrack) {
        await this.room.localParticipant.publishTrack(this.videoTrack);
      }

      if (this.audioTrack) {
        await this.room.localParticipant.publishTrack(this.audioTrack);
      }

      this.listen(connection.stream.id);
      this.phase.set('live');

      const startedAt = Date.parse(connection.stream.startedAt);
      this.clock = setInterval(() => this.elapsed.set(Date.now() - startedAt), 1000);
      this.heartbeat = setInterval(() => {
        void this.live
          .heartbeat(connection.stream.id)
          .then((state) => {
            this.viewers.set(state.viewerCount);

            if (state.status === 'ended') {
              void this.finish();
            }
          })
          .catch(() => undefined);
      }, HEARTBEAT_MS);
    } catch (error) {
      this.phase.set('preview');
      await this.feedback.error(error);
    }
  }

  async end(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'LIVE.END',
      message: 'LIVE.END_MESSAGE',
      confirmText: 'LIVE.END',
      danger: true,
    });

    if (confirmed) {
      await this.finish();
    }
  }

  async leave(): Promise<void> {
    if (this.phase() === 'live') {
      await this.end();

      return;
    }

    await this.router.navigateByUrl('/live');
  }

  async comment(body: string): Promise<void> {
    const stream = this.stream();

    if (stream) {
      await this.live
        .comment(stream.id, body)
        .catch((error: unknown) => this.feedback.error(error));
    }
  }

  async react(emoji: string): Promise<void> {
    const stream = this.stream();

    if (stream) {
      this.float(emoji);
      await this.live.react(stream.id, emoji).catch(() => undefined);
    }
  }

  async toggleMic(): Promise<void> {
    if (!this.audioTrack) {
      return;
    }

    if (this.micOn()) {
      await this.audioTrack.mute();
    } else {
      await this.audioTrack.unmute();
    }

    this.micOn.set(!this.micOn());
  }

  async toggleCamera(): Promise<void> {
    if (!this.videoTrack) {
      return;
    }

    if (this.cameraOn()) {
      await this.videoTrack.mute();
    } else {
      await this.videoTrack.unmute();
    }

    this.cameraOn.set(!this.cameraOn());
  }

  async flipCamera(): Promise<void> {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    await this.videoTrack?.restartTrack({ facingMode: this.facing }).catch(() => undefined);
  }

  private async openCamera(): Promise<void> {
    const { createLocalTracks, Track, VideoPresets } = await import('livekit-client');
    const tracks = await createLocalTracks({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: this.facing, resolution: VideoPresets.h720.resolution },
    });

    for (const track of tracks) {
      if (track.kind === Track.Kind.Video) {
        this.videoTrack = track as LocalVideoTrack;
        const element = this.preview()?.nativeElement;

        if (element) {
          this.videoTrack.attach(element);
        }
      } else {
        this.audioTrack = track as LocalAudioTrack;
      }
    }
  }

  private listen(streamId: string): void {
    void this.live
      .comments(streamId)
      .then((page) => this.comments.set([...page.data].reverse()))
      .catch(() => undefined);

    this.events = this.live
      .events(streamId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        switch (event.type) {
          case 'comment':
            if (event.comment) {
              const comment = event.comment;
              this.comments.update((items) => [...items.slice(-99), comment]);
            }
            break;
          case 'reaction':
            if (event.reaction) {
              this.float(event.reaction);
            }
            break;
          case 'viewer_count':
            this.viewers.set(event.viewerCount ?? this.viewers());
            break;
          case 'ended':
            void this.finish();
            break;
        }
      });
  }

  private float(emoji: string): void {
    const id = ++this.reactionId;
    this.reactions.update((items) => [
      ...items.slice(-30),
      { id, emoji, left: 10 + Math.random() * 70 },
    ]);
    setTimeout(
      () => this.reactions.update((items) => items.filter((item) => item.id !== id)),
      2700,
    );
  }

  private async finish(): Promise<void> {
    const stream = this.stream();

    if (this.phase() === 'ended') {
      return;
    }

    this.phase.set('ended');

    if (stream) {
      const summary = await this.live.end(stream.id).catch(() => null);

      if (summary) {
        this.stream.set(summary);
      }
    }

    this.teardown();
  }

  private teardown(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }

    if (this.clock) {
      clearInterval(this.clock);
    }

    this.events?.unsubscribe();
    void this.room?.disconnect();
    this.room = null;
    this.videoTrack?.stop();
    this.audioTrack?.stop();
    this.videoTrack = null;
    this.audioTrack = null;
  }
}
