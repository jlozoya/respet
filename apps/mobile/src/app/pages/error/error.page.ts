import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonRow } from '@ionic/angular/ion-row';
import { IonText } from '@ionic/angular/ion-text';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Mensajes por cada motivo, con el código que se enseña junto al título. */
const REASONS = {
  forbidden: { title: 'ERRORS_PAGE.UNAUTHORIZED.TITLE', code: '403', message: 'ERRORS_PAGE.UNAUTHORIZED.MESSAGE' },
  'not-found': { title: 'ERRORS_PAGE.NOT_FOUND.TITLE', code: '404', message: 'ERRORS_PAGE.NOT_FOUND.MESSAGE' },
  server: { title: 'ERRORS_PAGE.SOMETHING_WENT_WRONG.TITLE', code: '500', message: 'ERRORS_PAGE.SOMETHING_WENT_WRONG.MESSAGE' },
} as const;

type Reason = keyof typeof REASONS;

@Component({
  selector: 'app-error',
  templateUrl: './error.page.html',
  styleUrls: ['./error.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, IonContent, IonRow, IonCol, IonText, IonButton, IonIcon],
})
export class ErrorPage {
  private readonly router = inject(Router);

  /**
   * Motivo del error, enlazado desde `?reason=` gracias a
   * `withComponentInputBinding()`.
   */
  readonly reason = input<string | null>(null);

  readonly error = computed(() => REASONS[(this.reason() ?? 'not-found') as Reason] ?? REASONS['not-found']);

  goToMain(): void {
    void this.router.navigateByUrl(environment.mainUrl);
  }
}
