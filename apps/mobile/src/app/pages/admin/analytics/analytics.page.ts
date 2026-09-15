import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCardHeader } from '@ionic/angular/ion-card-header';
import { IonCardTitle } from '@ionic/angular/ion-card-title';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { TranslatePipe } from '@ngx-translate/core';
import type { Analytics, UsersRegistrationPoint } from '@respet/shared';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { AnalyticsService } from '../../../core/api/content.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

type Interval = 'day' | 'week' | 'month' | 'year';

/** Paleta de la aplicación, para que las gráficas no desentonen. */
const PALETTE = ['#ff6b35', '#2ec4b6', '#ffbf69', '#8367c7', '#4f6d7a'];

@Component({
  selector: 'app-analytics',
  templateUrl: 'analytics.page.html',
  styleUrls: ['analytics.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    BaseChartDirective,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
})
export class AnalyticsPage {
  private readonly analytics = inject(AnalyticsService);
  private readonly feedback = inject(FeedbackService);

  readonly summary = signal<Analytics | null>(null);
  readonly registrations = signal<readonly UsersRegistrationPoint[]>([]);
  readonly interval = signal<Interval>('month');
  readonly loading = signal(true);

  readonly intervals: readonly Interval[] = ['day', 'week', 'month', 'year'];

  /** Cifras destacadas, en tarjetas. */
  readonly totals = computed(() => {
    const data = this.summary();

    if (!data) {
      return [];
    }

    return [
      { label: 'ANALYTICS.USERS', value: data.usersTotal },
      { label: 'ANALYTICS.POSTS', value: data.postsTotal },
      { label: 'ANALYTICS.ORDERS', value: data.ordersTotal },
      { label: 'ANALYTICS.SUPPORT', value: data.supportTotal },
    ];
  });

  readonly registrationChart = computed<ChartConfiguration<'line'>['data']>(() => ({
    labels: this.registrations().map((point) => point.date),
    datasets: [
      {
        data: this.registrations().map((point) => point.users),
        borderColor: PALETTE[0],
        backgroundColor: 'rgba(255, 107, 53, 0.2)',
        fill: true,
        tension: 0.3,
      },
    ],
  }));

  readonly genderChart = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const gender = this.summary()?.gender;

    return {
      labels: ['Femenino', 'Masculino', 'Prefiero no decirlo', 'Sin especificar'],
      datasets: [
        {
          data: [
            gender?.female ?? 0,
            gender?.male ?? 0,
            gender?.unspecified ?? 0,
            gender?.unknown ?? 0,
          ],
          backgroundColor: PALETTE,
        },
      ],
    };
  });

  readonly providerChart = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const providers = this.summary()?.providers;

    return {
      labels: ['Contraseña', 'Google', 'Facebook', 'Apple'],
      datasets: [
        {
          data: [
            providers?.password ?? 0,
            providers?.google ?? 0,
            providers?.facebook ?? 0,
            providers?.apple ?? 0,
          ],
          backgroundColor: PALETTE,
        },
      ],
    };
  });

  readonly ageChart = computed<ChartConfiguration<'bar'>['data']>(() => {
    const ages = this.summary()?.ages;

    return {
      labels: ['0-12', '13-17', '18-29', '30+', 'Sin especificar'],
      datasets: [
        {
          data: [
            ages?.children ?? 0,
            ages?.teens ?? 0,
            ages?.youngAdults ?? 0,
            ages?.adults ?? 0,
            ages?.unknown ?? 0,
          ],
          backgroundColor: PALETTE[1],
        },
      ],
    };
  });

  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  constructor() {
    void this.load();
  }

  async changeInterval(value: string): Promise<void> {
    this.interval.set(value as Interval);
    await this.loadRegistrations();
  }

  async refresh(event: Event): Promise<void> {
    await this.load();
    void (event.target as HTMLIonRefresherElement).complete();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.summary.set(await this.analytics.summary());
      await this.loadRegistrations();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRegistrations(): Promise<void> {
    try {
      this.registrations.set(await this.analytics.usersRegistration({ interval: this.interval() }));
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
