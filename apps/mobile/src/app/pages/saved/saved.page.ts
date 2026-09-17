import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { TranslatePipe } from '@ngx-translate/core';

import { PostGridComponent } from '../../components/feed/post-grid.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Lo guardado para después. Sólo lo ve quien lo guardó. */
@Component({
  selector: 'app-saved',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, PageHeaderComponent, PostGridComponent],
  template: `
    <app-page-header title="NAV.SAVED" />

    <ion-content>
      <div class="rs-container">
        <header class="head rs-desktop-only">
          <h1>{{ 'NAV.SAVED' | translate }}</h1>
          <p class="rs-muted">{{ 'SAVED.SUBTITLE' | translate }}</p>
        </header>
        <app-post-grid class="rs-card" source="saved" emptyText="SAVED.EMPTY" />
      </div>
    </ion-content>
  `,
  styles: `
    .head {
      padding: 0 8px 12px;
    }

    h1 {
      font-size: 1.5rem;
    }

    p {
      margin: 4px 0 0;
    }
  `,
})
export class SavedPage {}
