import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import { UserRole, type User } from '@social-network/shared';

import { UsersService } from '../../../core/api/users.service';
import { FeedbackService } from '../../../core/ui/feedback.service';

/** Elige el repartidor que se hará cargo de un pedido. */
@Component({
  selector: 'app-order-roundsman-modal',
  templateUrl: './order-roundsman-modal.component.html',
  styleUrls: ['./order-roundsman-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class OrderRoundsmanModalComponent {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly items = signal<readonly User[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  private page = 1;

  constructor() {
    void this.load({ reset: true });
  }

  async onSearch(term: string): Promise<void> {
    this.search.set(term);
    await this.load({ reset: true });
  }

  async loadMore(event: Event): Promise<void> {
    await this.load({ reset: false });
    void (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  select(user: User): void {
    void this.modalCtrl.dismiss(user, 'selected');
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  avatarOf(user: User): string {
    return user.avatar?.url ?? './assets/imgs/avatar.png';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.users.list({
        page: this.page,
        perPage: 20,
        role: UserRole.Roundsman,
        search: this.search() || undefined,
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
