import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import {
  MessagePolicy,
  type FollowRequest,
  type UserEmail,
  type UserPermissions,
  type UserPhone,
} from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';
import { AddEmailsPhonesComponent } from '../../../../modals/add-emails-phones/add-emails-phones.component';

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/** Solicitudes que se traen de una vez: son pocas y caben en una pantalla. */
const REQUESTS_PER_PAGE = 50;

/** Interruptores de visibilidad, en el orden en que se muestran. */
const SWITCHES = [
  { key: 'showMainEmail', label: 'PRIVACY.SHOW_MAIN_EMAIL' },
  { key: 'showAlternativeEmails', label: 'PRIVACY.SHOW_ALTERNATIVE_EMAILS' },
  { key: 'showMainPhone', label: 'PRIVACY.SHOW_MAIN_PHONE' },
  { key: 'showAlternativePhones', label: 'PRIVACY.SHOW_ALTERNATIVE_PHONES' },
  { key: 'showLocation', label: 'PRIVACY.SHOW_LOCATION' },
  { key: 'receiveMailAds', label: 'PRIVACY.RECEIVE_MAIL_ADS' },
] as const satisfies readonly { key: keyof UserPermissions; label: string }[];

/** Los interruptores son los de tipo booleano; el resto tiene su propio mando. */
type SwitchKey = (typeof SWITCHES)[number]['key'] | 'privateProfile';

const MESSAGE_POLICIES = [
  { value: MessagePolicy.Everyone, label: 'SETTINGS.MESSAGE_POLICIES.EVERYONE' },
  { value: MessagePolicy.Following, label: 'SETTINGS.MESSAGE_POLICIES.FOLLOWING' },
  { value: MessagePolicy.Nobody, label: 'SETTINGS.MESSAGE_POLICIES.NOBODY' },
] as const;

/**
 * Quién puede acercarse y qué ve de uno.
 *
 * Todo lo que decide el trato con los demás: si el perfil pide solicitud para
 * ser seguido, quién puede escribir, qué datos de contacto se enseñan y cuáles
 * son esos datos.
 */
@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonAvatar,
    IonBadge,
  ],
})
export class PrivacyComponent {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly switches = SWITCHES;
  readonly messagePolicies = MESSAGE_POLICIES;

  readonly permissions = signal<UserPermissions | null>(null);
  readonly emails = signal<readonly UserEmail[]>([]);
  readonly phones = signal<readonly UserPhone[]>([]);
  readonly requests = signal<readonly FollowRequest[]>([]);
  readonly loading = signal(true);

  /**
   * Qué solicitudes están esperando respuesta del servidor.
   *
   * Se apagan sus dos botones mientras: aceptar y rechazar a la vez la misma
   * solicitud mandaría dos órdenes contrarias, y la segunda fallaría con un
   * «no existe» que no explica nada.
   */
  readonly answering = signal<readonly string[]>([]);

  constructor() {
    void this.load();
  }

  avatarOf(request: FollowRequest): string {
    return request.requester.avatar?.url ?? FALLBACK_AVATAR;
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK_AVATAR;
  }

  /**
   * Cambia un interruptor.
   *
   * Encender el perfil privado trae además las solicitudes: a partir de ese
   * momento pueden llegar, y la lista que aparece debajo tiene que enseñar lo
   * que ya hubiera de una temporada privada anterior.
   */
  async toggle(key: SwitchKey, value: boolean): Promise<void> {
    const previous = this.permissions();

    if (!previous || previous[key] === value) {
      return;
    }

    // Se pinta el cambio antes de confirmarlo: un interruptor que tarda en
    // moverse se siente roto. Si el servidor falla se revierte.
    this.permissions.set({ ...previous, [key]: value });

    try {
      this.permissions.set(await this.users.updatePermissions({ [key]: value }));

      if (key === 'privateProfile' && value) {
        await this.loadRequests();
      }
    } catch (error) {
      this.permissions.set(previous);
      await this.feedback.error(error);
    }
  }

  async changeMessagePolicy(policy: MessagePolicy): Promise<void> {
    const previous = this.permissions();

    if (!previous || previous.messagePolicy === policy) {
      return;
    }

    this.permissions.set({ ...previous, messagePolicy: policy });

    try {
      this.permissions.set(await this.users.updatePermissions({ messagePolicy: policy }));
    } catch (error) {
      this.permissions.set(previous);
      await this.feedback.error(error);
    }
  }

  /** Acepta: quien pedía pasa a ser seguidor y la fila se va de la lista. */
  async accept(request: FollowRequest): Promise<void> {
    await this.answer(request, () => this.users.acceptFollowRequest(request.id));
  }

  async reject(request: FollowRequest): Promise<void> {
    await this.answer(request, () => this.users.rejectFollowRequest(request.id));
  }

  /**
   * Aceptar y rechazar se comportan igual por aquí: se marca la fila mientras
   * el servidor responde y, si todo va bien, se quita de la lista, porque ya
   * no queda nada que decidir sobre ella.
   */
  private async answer(request: FollowRequest, accion: () => Promise<unknown>): Promise<void> {
    this.answering.update((current) => [...current, request.id]);

    try {
      await accion();
      this.requests.update((current) => current.filter((item) => item.id !== request.id));
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.answering.update((current) => current.filter((id) => id !== request.id));
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
      const config = await this.users.permissions();
      this.permissions.set(config);

      await Promise.all([
        this.loadContacts(),
        // Sin perfil privado no hay solicitudes que pedir: en público nadie
        // espera respuesta.
        config.privateProfile ? this.loadRequests() : Promise.resolve(),
      ]);
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

  private async loadRequests(): Promise<void> {
    const { data } = await this.users.followRequests({ perPage: REQUESTS_PER_PAGE });

    this.requests.set(data);
  }
}
