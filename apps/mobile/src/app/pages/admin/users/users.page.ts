import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { TranslatePipe } from '@ngx-translate/core';
import { UserRole, type User } from '@respet/shared';

import { UsersService } from '../../../core/api/users.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { UserCardComponent } from '../../../components/user/user-card/user-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    UserCardComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonLabel,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
  ],
})
export class UsersPage {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);

  readonly items = signal<readonly User[]>([]);
  readonly search = signal('');
  readonly role = signal<UserRole | null>(null);
  readonly loading = signal(false);
  readonly hasMore = signal(true);

  readonly roles = [
    { value: null, label: 'ALL' },
    { value: UserRole.Visitor, label: 'VISITOR' },
    { value: UserRole.User, label: 'USER' },
    { value: UserRole.Roundsman, label: 'ROUNDSMAN' },
    { value: UserRole.Supervisor, label: 'SUPERVISOR' },
    { value: UserRole.Admin, label: 'ADMIN' },
  ];

  private page = 1;

  constructor() {
    void this.load({ reset: true });
  }

  async onSearch(term: string): Promise<void> {
    this.search.set(term);
    await this.load({ reset: true });
  }

  async changeRole(role: UserRole | null): Promise<void> {
    this.role.set(role);
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

  onRoleChanged(user: User): void {
    this.items.update((current) => current.map((item) => (item.id === user.id ? user : item)));
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
        perPage: 12,
        search: this.search() || undefined,
        role: this.role() ?? undefined,
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
