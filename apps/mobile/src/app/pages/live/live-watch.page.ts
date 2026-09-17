import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  type OnDestroy,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { LiveComment, LiveStream } from '@respet/shared';
import type { RemoteTrack, Room } from 'livekit-client';
import type { Subscription } from 'rxjs';

import { LiveOverlayComponent, type FloatingReaction } from '../../components/live/live-overlay.component';
import { LiveService } from '../../core/api/live.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

type Phase = 'loading' | 'connecting' | 'watching' | 'ended' | 'failed';

/**
 * Mirar un directo.
 *
 * Se entra en la sala de LiveKit con un pase de sólo mirar y se engancha el
 * vídeo y el audio de quien emite. Los comentarios y las reacciones llegan por
 * la suscripción de la API. Si el navegador no deja reproducir sonido sin un
 * toque previo, se ofrece activarlo.
 */
@Component({
  selector: 'app-live-watch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, IonButton, IonIcon, IonSpinner, AvatarComponent, LiveOverlayComponent, CompactNumberPipe, FullNamePipe],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false" class="studio">
      <div class="stage">
        <video #video class="video" autoplay playsinline></video>
        <audio #audio autoplay></audio>

        <header class="top">
          <button type="button" class="icon" (click)="leave()" [attr.aria-label]="'CLOSE' | translate"><ion-icon name="close" /></button>
          @if (stream(); as current) {
            <a class="host" [routerLink]="['/profile', current.host.name]">
              <app-avatar [user]="current.host" [size]="36" ring="live" />
              <span class="name rs-ellipsis">{{ current.host | fullName }}</span>
            </a>
            @if (phase() === 'watching') {
              <span class="rs-live-badge">{{ 'LIVE.BADGE' | translate }}</span>
              <span class="pill"><ion-icon name="eye" /> {{ viewers() | compactNumber }}</span>
            }
          }
          <span class="spacer"></span>
          <button type="button" class="icon" (click)="report()" [attr.aria-label]="'REPORT' | translate"><ion-icon name="flag-outline" /></button>
        </header>

        @switch (phase()) {
          @case ('loading') {
            <div class="center"><ion-spinner name="crescent" /></div>
          }
          @case ('connecting') {
            <div class="center"><ion-spinner name="crescent" /><p>{{ 'LIVE.CONNECTING' | translate }}</p></div>
          }
          @case ('watching') {
            @if (stream()?.title) {
              <p class="stream-title">{{ stream()?.title }}</p>
            }
            @if (audioBlocked()) {
              <ion-button class="unmute" shape="round" (click)="enableAudio()">
                <ion-icon slot="start" name="volume-high" /> {{ 'LIVE.TAP_FOR_SOUND' | translate }}
              </ion-button>
            }
            <app-live-overlay [comments]="comments()" [reactions]="reactions()" (comment)="comment($event)" (react)="react($event)" />
          }
          @case ('ended') {
            <div class="center panel">
              <ion-icon name="videocam-off-outline" />
              <h2>{{ 'LIVE.ENDED_TITLE' | translate }}</h2>
              <p>{{ 'LIVE.ENDED' | translate }}</p>
              <ion-button routerLink="/live">{{ 'LIVE.MORE_LIVES' | translate }}</ion-button>
            </div>
          }
          @case ('failed') {
            <div class="center panel">
              <ion-icon name="alert-circle-outline" />
              <p>{{ 'LIVE.JOIN_FAILED' | translate }}</p>
              <ion-button routerLink="/live">{{ 'COMMON.BACK' | translate }}</ion-button>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styleUrl: './live.scss',
  styles: `
    .stream-title {
      background: rgb(0 0 0 / 40%);
      border-radius: 6px;
      left: 12px;
      margin: 0;
      padding: 4px 10px;
      position: absolute;
      top: calc(64px + var(--ion-safe-area-top, 0px));
    }
  `,
})
export class LiveWatchPage implements OnDestroy {
  private readonly live = inject(LiveService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  readonly phase = signal<Phase>('loading');
  readonly stream = signal<LiveStream | null>(null);
  readonly viewers = signal(0);
  readonly comments = signal<LiveComment[]>([]);
  readonly reactions = signal<FloatingReaction[]>([]);
  readonly audioBlocked = signal(false);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');

  private room: Room | null = null;
  private events: Subscription | null = null;
  private reactionId = 0;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.join(id));
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  async enableAudio(): Promise<void> {
    await this.room?.startAudio();
    this.audioBlocked.set(!(this.room?.canPlaybackAudio ?? true));
  }

  async comment(body: string): Promise<void> {
    await this.live.comment(this.id(), body).catch((error: unknown) => this.feedback.error(error));
  }

  async react(emoji: string): Promise<void> {
    this.float(emoji);
    await this.live.react(this.id(), emoji).catch(() => undefined);
  }

  async report(): Promise<void> {
    await this.reports.report('live', this.id());
  }

  async leave(): Promise<void> {
    this.disconnect();
    await this.router.navigateByUrl('/live');
  }

  private async join(id: string): Promise<void> {
    this.disconnect();
    this.phase.set('loading');

    try {
      const stream = await this.live.findById(id);
      this.stream.set(stream);
      this.viewers.set(stream.viewerCount);

      if (stream.status === 'ended') {
        this.phase.set('ended');

        return;
      }

      this.phase.set('connecting');

      const [{ Room, RoomEvent, Track }, connection] = await Promise.all([import('livekit-client'), this.live.join(id)]);

      this.room = new Room({ adaptiveStream: true, dynacast: true });
      this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          const element = this.video()?.nativeElement;

          if (element) {
            track.attach(element);
          }
        } else if (track.kind === Track.Kind.Audio) {
          const element = this.audio()?.nativeElement;

          if (element) {
            track.attach(element);
          }
        }
      });
      this.room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        this.audioBlocked.set(!(this.room?.canPlaybackAudio ?? true));
      });
      this.room.on(RoomEvent.Disconnected, () => {
        if (this.phase() === 'watching') {
          this.phase.set('ended');
        }
      });

      await this.room.connect(connection.serverUrl, connection.token);
      this.audioBlocked.set(!this.room.canPlaybackAudio);
      this.listen(id);

      const page = await this.live.comments(id).catch(() => null);

      if (page) {
        this.comments.set([...page.data].reverse());
      }

      this.phase.set('watching');
    } catch (error) {
      this.phase.set('failed');
      await this.feedback.error(error);
    }
  }

  private listen(id: string): void {
    this.events = this.live
      .events(id)
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
            this.phase.set('ended');
            this.disconnect();
            break;
        }
      });
  }

  private float(emoji: string): void {
    const id = ++this.reactionId;
    this.reactions.update((items) => [...items.slice(-30), { id, emoji, left: 10 + Math.random() * 70 }]);
    setTimeout(() => this.reactions.update((items) => items.filter((item) => item.id !== id)), 2700);
  }

  private disconnect(): void {
    this.events?.unsubscribe();
    this.events = null;
    void this.room?.disconnect();
    this.room = null;
  }
}
