import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonProgressBar } from '@ionic/angular/ion-progress-bar';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import type { Post, PublicProfile, UserContact } from '@respet/shared';

import { ChatService } from '../../core/api/chat.service';
import { PostsService } from '../../core/api/content.service';
import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { InfoRailComponent } from '../../components/shell/info-rail/info-rail.component';
import { ProfileAboutComponent } from '../../components/shell/profile-about/profile-about.component';
import { ProfileHeaderComponent } from '../../components/shell/profile-header/profile-header.component';
import { PostCardComponent } from '../../components/post/post-card/post-card.component';
import { PostFormComponent } from '../../components/post/post-form/post-form.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Muro de publicaciones, con el formulario de alta en cabecera.
 *
 * Un solo muro, sin conmutador entre «descubrir» y «siguiendo»: partir la
 * portada en dos obliga a elegir antes de leer nada, y ninguna red social lo
 * hace. El servidor sigue sabiendo filtrar por a quién se sigue, por si algún
 * día eso merece su propia pantalla.
 */
@Component({
  selector: 'app-wall',
  templateUrl: './wall.page.html',
  styleUrls: ['./wall.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    PageHeaderComponent,
    PostFormComponent,
    InfoRailComponent,
    ProfileAboutComponent,
    ProfileHeaderComponent,
    PostCardComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonProgressBar,
    IonSearchbar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class WallPage {
  private readonly posts = inject(PostsService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  /** Filtra por autor cuando se llega desde la ficha de un usuario. */
  readonly userId = input<string | null>(null);

  readonly items = signal<readonly Post[]>([]);
  readonly contact = signal<UserContact | null>(null);
  readonly profile = signal<PublicProfile | null>(null);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  readonly isAuthenticated = this.auth.isAuthenticated;

  /**
   * Cierto en el muro de todos; falso en el de una persona.
   *
   * Se pregunta por lo que hay, no por `=== null`: cuando la dirección no
   * lleva `userId`, el enrutador deja la entrada en `undefined`, y comparar
   * con `null` daba falso en la portada —lo que escondía el formulario de
   * publicar justo donde tiene que estar—.
   */
  readonly isMainWall = computed(() => !this.userId());

  /** Cierto en el muro propio, que se ve como el de cualquiera pero se edita. */
  readonly isOwnWall = computed(() => {
    const id = this.userId();

    return id !== null && id !== undefined && id === this.auth.user()?.id;
  });

  private page = 1;

  constructor() {
    // Cambiar de autor —o volver al muro general— recarga la lista desde cero.
    //
    // La recarga se lanza dentro de `untracked` a propósito: un efecto vigila
    // todas las señales que lee mientras se ejecuta, y `load()` lee `loading`
    // —y `search`— antes del primer `await`, justo las que luego escribe. Sin
    // este aislamiento el efecto se dispara a sí mismo y el muro se queda
    // recargándose sin parar, con la barra de progreso encendida para siempre.
    effect(() => {
      const author = this.userId();

      untracked(() => void this.reload(author));
    });
  }

  /** Las fotos que ha publicado, para la cuadrícula de su ficha. */
  readonly photos = computed(() => this.items().flatMap((post) => post.media).slice(0, 9));

  /** Cierto cuando se puede escribir a quien firma este muro: no a uno mismo. */
  readonly canMessage = computed(
    () => this.isAuthenticated() && this.profile()?.followedByMe !== null,
  );

  /** Abre la conversación con esta persona, creándola si no la había. */
  async messageTo(person: PublicProfile): Promise<void> {
    try {
      const conversation = await this.chat.startConversationWith(person.id);
      await this.router.navigate(['/chat', conversation.id]);
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async toggleFollow(): Promise<void> {
    const person = this.profile();

    if (!person || person.followedByMe === null) {
      return;
    }

    try {
      const result = person.followedByMe
        ? await this.users.unfollow(person.id)
        : await this.users.follow(person.id);

      this.profile.set({
        ...person,
        followerCount: result.followerCount,
        followedByMe: result.followedByMe,
      });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async onSearch(term: string): Promise<void> {
    this.search.set(term);
    await this.load({ reset: true });
  }

  async refresh(event: Event): Promise<void> {
    await this.load({ reset: true });
    void (event.target as HTMLIonRefresherElement).complete();
  }

  async loadMore(event: Event): Promise<void> {
    await this.load({ reset: false });
    void (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  /** Coloca arriba la publicación recién creada, sin recargar el muro. */
  onCreated(post: Post): void {
    this.items.update((current) => [post, ...current]);
  }

  onUpdated(post: Post): void {
    this.items.update((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  onDeleted(post: Post): void {
    this.items.update((current) => current.filter((item) => item.id !== post.id));
  }

  private async reload(author: string | null): Promise<void> {
    this.contact.set(null);
    this.profile.set(null);

    if (author) {
      try {
        this.profile.set(await this.users.profile(author));
      } catch {
        // La ficha pública no debería fallar, pero si lo hace el muro de esa
        // persona se sigue pudiendo leer.
      }

      try {
        this.contact.set(await this.users.contact(author));
      } catch {
        // Puede que el usuario no comparta ningún dato: el muro sigue siendo
        // visible aunque no haya ficha de contacto.
      }
    }

    await this.load({ reset: true });
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.posts.list({
        page: this.page,
        perPage: 10,
        search: this.search() || undefined,
        userId: this.userId() ?? undefined,
      });

      this.items.update((current) =>
        options.reset ? result.data : [...current, ...result.data],
      );
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      await this.feedback.error(error);
      this.hasMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }
}
