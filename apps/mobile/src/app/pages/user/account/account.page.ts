import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { TranslatePipe } from '@ngx-translate/core';
import type { User } from '@respet/shared';

import { UsersService } from '../../../core/api/users.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { AccessComponent } from './access/access.component';
import { AvatarComponent } from './avatar/avatar.component';
import { OptionsComponent } from './options/options.component';
import { PreferencesComponent } from './preferences/preferences.component';
import { PrivacyComponent } from './privacy/privacy.component';
import { UserFormComponent } from './user-form/user-form.component';

/** Las tres pestañas, en el orden en que se enseñan. */
const TABS = [
  { value: 'profile', label: 'ACCOUNT.TABS.PROFILE' },
  { value: 'access', label: 'ACCOUNT.TABS.ACCESS' },
  { value: 'account', label: 'ACCOUNT.TABS.ACCOUNT' },
] as const;

type Tab = (typeof TABS)[number]['value'];

/**
 * Cuenta de usuario, en tres pestañas.
 *
 * Reúne lo que antes eran dos pantallas —la cuenta y la configuración—, porque
 * las dos respondían a «ajustar lo mío» y obligaban a recordar en cuál estaba
 * cada cosa. Quedan agrupadas por la pregunta que responden: quién soy, con
 * qué entro y quién me ve, y qué hago con la cuenta.
 *
 * Sirve también para que un administrador edite la ficha de otra persona,
 * según venga o no un `id` en la ruta; en ese caso no hay pestañas, porque de
 * otra cuenta sólo se pueden tocar los datos y darla de baja.
 */
@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    AvatarComponent,
    AccessComponent,
    PrivacyComponent,
    PreferencesComponent,
    OptionsComponent,
    UserFormComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
})
export class AccountPage {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  /**
   * Id del usuario a mostrar; sin él se muestra el propio.
   *
   * Cuando la dirección no lo lleva, el enrutador deja la entrada en
   * `undefined`, no en `null`: por preguntar por el `null` exacto, la pantalla
   * pedía el usuario «sin id» y se quedaba en blanco con un error.
   */
  readonly id = input<string | null>(null);

  /**
   * Pestaña con la que se entra.
   *
   * Llega de la ruta, para que el menú —y un enlace compartido— puedan abrir
   * una en concreto en lugar de dejar a quien llega buscándola.
   */
  readonly section = input<string | null>(null);

  readonly tabs = TABS;

  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly tab = signal<Tab>('profile');

  readonly isSelf = computed(() => {
    const target = this.id();

    return !target || target === this.auth.user()?.id;
  });

  constructor() {
    effect(() => {
      const target = this.id();
      void this.load(target);
    });

    // Una sección desconocida en la dirección no es motivo para dejar la
    // pantalla en blanco: se cae en la primera pestaña.
    effect(() => {
      const pedida = this.section();
      const conocida = TABS.find((option) => option.value === pedida);

      this.tab.set(conocida?.value ?? 'profile');
    });
  }

  changeTab(event: Event): void {
    const value = (event as CustomEvent<{ value?: string }>).detail.value;
    const conocida = TABS.find((option) => option.value === value);

    if (conocida) {
      this.tab.set(conocida.value);
    }
  }

  async refresh(event: Event): Promise<void> {
    const target = this.id();
    await this.load(target);
    void (event.target as HTMLIonRefresherElement).complete();
  }

  onUpdated(user: User): void {
    this.user.set(user);
  }

  async reload(): Promise<void> {
    const target = this.id();
    await this.load(target);
  }

  private async load(target: string | null | undefined): Promise<void> {
    this.loading.set(true);

    try {
      this.user.set(target ? await this.users.findById(target) : await this.users.me());
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }
}
