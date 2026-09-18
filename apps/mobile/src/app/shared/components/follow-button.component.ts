import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { FollowResult, FollowState } from '@social-network/shared';

import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackService } from '../../core/ui/feedback.service';

/**
 * El botón de seguir, con sus tres estados.
 *
 * «Seguir» pasa a «Siguiendo» o, si el perfil es privado, a «Solicitado» hasta
 * que responda. Pulsar de nuevo deshace, pidiendo confirmación sólo cuando se
 * deja de seguir, que es lo que no se recupera con un toque.
 *
 * Cambia en el acto y se corrige si el servidor dice otra cosa.
 */
@Component({
  selector: 'app-follow-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, TranslatePipe],
  template: `
    @if (!isSelf()) {
      <ion-button
        [size]="size()"
        [class.rs-soft]="state() !== 'none'"
        [expand]="expand() ? 'block' : undefined"
        [disabled]="busy()"
        (click)="toggle($event)"
      >
        @switch (state()) {
          @case ('following') {
            <ion-icon slot="start" name="checkmark" />
            {{ 'FOLLOW.FOLLOWING' | translate }}
          }
          @case ('requested') {
            <ion-icon slot="start" name="time-outline" />
            {{ 'FOLLOW.REQUESTED' | translate }}
          }
          @default {
            <ion-icon slot="start" name="person-add" />
            {{ 'FOLLOW.FOLLOW' | translate }}
          }
        }
      </ion-button>
    }
  `,
})
export class FollowButtonComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);

  readonly userId = input.required<string>();
  readonly followState = input<FollowState | null>('none');
  readonly size = input<'small' | 'default' | 'large'>('small');
  readonly expand = input(false);

  readonly changed = output<FollowResult>();

  private readonly override = signal<FollowState | null>(null);
  readonly busy = signal(false);

  readonly state = computed(() => this.override() ?? this.followState() ?? 'none');
  readonly isSelf = computed(() => this.auth.user()?.id === this.userId());

  async toggle(event: Event): Promise<void> {
    event.stopPropagation();

    const previous = this.state();

    if (previous === 'following') {
      const confirmed = await this.feedback.confirm({
        header: 'FOLLOW.UNFOLLOW_TITLE',
        message: 'FOLLOW.UNFOLLOW_MESSAGE',
        confirmText: 'FOLLOW.UNFOLLOW',
        danger: true,
      });

      if (!confirmed) {
        return;
      }
    }

    this.busy.set(true);
    this.override.set(previous === 'none' ? 'following' : 'none');

    try {
      const result =
        previous === 'none' ? await this.users.follow(this.userId()) : await this.users.unfollow(this.userId());

      this.override.set(result.followState);
      this.changed.emit(result);
    } catch (error) {
      this.override.set(previous);
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
