import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonChip } from '@ionic/angular/ion-chip';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { UserEmail, UserPhone } from '@respet/shared';

import { UsersService } from '../../core/api/users.service';
import { FeedbackService } from '../../core/ui/feedback.service';

export type ContactKind = 'email' | 'phone';

const PATTERNS: Record<ContactKind, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^\+?[\d\s().-]{6,20}$/,
};

/**
 * Alta de correos y teléfonos alternativos de contacto.
 *
 * Acepta varios de una vez, separados por comas: los válidos pasan a una lista
 * de fichas y los que no lo son se quedan en el campo de texto para poder
 * corregirlos, en lugar de perderse.
 */
@Component({
  selector: 'app-add-emails-phones',
  templateUrl: 'add-emails-phones.component.html',
  styleUrls: ['add-emails-phones.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonLabel,
    IonChip,
  ],
})
export class AddEmailsPhonesComponent {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly kind = input<ContactKind>('email');

  readonly draft = signal('');
  readonly pending = signal<readonly string[]>([]);
  readonly existing = signal<readonly (UserEmail | UserPhone)[]>([]);
  readonly saving = signal(false);

  readonly title = computed(() => (this.kind() === 'email' ? 'EMAILS' : 'PHONES'));
  readonly inputType = computed(() => (this.kind() === 'email' ? 'email' : 'tel'));

  constructor() {
    void this.loadExisting();
  }

  /** Pasa a fichas lo que sea válido y deja el resto en el campo. */
  parseDraft(): void {
    const candidates = this.draft()
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      return;
    }

    const pattern = PATTERNS[this.kind()];
    const valid = candidates.filter((value) => pattern.test(value));
    const invalid = candidates.filter((value) => !pattern.test(value));

    if (valid.length > 0) {
      // Un Set descarta lo que ya estuviera en la lista.
      this.pending.update((current) => [...new Set([...current, ...valid])]);
    }

    this.draft.set(invalid.join(', '));

    if (invalid.length > 0) {
      void this.feedback.toast('ADD_EMAIL_PHONES.SOME_WRONG_VALUES', { color: 'warning' });
    }
  }

  removePending(value: string): void {
    this.pending.update((current) => current.filter((item) => item !== value));
  }

  async removeExisting(id: string): Promise<void> {
    try {
      if (this.kind() === 'email') {
        await this.users.removeEmail(id);
      } else {
        await this.users.removePhone(id);
      }

      this.existing.update((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  async save(): Promise<void> {
    this.parseDraft();

    const values = this.pending();

    if (values.length === 0) {
      await this.feedback.toast('ADD_EMAIL_PHONES.NOTHING_TO_SEND', { color: 'warning' });

      return;
    }

    this.saving.set(true);

    try {
      const saved =
        this.kind() === 'email'
          ? await this.users.addEmails({ emails: [...values] })
          : await this.users.addPhones({ phones: [...values] });

      await this.modalCtrl.dismiss(saved, 'saved');
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  labelOf(item: UserEmail | UserPhone): string {
    return 'email' in item ? item.email : item.phone;
  }

  /** Enlace para escribir o llamar directamente desde la ficha. */
  hrefOf(item: UserEmail | UserPhone): string {
    return 'email' in item ? `mailto:${item.email}` : `tel:${item.phone}`;
  }

  private async loadExisting(): Promise<void> {
    try {
      this.existing.set(
        this.kind() === 'email' ? await this.users.emails() : await this.users.phones(),
      );
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
