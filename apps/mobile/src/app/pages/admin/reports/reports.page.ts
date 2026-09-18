import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Report, ReportStatus } from '@social-network/shared';

import { ModerationService } from '../../../core/api/content.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { FullNamePipe } from '../../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

/**
 * Moderación: lo que la gente denuncia, con enlace a lo denunciado y los dos
 * desenlaces posibles —revisada o descartada—, que se aplican también a las
 * demás denuncias sobre lo mismo.
 */
@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    AvatarComponent,
    PageHeaderComponent,
    FullNamePipe,
    RelativeTimePipe,
  ],
  template: `
    <app-page-header title="NAV.MODERATION" [always]="true" />

    <ion-content>
      <div class="rs-container">
        <div class="rs-chips filters">
          @for (option of statuses; track option.value) {
            <button
              type="button"
              class="rs-chip"
              [class.active]="status() === option.value"
              (click)="changeStatus(option.value)"
            >
              {{ option.label | translate }}
            </button>
          }
        </div>

        @for (report of reports(); track report.id) {
          <article class="rs-card report">
            <header class="head">
              <span class="kind">{{
                'MODERATION.TARGETS.' + report.targetType.toUpperCase() | translate
              }}</span>
              <span class="rs-small rs-muted">{{ report.createdAt | relativeTime }}</span>
            </header>

            <p class="reason">«{{ report.reason }}»</p>

            <div class="people">
              @if (report.reporter; as reporter) {
                <span class="person">
                  <app-avatar [user]="reporter" [size]="28" />
                  <span class="rs-small">{{
                    'MODERATION.REPORTED_BY' | translate: { name: (reporter | fullName) }
                  }}</span>
                </span>
              }
              @if (report.targetOwner; as owner) {
                <a class="person" [routerLink]="['/profile', owner.name]">
                  <app-avatar [user]="owner" [size]="28" />
                  <span class="rs-small">{{
                    'MODERATION.AUTHOR' | translate: { name: (owner | fullName) }
                  }}</span>
                </a>
              }
            </div>

            <footer class="actions">
              @if (link(report); as target) {
                <ion-button size="small" class="rs-soft" [routerLink]="target"
                  ><ion-icon slot="start" name="open-outline" />
                  {{ 'MODERATION.OPEN' | translate }}</ion-button
                >
              }
              @if (report.status === 'pending') {
                <ion-button size="small" class="rs-soft" (click)="resolve(report, 'dismissed')">{{
                  'MODERATION.DISMISS' | translate
                }}</ion-button>
                <ion-button size="small" (click)="resolve(report, 'reviewed')">{{
                  'MODERATION.REVIEWED' | translate
                }}</ion-button>
              } @else {
                <span class="rs-small rs-muted">
                  {{ 'MODERATION.STATUS.' + report.status.toUpperCase() | translate }}
                  @if (report.reviewedAt) {
                    · {{ report.reviewedAt | relativeTime }}
                  }
                </span>
              }
            </footer>
          </article>
        } @empty {
          @if (loading()) {
            <div class="rs-empty"><ion-spinner /></div>
          } @else {
            <div class="rs-empty">
              <ion-icon name="shield-checkmark-outline" />
              <h3>{{ 'MODERATION.EMPTY_TITLE' | translate }}</h3>
              <p>{{ 'MODERATION.EMPTY' | translate }}</p>
            </div>
          }
        }

        <ion-infinite-scroll [disabled]="!hasMore()" (ionInfinite)="loadMore($event)">
          <ion-infinite-scroll-content />
        </ion-infinite-scroll>
      </div>
    </ion-content>
  `,
  styles: `
    .filters {
      padding: 8px;
    }

    .report {
      padding: 16px;
    }

    .head {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }

    .kind {
      background: var(--rs-accent-soft);
      border-radius: 999px;
      color: var(--ion-color-primary);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 10px;
      text-transform: uppercase;
    }

    .reason {
      font-size: 1.0625rem;
      margin: 10px 0;
    }

    .people {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .person {
      align-items: center;
      color: inherit;
      display: flex;
      gap: 6px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
  `,
})
export class ReportsPage implements OnInit {
  private readonly moderation = inject(ModerationService);
  private readonly feedback = inject(FeedbackService);

  readonly statuses: readonly { value: ReportStatus; label: string }[] = [
    { value: 'pending', label: 'MODERATION.STATUS.PENDING' },
    { value: 'reviewed', label: 'MODERATION.STATUS.REVIEWED' },
    { value: 'dismissed', label: 'MODERATION.STATUS.DISMISSED' },
  ];

  readonly reports = signal<Report[]>([]);
  readonly status = signal<ReportStatus>('pending');
  readonly loading = signal(true);
  readonly hasMore = signal(false);
  private page = 0;

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetch();
  }

  /** Adónde lleva lo denunciado, cuando se puede abrir. */
  link(report: Report): (string | undefined)[] | null {
    switch (report.targetType) {
      case 'post':
        return ['/post', report.targetId];
      case 'user':
        return ['/profile', report.targetOwner?.name ?? report.targetId];
      case 'live':
        return ['/live', report.targetId];
      default:
        return null;
    }
  }

  async changeStatus(status: ReportStatus): Promise<void> {
    this.status.set(status);
    this.page = 0;
    this.reports.set([]);
    await this.fetch();
  }

  async loadMore(event: CustomEvent): Promise<void> {
    await this.fetch();
    await (event.target as HTMLIonInfiniteScrollElement).complete();
  }

  async resolve(report: Report, status: ReportStatus): Promise<void> {
    this.reports.update((items) => items.filter((item) => item.id !== report.id));

    try {
      await this.moderation.resolve(report.id, status);
    } catch (error) {
      this.reports.update((items) => [report, ...items]);
      await this.feedback.error(error);
    }
  }

  private async fetch(): Promise<void> {
    this.loading.set(true);

    try {
      const next = this.page + 1;
      const result = await this.moderation.reports({
        status: this.status(),
        page: next,
        perPage: 20,
      });
      this.reports.update((items) => [...items, ...result.data]);
      this.page = next;
      this.hasMore.set(result.meta.hasNextPage);
    } catch (error) {
      this.hasMore.set(false);
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }
}
