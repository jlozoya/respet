import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonRow } from '@ionic/angular/ion-row';
import type { User } from '@respet/shared';

import { UsersService } from '../../../core/api/users.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { AccessComponent } from './access/access.component';
import { AvatarComponent } from './avatar/avatar.component';
import { OptionsComponent } from './options/options.component';
import { UserFormComponent } from './user-form/user-form.component';

/**
 * Cuenta de usuario.
 *
 * Sirve tanto para el perfil propio como para que un administrador edite el de
 * otra persona, según venga o no un `id` en la ruta.
 */
@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    AvatarComponent,
    AccessComponent,
    OptionsComponent,
    UserFormComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonCol,
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

  readonly user = signal<User | null>(null);
  readonly loading = signal(true);

  readonly isSelf = computed(() => {
    const target = this.id();

    return !target || target === this.auth.user()?.id;
  });

  constructor() {
    effect(() => {
      const target = this.id();
      void this.load(target);
    });
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
