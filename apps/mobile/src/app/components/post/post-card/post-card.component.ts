import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonText } from '@ionic/angular/ion-text';
import { ModalController } from '@ionic/angular/modal-controller';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Post, VoteValue } from '@respet/shared';

import { ChatService } from '../../../core/api/chat.service';
import { PostsService } from '../../../core/api/content.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { ShareService } from '../../../core/ui/share.service';
import { GalleryComponent } from '../../gallery/gallery.component';
import { PostFormComponent } from '../post-form/post-form.component';
import { EntityMenuComponent } from '../../../shared/components/entity-menu.component';
import { describeLocation } from '../../../shared/location-text';

@Component({
  selector: 'app-post-card',
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.embedded]': 'embedded()', '[class.detallada]': 'detailed()' },
  imports: [
    DatePipe,
    TranslatePipe,
    GalleryComponent,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonItem,
    IonAvatar,
    IonLabel,
    IonText,
    IonButton,
    IonIcon,
  ],
})
export class PostCardComponent {
  private readonly posts = inject(PostsService);
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly sharing = inject(ShareService);
  private readonly translate = inject(TranslateService);
  private readonly modalCtrl = inject(ModalController);
  private readonly popoverCtrl = inject(PopoverController);
  private readonly alertCtrl = inject(AlertController);
  private readonly router = inject(Router);

  readonly post = input.required<Post>();
  /** Cierto en la página de detalle, donde la tarjeta ya no enlaza a sí misma. */
  readonly detailed = input(false);
  /**
   * Cierto cuando la tarjeta va dentro de la ventana de detalle.
   *
   * Allí no repite las fotos, que ya están al lado, y pierde el marco: es una
   * columna más de la ventana, no una tarjeta suelta sobre el muro.
   */
  readonly embedded = input(false);

  readonly deleted = output<Post>();
  readonly updated = output<Post>();

  /** Copia local, para reflejar una edición sin recargar la lista entera. */
  private readonly overrides = signal<Post | null>(null);
  readonly current = computed(() => this.overrides() ?? this.post());

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly authorAvatar = computed(
    () => this.current().author.avatar?.url ?? './assets/imgs/avatar.png',
  );

  /**
   * La ubicación escrita, para enseñarla como un dato más de la publicación.
   *
   * Antes había un botón que abría un mapa a pantalla completa con la
   * publicación y las de alrededor. Era mucho ruido para responder a una
   * pregunta sencilla —«¿dónde es esto?»—: la dirección se lee de un vistazo y,
   * si alguien quiere el mapa, ya tiene el suyo instalado.
   *
   * De una publicación difuminada a propósito sólo se dice la parte ancha —la
   * población—: enseñar la calle y el número echaría por tierra justo lo que el
   * difuminado protege.
   */
  readonly address = computed(() => {
    const post = this.current();

    return post.location ? describeLocation(post.location, post.locationAccuracy > 0) : null;
  });

  /** Cierto cuando la ubicación se publicó a propósito sin precisar. */
  readonly approximate = computed(() => this.current().locationAccuracy > 0);

  /**
   * A dónde lleva el enlace.
   *
   * Con coordenadas se manda el punto —que el servidor ya difumina cuando toca—
   * y, si no las hay, la dirección escrita, que es lo que uno teclearía.
   */
  readonly mapsUrl = computed(() => {
    const location = this.current().location;
    const address = this.address();

    if (!location) {
      return null;
    }

    const query =
      location.lat != null && location.lng != null
        ? `${location.lat},${location.lng}`
        : (address ?? '');

    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  });

