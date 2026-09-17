import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Audience, LocationInput, Media, Post, PostKind } from '@respet/shared';

import { PostsService } from '../../core/api/posts.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { LocationSearchComponent } from '../location-search/location-search.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { describeLocation } from '../../shared/location-text';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { AUDIENCES } from '../../shared/utils/audience';
import { SharedPostPreviewComponent } from './shared-post-preview.component';

const KINDS: readonly { value: PostKind; label: string; icon: string }[] = [
  { value: 'general', label: 'POST_KINDS.GENERAL', icon: 'chatbox-ellipses-outline' },
  { value: 'question', label: 'POST_KINDS.QUESTION', icon: 'help-circle-outline' },
  { value: 'event', label: 'POST_KINDS.EVENT', icon: 'calendar-outline' },
  { value: 'offer', label: 'POST_KINDS.OFFER', icon: 'gift-outline' },
  { value: 'request', label: 'POST_KINDS.REQUEST', icon: 'hand-left-outline' },
];

/** Lo que se añade al publicar, con su vista previa local. */
interface PendingFile {
  file: File;
  url: string;
  video: boolean;
}

/** Fotos y vídeos por publicación, como admite el servidor. */
const MAX_MEDIA = 10;

/**
 * «Crear publicación», la ventana de Facebook.
 *
 * Sirve para publicar, para editar lo ya publicado y para compartir otra
 * publicación con un comentario encima. Las fotos y los vídeos viajan en la
 * misma operación que el texto.
 */
