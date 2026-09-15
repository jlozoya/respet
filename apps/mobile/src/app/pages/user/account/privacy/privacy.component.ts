import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import {
  MessagePolicy,
  type FollowRequest,
  type UserPermissions,
} from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';

const FALLBACK_AVATAR = './assets/imgs/avatar.png';

/** Solicitudes que se traen de una vez: son pocas y caben en una pantalla. */
const REQUESTS_PER_PAGE = 50;

/**
 * Interruptores de visibilidad, en el orden en que se muestran.
 *
 * Eran seis: uno para el correo principal y otro para los alternativos, y lo
 * mismo con los teléfonos. Nadie decide enseñar su correo y esconder los otros
 * —es el mismo canal y la misma pregunta—, así que quedan cuatro y cada uno de
 * los dos primeros gobierna su pareja.
 */
const SWITCHES = [
  { key: 'showMainEmail', label: 'PRIVACY.SHOW_EMAIL' },
  { key: 'showMainPhone', label: 'PRIVACY.SHOW_PHONE' },
  { key: 'showLocation', label: 'PRIVACY.SHOW_LOCATION' },
] as const satisfies readonly { key: keyof UserPermissions; label: string }[];

/**
 * Los ajustes que viajan con otro.
 *
 * El servidor sigue guardando los cuatro campos, así que se escriben a la par
 * en lugar de dejar dos huérfanos con un valor que nadie puede ya cambiar.
 */
const PAREJAS: Partial<Record<SwitchKey, keyof UserPermissions>> = {
  showMainEmail: 'showAlternativeEmails',
  showMainPhone: 'showAlternativePhones',
};

/**
 * Lo que se enciende y se apaga desde aquí.
 *
 * Son los de la lista, más el perfil privado y las novedades por correo, que
 * van cada uno en su propia sección pero se guardan igual.
 */
type SwitchKey = (typeof SWITCHES)[number]['key'] | 'privateProfile' | 'receiveMailAds';

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
    IonAvatar,
    IonBadge,
  ],
})
export class PrivacyComponent {
  private readonly users = inject(UsersService);
  private readonly feedback = inject(FeedbackService);

  readonly switches = SWITCHES;
  readonly messagePolicies = MESSAGE_POLICIES;

  readonly permissions = signal<UserPermissions | null>(null);
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

    const pareja = PAREJAS[key];
    const cambio = { [key]: value, ...(pareja ? { [pareja]: value } : {}) };

    // Se pinta el cambio antes de confirmarlo: un interruptor que tarda en
    // moverse se siente roto. Si el servidor falla se revierte.
    this.permissions.set({ ...previous, ...cambio });

    try {
      this.permissions.set(await this.users.updatePermissions(cambio));

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

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const config = await this.users.permissions();
      this.permissions.set(config);

      // Sin perfil privado no hay solicitudes que pedir: en público nadie
      // espera respuesta.
      if (config.privateProfile) {
        await this.loadRequests();
      }
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRequests(): Promise<void> {
    const { data } = await this.users.followRequests({ perPage: REQUESTS_PER_PAGE });

    this.requests.set(data);
  }
}