  /**
   * Abre el chat con el autor.
   *
   * Es la vía natural para responder en privado a una publicación, sin tener
   * que ir a buscar los datos de contacto de su autor en otra pantalla.
   */
  async messageAuthor(): Promise<void> {
    const author = this.current().author;

    try {
      const conversation = await this.chat.startConversationWith(author.id);
      await this.router.navigate(['/chat', conversation.id]);
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  /** Cierto salvo que la publicación sea del propio usuario. */
  readonly canMessageAuthor = computed(
    () => this.isAuthenticated() && this.current().author.id !== this.auth.user()?.id,
  );

  goToAuthor(): void {
    void this.router.navigate(['/profile', this.current().author.id]);
  }

  async share(): Promise<void> {
    const post = this.current();

    await this.sharing.share({
      title: this.translate.instant('SHARE._') as string,
      text: post.description,
      path: `/wall/${post.id}`,
    });
  }

  /**
   * Vota, cambia el sentido del voto o lo retira.
   *
   * Pulsar lo que ya se había votado lo quita, que es lo que espera cualquiera
   * que haya usado un botón de este tipo. Las cifras las dicta el servidor, que
   * las devuelve ya hechas: sumar uno aquí dejaría dos pestañas abiertas con
   * números distintos.
   */
  async vote(value: VoteValue): Promise<void> {
    const post = this.current();

    if (!this.isAuthenticated()) {
      await this.router.navigate(['/login']);

      return;
    }

    try {
      const result =
        post.myVote === value
          ? await this.posts.unvote(post.id)
          : await this.posts.vote(post.id, value);

      this.apply({
        ...post,
        likeCount: result.likeCount,
        dislikeCount: result.dislikeCount,
        myVote: result.myVote,
      });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  /**
   * Abre el detalle al pulsar en la tarjeta.
   *
   * Se aparta de donde ya había algo que pulsar —el autor, el menú, los votos,
   * la dirección, las fotos—: allí manda lo que hubiera, y abrir además la
   * ventana sería hacer dos cosas con un solo clic. Los componentes de Ionic
   * llevan su contenido en un «shadow root», así que el evento que llega aquí
   * apunta al elemento de fuera y basta con mirar sus ancestros.
   *
   * Tampoco abre nada si lo que hubo fue una selección de texto: quien acaba de
   * marcar una frase para copiarla no está pidiendo cambiar de pantalla.
   */
  onCardClick(event: Event): void {
    if (this.detailed() || window.getSelection()?.toString()) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest(PULSABLES)) {
      return;
    }

    void this.openDetail();
  }

  /**
   * Abre el detalle de la publicación: fotos y comentarios en una ventana.
   *
   * Estando ya en el detalle no hay a dónde ir: el contador se queda como una
   * cifra más, sin comportarse como un botón que no lleva a ninguna parte.
   */
  async openDetail(): Promise<void> {
    if (this.detailed()) {
      return;
    }

    // Carga diferida: el detalle enseña esta misma tarjeta, y el ciclo de
    // importaciones se rompe pidiéndolo sólo cuando hace falta.
    const { PostModalComponent } = await import('../post-modal/post-modal.component');

    const modal = await this.modalCtrl.create({
      component: PostModalComponent,
      componentProps: { post: this.current() },
      cssClass: 'modal-publicacion',
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Post>();

    if (data) {
      this.apply(data);
    }
  }

  /** Refleja un cambio en la tarjeta y avisa a la lista que la contiene. */
  apply(post: Post): void {
    this.overrides.set(post);
    this.updated.emit(post);
  }

  /** Menú contextual con las acciones que el usuario puede hacer. */
  async openMenu(event: Event): Promise<void> {
    const post = this.current();
    const isAuthor = this.auth.user()?.id === post.author.id;

    const popover = await this.popoverCtrl.create({
      component: EntityMenuComponent,
      componentProps: {
        canUpdate: isAuthor,
        canReport: !isAuthor,
        canDelete: isAuthor || this.auth.isAdmin(),
      },
      event,
    });

    await popover.present();

    const { data } = await popover.onWillDismiss<'update' | 'delete' | 'report'>();

    switch (data) {
      case 'update':
        await this.edit();
        break;
      case 'delete':
        await this.confirmDelete();
        break;
      case 'report':
        await this.report();
        break;
      default:
        break;
    }
  }

  private async edit(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PostFormComponent,
      componentProps: { post: this.current() },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Post>();

    if (data) {
      this.overrides.set(data);
      this.updated.emit(data);
    }
  }

  private async confirmDelete(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_POST.TITLE',
      message: 'ALERTS.DELETE_POST.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      const post = this.current();
      await this.posts.remove(post.id);
      this.deleted.emit(post);
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async report(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ALERTS.REPORT_POST.TITLE') as string,
      message: this.translate.instant('ALERTS.REPORT_POST.MESSAGE') as string,
      inputs: [
        {
          type: 'textarea',
          name: 'reason',
          attributes: { maxlength: 500 },
          placeholder: this.translate.instant('ALERTS.REPORT_POST.PLACEHOLDER') as string,
        },
      ],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ACCEPT') as string, role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: { reason?: string } }>();
    const reason = data?.values.reason?.trim();

    if (role !== 'confirm' || !reason) {
      return;
    }

    try {
      await this.posts.report(this.current().id, { reason });
      await this.feedback.toast('ALERTS.REPORT_POST.SUCCESS', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error, 'ALERTS.REPORT_POST.FAIL');
    }
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }
}

/** Lo que ya responde por su cuenta y no debe abrir además el detalle. */
const PULSABLES = 'ion-button, a, ion-item, app-gallery';
