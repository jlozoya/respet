import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { TranslatePipe } from '@ngx-translate/core';
import type { User } from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';

/**
 * El cierre de la pantalla de cuenta: descargar los datos, salir y darse de
 * baja.
 *
 * Va al final a propósito, y en ese orden: lo que no se puede deshacer no
 * debería estar a la altura del pulgar mientras uno edita su perfil, que es
 * donde estaba antes —arriba, al lado del avatar—.
 */
@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonList, IonItem, IonLabel, IonIcon],
})
export class OptionsComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly user = input.required<User>();
  readonly isSelf = input(true);

  async deleteAccount(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'ALERTS.DELETE_ACCOUNT.TITLE',
      message: 'ALERTS.DELETE_ACCOUNT.MESSAGE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      if (this.isSelf()) {
        await this.users.deleteMyAccount();
        await this.auth.logout();
      } else {
        await this.users.remove(this.user().id);
        await this.router.navigateByUrl('/users');
      }
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  /** Descarga los datos del perfil en un archivo JSON. */
  downloadMyInfo(): void {
    const blob = new Blob([JSON.stringify(this.user(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `respet-${this.user().id}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  }
}
