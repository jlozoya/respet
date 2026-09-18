import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { IonCard } from '@ionic/angular/ion-card';
import { IonCardContent } from '@ionic/angular/ion-card-content';
import { IonItem } from '@ionic/angular/ion-item';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { TranslatePipe } from '@ngx-translate/core';
import { UserRole, type User } from '@social-network/shared';

import { UsersService } from '../../../core/api/users.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FeedbackService } from '../../../core/ui/feedback.service';

/** Ficha de usuario del panel de administración. */
@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonCard, IonCardContent, IonItem, IonSelect, IonSelectOption],
})
export class UserCardComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly user = input.required<User>();

  /** Avisa a la lista para que refresque la fila con el rol ya cambiado. */
  readonly roleChanged = output<User>();

  readonly roles = [
    { value: UserRole.Visitor, label: 'VISITOR' },
    { value: UserRole.User, label: 'USER' },
    { value: UserRole.Roundsman, label: 'ROUNDSMAN' },
    { value: UserRole.Supervisor, label: 'SUPERVISOR' },
    { value: UserRole.Admin, label: 'ADMIN' },
  ];

  readonly avatarUrl = computed(() => this.user().avatar?.url ?? './assets/imgs/avatar.png');

  /**
   * El servidor tampoco deja a nadie cambiarse el rol a sí mismo; deshabilitar
   * el desplegable evita que el intento llegue siquiera a hacerse.
   */
  readonly isSelf = computed(() => this.auth.user()?.id === this.user().id);

  goToDetail(): void {
    void this.router.navigate(['/users', this.user().id]);
  }

  async changeRole(role: UserRole): Promise<void> {
    const current = this.user();

    if (role === current.role) {
      return;
    }

    try {
      const updated = await this.users.setRole(current.id, role);
      this.roleChanged.emit(updated);
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }
}
