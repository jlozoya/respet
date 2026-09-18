import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFabButton } from '@ionic/angular/ion-fab-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Bulletin } from '@social-network/shared';

import { BulletinsService } from '../../core/api/content.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { EntityMenuComponent } from '../../shared/components/entity-menu.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { BulletinFormComponent } from './bulletin-form/bulletin-form.component';

@Component({
  selector: 'app-bulletins',
  templateUrl: './bulletins.page.html',
  styleUrls: ['./bulletins.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TranslatePipe,
    PageHeaderComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonSearchbar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class BulletinsPage {
  private readonly bulletins = inject(BulletinsService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly popoverCtrl = inject(PopoverController);

  readonly items = signal<readonly Bulletin[]>([]);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  readonly isAdmin = this.auth.isAdmin;
  readonly fallbackImage = './assets/imgs/bulletin/newspaper.png';

  private page = 1;

  constructor() {
    void this.load({ reset: true });
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

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackImage;
  }

  async create(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: BulletinFormComponent });

    await modal.present();

    const { data } = await modal.onWillDismiss<Bulletin>();

    if (data) {
      this.items.update((current) => [data, ...current]);
    }
  }

  async openMenu(event: Event, bulletin: Bulletin): Promise<void> {
    const popover = await this.popoverCtrl.create({
      component: EntityMenuComponent,
      componentProps: { canUpdate: true, canDelete: true },
      event,
    });

    await popover.present();

    const { data } = await popover.onWillDismiss<'update' | 'delete'>();

    if (data === 'update') {
      await this.edit(bulletin);
    } else if (data === 'delete') {
      await this.confirmDelete(bulletin);
    }
  }

  private async edit(bulletin: Bulletin): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: BulletinFormComponent,
      componentProps: { bulletin },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss<Bulletin>();

    if (data) {
      this.items.update((current) => current.map((item) => (item.id === data.id ? data : item)));
    }
  }

  private async confirmDelete(bulletin: Bulletin): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_BULLETIN.TITLE',
      message: 'ALERTS.DELETE_BULLETIN.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.bulletins.remove(bulletin.id);
      this.items.update((current) => current.filter((item) => item.id !== bulletin.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async load(options: { reset: boolean }): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.page = options.reset ? 1 : this.page + 1;

    try {
      const result = await this.bulletins.list({
        page: this.page,
        perPage: 12,
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
