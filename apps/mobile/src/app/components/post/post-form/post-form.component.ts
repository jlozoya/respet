import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonCard } from '@ionic/angular/ion-card';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRange } from '@ionic/angular/ion-range';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { Platform } from '@ionic/angular/platform';
import { TranslatePipe } from '@ngx-translate/core';
import { PostKind, type LocationInput, type Media, type Post } from '@respet/shared';

import { PostsService } from '../../../core/api/content.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../../shared/components/control-messages.component';
import { describeLocation } from '../../../shared/location-text';
import { LocationSearchComponent } from '../../location-search/location-search.component';

/** Imágenes por publicación; el servidor aplica el mismo tope. */
const MAX_IMAGES = 6;

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/** Imagen aún sin subir, con su vista previa local. */
interface PendingImage {
  blob: Blob;
  previewUrl: string;
}

/**
 * Alta y edición de una publicación.
 *
 * Un solo componente para ambas cosas, en lugar de los dos que había
 * (`post-form` y `post-update`), que compartían casi todo el código y se
 * desincronizaban con facilidad. Se distingue por si llega o no un `post`.
 *
 * Puede usarse dentro de una página o abrirse como modal; en el segundo caso
 * se cierra devolviendo la publicación guardada.
 */
@Component({
  selector: 'app-post-form',
  templateUrl: './post-form.component.html',
  styleUrls: ['./post-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonCard,
    IonIcon,
    IonContent,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonRange,
  ],
})
export class PostFormComponent {
  private readonly posts = inject(PostsService);
  private readonly auth = inject(AuthService);
  private readonly picker = inject(ImagePickerService);
  private readonly platform = inject(Platform);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  /** Publicación a editar. Sin ella el formulario crea una nueva. */
  readonly post = input<Post | null>(null);
  /** Cierto cuando se muestra dentro de un modal. */
  readonly asModal = input(true);

  readonly saved = output<Post>();

  readonly saving = signal(false);
  readonly location = signal<LocationInput | null>(null);
  readonly pending = signal<readonly PendingImage[]>([]);
  readonly existing = signal<readonly Media[]>([]);

  readonly isEdit = computed(() => this.post() !== null);

  /**
   * Quién firma lo que se escribe.
   *
   * Al editar es el autor de la publicación —que puede no ser quien edita, si
   * modera un administrador— y al crear, uno mismo.
   */
  private readonly author = computed(() => this.post()?.author ?? this.auth.user());
  readonly authorName = computed(() => this.author()?.name ?? '');
  readonly avatarUrl = computed(() => this.author()?.avatar?.url ?? FALLBACK_AVATAR);
  readonly imageCount = computed(() => this.existing().length + this.pending().length);
  /** Cómo se lee el sitio elegido, o nada si no hay ninguno. */
  readonly locationLabel = computed(() => {
    const location = this.location();

    return location ? describeLocation(location) : null;
  });
  readonly canAddImages = computed(() => this.imageCount() < MAX_IMAGES);

  readonly kinds = [
    { value: PostKind.General, label: 'POST.KINDS.GENERAL' },
    { value: PostKind.Question, label: 'POST.KINDS.QUESTION' },
    { value: PostKind.Event, label: 'POST.KINDS.EVENT' },
    { value: PostKind.Offer, label: 'POST.KINDS.OFFER' },
    { value: PostKind.Request, label: 'POST.KINDS.REQUEST' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    kind: [PostKind.General as PostKind, [Validators.required]],
    locationAccuracy: [0, [Validators.min(0), Validators.max(25)]],
  });

  constructor() {
    const current = this.post();

    if (current) {
      this.form.patchValue({
        description: current.description,
        kind: current.kind,
        locationAccuracy: current.locationAccuracy,
      });
      this.existing.set(current.media);

      if (current.location) {
        this.location.set(toInput(current.location));
      }
    }
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_AVATAR;
  }

