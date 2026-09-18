import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { AppCredentials } from '@social-network/shared';

import { FeedbackService } from '../../core/ui/feedback.service';

/**
 * Los secretos recién creados.
 *
 * Es la única vez que se ven: el servidor sólo guarda su huella. La ventana no
 * se cierra tocando fuera, para que nadie los pierda por un descuido.
 */
@Component({
  selector: 'app-credentials-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'DEVELOPERS.CREDENTIALS' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="warning">
        <ion-icon name="warning-outline" />
        <span>{{ 'DEVELOPERS.SECRET_ONCE' | translate }}</span>
      </div>

      <div class="field">
        <span class="rs-small rs-muted">client_id</span>
        <button type="button" class="value" (click)="copy(credentials().app.clientId)">
          {{ credentials().app.clientId }} <ion-icon name="copy-outline" />
        </button>
      </div>

      @if (credentials().clientSecret; as secret) {
        <div class="field">
          <span class="rs-small rs-muted">client_secret</span>
          <button type="button" class="value" (click)="copy(secret)">{{ secret }} <ion-icon name="copy-outline" /></button>
        </div>
      }

      @if (credentials().webhookSecret; as secret) {
        <div class="field">
          <span class="rs-small rs-muted">webhook_secret</span>
          <button type="button" class="value" (click)="copy(secret)">{{ secret }} <ion-icon name="copy-outline" /></button>
        </div>
      }

      <ion-button expand="block" (click)="close()">{{ 'DEVELOPERS.SAVED_THEM' | translate }}</ion-button>
    </ion-content>
  `,
  styles: `
    .warning {
      align-items: center;
      background: rgb(247 185 40 / 20%);
      border-radius: 8px;
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px;
    }

    .warning ion-icon {
      color: #9a6b00;
      font-size: 24px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 12px;
    }

    .value {
      align-items: center;
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 8px;
      color: inherit;
      cursor: copy;
      display: flex;
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
      gap: 8px;
      justify-content: space-between;
      overflow-wrap: anywhere;
      padding: 10px 12px;
      text-align: start;
    }
  `,
})
export class CredentialsModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly feedback = inject(FeedbackService);

  readonly credentials = input.required<AppCredentials>();

  async copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    await this.feedback.toast('SECURITY.COPIED');
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