@Component({
  selector: 'app-post-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    AvatarComponent,
    FullNamePipe,
    SharedPostPreviewComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ (post() ? 'COMPOSER.EDIT_TITLE' : sharedPost() ? 'COMPOSER.SHARE_TITLE' : 'COMPOSER.TITLE') | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()" [attr.aria-label]="'CLOSE' | translate"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="author">
        <app-avatar [user]="auth.user()" [size]="44" />
        <div class="author-text">
          <span class="rs-strong">{{ auth.user() | fullName }}</span>
          <span class="selectors">
            <ion-select
              class="pill"
              interface="popover"
              [value]="audience()"
              (ionChange)="audience.set($event.detail.value)"
              [attr.aria-label]="'AUDIENCE.TITLE' | translate"
            >
              @for (option of audiences; track option.value) {
                <ion-select-option [value]="option.value">{{ option.label | translate }}</ion-select-option>
              }
            </ion-select>
            <ion-select
              class="pill"
              interface="popover"
              [value]="kind()"
              (ionChange)="kind.set($event.detail.value)"
              [attr.aria-label]="'POST_KINDS.TITLE' | translate"
            >
              @for (option of kinds; track option.value) {
                <ion-select-option [value]="option.value">{{ option.label | translate }}</ion-select-option>
              }
            </ion-select>
          </span>
        </div>
      </div>

      <ion-textarea
        class="text"
        [autoGrow]="true"
        [rows]="media().length || pending().length || sharedPost() ? 2 : 5"
        [maxlength]="5000"
        [value]="text()"
        (ionInput)="text.set($event.detail.value ?? '')"
        [placeholder]="'COMPOSER.PLACEHOLDER' | translate: { name: auth.user()?.firstName }"
        [attr.aria-label]="'COMPOSER.PLACEHOLDER' | translate: { name: auth.user()?.firstName }"
      />

      @if (sharedPost(); as shared) {
        <app-shared-post-preview [post]="shared" />
      }

      @if (media().length || pending().length) {
        <div class="gallery">
          @for (item of media(); track item.id) {
            <div class="thumb">
              <img [src]="item.posterUrl ?? item.url" [alt]="item.alt" />
              <button type="button" class="remove" (click)="removeExisting(item)" [attr.aria-label]="'REMOVE' | translate">
                <ion-icon name="close" />
              </button>
            </div>
          }
          @for (item of pending(); track item.url) {
            <div class="thumb">
              @if (item.video) {
                <video [src]="item.url" muted></video>
                <ion-icon class="video" name="videocam" />
              } @else {
                <img [src]="item.url" alt="" />
              }
              <button type="button" class="remove" (click)="removePending(item)" [attr.aria-label]="'REMOVE' | translate">
                <ion-icon name="close" />
              </button>
            </div>
          }
        </div>
      }

      @if (location(); as place) {
        <div class="place">
          <ion-icon name="location" />
          <span>{{ placeLabel(place) }}</span>
          <button type="button" class="rs-icon-btn plain" (click)="location.set(null)" [attr.aria-label]="'REMOVE' | translate">
            <ion-icon name="close" />
          </button>
        </div>
      }

      <div class="add">
        <span class="rs-strong">{{ 'COMPOSER.ADD_TO_POST' | translate }}</span>
        <span class="add-actions">
          @if (!sharedPost()) {
            <button type="button" class="rs-icon-btn plain photo" (click)="fileInput.click()" [title]="'COMPOSER.PHOTO_VIDEO' | translate">
              <ion-icon name="images" />
            </button>
          }
          <button type="button" class="rs-icon-btn plain place-btn" (click)="pickLocation()" [title]="'COMPOSER.LOCATION' | translate">
            <ion-icon name="location" />
          </button>
        </span>
      </div>

      <div class="rs-row toggle">
        <span class="rs-row-text">
          <span class="title">{{ 'COMPOSER.DISABLE_COMMENTS' | translate }}</span>
        </span>
        <ion-toggle [checked]="commentsDisabled()" (ionChange)="commentsDisabled.set($event.detail.checked)" [attr.aria-label]="'COMPOSER.DISABLE_COMMENTS' | translate" />
      </div>

      <input #fileInput type="file" hidden multiple accept="image/*,video/*" (change)="onFiles($event)" />
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button class="publish" expand="block" [disabled]="!canPublish() || busy()" (click)="publish()">
          {{ (busy() ? 'COMPOSER.PUBLISHING' : post() ? 'SAVE' : 'COMPOSER.PUBLISH') | translate }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styleUrl: './post-composer.component.scss',
})
export class PostComposerComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly posts = inject(PostsService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  /** La publicación que se edita. */
  readonly post = input<Post | null>(null);
  /** La publicación que se comparte. */
  readonly sharedPost = input<Post | null>(null);
  /** Abrir directamente el selector de fotos. */
  readonly openFiles = input(false);

  readonly audiences = AUDIENCES;
  readonly kinds = KINDS;

  readonly text = signal('');
  readonly audience = signal<Audience>('public');
  readonly kind = signal<PostKind>('general');
  readonly commentsDisabled = signal(false);
  readonly location = signal<LocationInput | null>(null);
  readonly media = signal<Media[]>([]);
  readonly pending = signal<PendingFile[]>([]);
  readonly removed = signal<string[]>([]);
  readonly busy = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly canPublish = computed(
    () => this.text().trim().length > 0 || this.media().length > 0 || this.pending().length > 0 || !!this.sharedPost(),
  );

  ngOnInit(): void {
    const post = this.post();

    if (post) {
      this.text.set(post.description);
      this.audience.set(post.audience);
      this.kind.set(post.kind);
      this.commentsDisabled.set(post.commentsDisabled);
      this.location.set(post.location ? { ...post.location } : null);
      this.media.set(post.media);
    }

    if (this.openFiles()) {
      setTimeout(() => this.fileInput()?.nativeElement.click(), 350);
    }
  }

  ngOnDestroy(): void {
    for (const item of this.pending()) {
      URL.revokeObjectURL(item.url);
    }
  }

  placeLabel(place: LocationInput): string {
    return describeLocation(place) ?? '';
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const room = MAX_MEDIA - this.media().length - this.pending().length;
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));

    if (files.length > room) {
      void this.feedback.toast('COMPOSER.TOO_MANY_FILES');
    }

    this.pending.update((current) => [
      ...current,
      ...files.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file), video: file.type.startsWith('video/') })),
    ]);
    input.value = '';
  }

  removePending(item: PendingFile): void {
    URL.revokeObjectURL(item.url);
    this.pending.update((current) => current.filter((entry) => entry !== item));
  }

  removeExisting(item: Media): void {
    this.media.update((current) => current.filter((entry) => entry.id !== item.id));
    this.removed.update((current) => [...current, item.id]);
  }

  async pickLocation(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: LocationSearchComponent,
      componentProps: { current: this.location() },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss<LocationInput | null>();

    if (role === 'chosen') {
      this.location.set(data ?? null);
    }
  }

  async publish(): Promise<void> {
    this.busy.set(true);

    const request = {
      description: this.text().trim(),
      audience: this.audience(),
      kind: this.kind(),
      commentsDisabled: this.commentsDisabled(),
      location: this.location() ? stripId(this.location()) : null,
    };

    try {
      const existing = this.post();
      let result: Post;

      if (existing) {
        await Promise.all(this.removed().map((mediaId) => this.posts.removeMedia(existing.id, mediaId)));

        for (const item of this.pending()) {
          await this.posts.addMedia(existing.id, item.file);
        }

        result = await this.posts.update(existing.id, request);
      } else {
        result = await this.posts.create(
          { ...request, sharedPostId: this.sharedPost()?.id },
          this.pending().map((item) => item.file),
        );
      }

      await this.feedback.toast(existing ? 'COMPOSER.UPDATED' : 'COMPOSER.PUBLISHED', { color: 'success', duration: 2000 });
      await this.modalCtrl.dismiss(result, 'published');
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }
}

function stripId(location: LocationInput | null): LocationInput | null {
  if (!location) {
    return null;
  }

  const { country, state, city, route, streetNumber, postalCode, lat, lng } = location;

  return { country, state, city, route, streetNumber, postalCode, lat, lng };
}
