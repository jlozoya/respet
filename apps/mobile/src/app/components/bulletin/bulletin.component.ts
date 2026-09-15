import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonCol } from '@ionic/angular/ion-col';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { TranslatePipe } from '@ngx-translate/core';
import type { Bulletin } from '@respet/shared';

import { BulletinsService } from '../../core/api/content.service';
import { FeedbackService } from '../../core/ui/feedback.service';

/** Últimos avisos publicados, en forma de tarjetas. */
@Component({
  selector: 'app-bulletin',
  templateUrl: './bulletin.component.html',
  styleUrls: ['./bulletin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    TranslatePipe,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonButton,
  ],
})
export class BulletinComponent {
  private readonly bulletins = inject(BulletinsService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly items = signal<readonly Bulletin[]>([]);
  readonly loading = signal(true);

  readonly fallbackImage = './assets/imgs/bulletin/newspaper.png';

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);

    try {
      const page = await this.bulletins.list({ perPage: 6 });
      this.items.set(page.data);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(event: Event): Promise<void> {
    await this.load();
    // `ion-refresher` deja el indicador girando hasta que se le avisa.
    void (event.target as HTMLIonRefresherElement).complete();
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackImage;
  }

  seeMore(): void {
    void this.router.navigateByUrl('/bulletins');
  }
}