  /**
   * Abre el buscador de sitios y se queda con lo que devuelva.
   *
   * Vuelve con la ubicación elegida, con `null` si se quitó la que había, o sin
   * nada si se salió sin tocar; sólo en los dos primeros casos hay que hacer
   * algo.
   */
  async searchLocation(): Promise<void> {
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

  clearLocation(): void {
    this.location.set(null);
  }

  /**
   * Añade imágenes por el camino que corresponda a donde se esté.
   *
   * En el navegador, el diálogo de archivos del sistema, que además deja
   * elegir varias de una vez; en la aplicación instalada, la hoja de cámara o
   * galería, que es lo que uno espera de un teléfono.
   */
  async addImage(): Promise<void> {
    if (!this.canAddImages()) {
      await this.feedback.toast('POST.MAX_IMAGES', { color: 'warning' });

      return;
    }

    if (!this.platform.is('capacitor')) {
      this.fileInput()?.nativeElement.click();

      return;
    }

    const blob = await this.picker.pick({ aspectRatio: 4 / 3, targetWidth: 1600 });

    if (!blob) {
      return;
    }

    this.pending.update((current) => [
      ...current,
      { blob, previewUrl: URL.createObjectURL(blob) },
    ]);
  }

  /** Añade las imágenes que llegan de un `<input type="file">`. */
  async addFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = this.picker.fromFileList(input.files);
    const room = MAX_IMAGES - this.imageCount();

    for (const file of files.slice(0, room)) {
      const blob = await this.picker.crop(file, { aspectRatio: 4 / 3, targetWidth: 1600 });

      if (blob) {
        this.pending.update((current) => [
          ...current,
          { blob, previewUrl: URL.createObjectURL(blob) },
        ]);
      }
    }

    // Sin esto, volver a elegir el mismo archivo no dispararía el evento.
    input.value = '';
  }

  /**
   * Vuelve a recortar una foto que todavía no ha subido.
   *
   * Sustituye la pendiente por la nueva en su sitio, para que no se cuele al
   * final de la fila cuando hay varias. Si se sale del recortador sin
   * confirmar, se queda la de antes.
   */
  async editPending(image: PendingImage): Promise<void> {
    const blob = await this.picker.crop(image.blob, { aspectRatio: 4 / 3, targetWidth: 1600 });

    if (!blob) {
      return;
    }

    URL.revokeObjectURL(image.previewUrl);
    this.pending.update((current) =>
      current.map((item) =>
        item === image ? { blob, previewUrl: URL.createObjectURL(blob) } : item,
      ),
    );
  }

  removePending(image: PendingImage): void {
    // Liberar la URL evita que el navegador retenga el Blob en memoria.
    URL.revokeObjectURL(image.previewUrl);
    this.pending.update((current) => current.filter((item) => item !== image));
  }

  async removeExisting(media: Media): Promise<void> {
    const current = this.post();

    if (!current) {
      return;
    }

    try {
      await this.posts.removeImage(current.id, media.id);
      this.existing.update((items) => items.filter((item) => item.id !== media.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.saving.set(true);

    try {
      const values = this.form.getRawValue();
      const payload = {
        description: values.description,
        kind: values.kind,
        locationAccuracy: values.locationAccuracy,
        location: this.location(),
      };

      const current = this.post();
      let result = current
        ? await this.posts.update(current.id, payload)
        : await this.posts.create(payload);

      result = await this.uploadPending(result);

      this.saved.emit(result);

      if (this.asModal()) {
        await this.modalCtrl.dismiss(result, 'saved');
      } else {
        this.reset();
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  /**
   * Sube las imágenes pendientes.
   *
   * Van una a una y después de guardar la publicación, porque la API las
   * asocia por su id. Si alguna falla se avisa, pero la publicación ya está
   * creada y no se pierde lo escrito.
   */
  private async uploadPending(post: Post): Promise<Post> {
    const images = this.pending();

    if (images.length === 0) {
      return post;
    }

    const uploaded: Media[] = [];

    for (const image of images) {
      try {
        uploaded.push(await this.posts.addImage(post.id, image.blob, 'post.webp'));
        URL.revokeObjectURL(image.previewUrl);
      } catch (error) {
        await this.feedback.error(error, 'POST.IMAGE_UPLOAD_FAILED');
      }
    }

    this.pending.set([]);

    return { ...post, media: [...post.media, ...uploaded] };
  }

  private reset(): void {
    this.form.reset({ description: '', kind: PostKind.General, locationAccuracy: 0 });
    this.location.set(null);

    for (const image of this.pending()) {
      URL.revokeObjectURL(image.previewUrl);
    }

    this.pending.set([]);
  }
}

function toInput(location: Post['location']): LocationInput | null {
  if (!location) {
    return null;
  }

  const { id: _id, ...rest } = location;

  return rest;
}
