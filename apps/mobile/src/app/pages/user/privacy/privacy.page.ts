import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonRow } from '@ionic/angular/ion-row';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { UserEmail, UserPermissions, UserPhone } from '@respet/shared';

import { UsersService } from '../../../core/api/users.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { AddEmailsPhonesComponent } from '../../../modals/add-emails-phones/add-emails-phones.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';

/** Interruptores de privacidad, en el orden en que se muestran. */
const SWITCHES = [
  { key: 'showMainEmail', label: 'PRIVACY.SHOW_MAIN_EMAIL' },
  { key: 'showAlternativeEmails', label: 'PRIVACY.SHOW_ALTERNATIVE_EMAILS' },
  { key: 'showMainPhone', label: 'PRIVACY.SHOW_MAIN_PHONE' },
  { key: 'showAlternativePhones', label: 'PRIVACY.SHOW_ALTERNATIVE_PHONES' },
  { key: 'showLocation', label: 'PRIVACY.SHOW_LOCATION' },
  { key: 'receiveMailAds', label: 'PRIVACY.RECEIVE_MAIL_ADS' },
] as const satisfies readonly { key: keyof UserPermissions; label: string }[];

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    IonContent,
    IonRow,
    IonCol,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonToggle,
    IonButton,
    IonIcon,
  ],
})
export class PrivacyPage {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly switches = SWITCHES;

  readonly permissions = signal<UserPermissions | null>(null);
  readonly emails = signal<readonly UserEmail[]>([]);
  readonly phones = signal<readonly UserPhone[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  async toggle(key: keyof UserPermissions, value: boolean): Promise<void> {
    const previous = this.permissions();

    if (!previous || previous[key] === value) {
      return;
    }

    // Se pinta el cambio antes de confirmarlo: un interruptor que tarda en
    // moverse se siente roto. Si el servidor falla se revierte.
    this.permissions.set({ ...previous, [key]: value });

    try {
      this.permissions.set(await this.users.updatePermissions({ [key]: value }));
    } catch (error) {
      this.permissions.set(previous);
      await this.feedback.error(error);
    }
  }

  async manage(kind: 'email' | 'phone'): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AddEmailsPhonesComponent,
      componentProps: { kind },
    });

    await modal.present();
    await modal.onWillDismiss();

    // La ventana permite añadir y borrar, así que se recarga la lista entera.
    await this.loadContacts();
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.permissions.set(await this.users.permissions());
      await this.loadContacts();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadContacts(): Promise<void> {
    const [emails, phones] = await Promise.all([this.users.emails(), this.users.phones()]);

    this.emails.set(emails);
    this.phones.set(phones);
  }
}
