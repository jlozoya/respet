import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';

import { NotificationsPanelComponent } from '../../components/notifications/notifications-panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Los avisos a pantalla completa: el destino de la campana en el móvil. */
@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, PageHeaderComponent, NotificationsPanelComponent],
  template: `
    <app-page-header title="NOTIFICATIONS.TITLE" />

    <ion-content>
      <div class="rs-container narrow">
        <div class="rs-card">
          <app-notifications-panel />
        </div>
      </div>
    </ion-content>
  `,
})
export class NotificationsPage {}
