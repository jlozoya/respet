import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * Destino del enlace de confirmación de correo, tanto al darse de alta como al
 * cambiar de dirección.
 */
@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, AuthLayoutComponent, IonButton, IonIcon, IonSpinner],
  template: `
    <app-auth-layout [showPitch]="false">
      <div class="state">
        @switch (status()) {
          @case ('working') {
            <ion-spinner name="crescent" />
            <p>{{ 'AUTH.VERIFYING_EMAIL' | translate }}</p>
          }
          @case ('done') {
            <ion-icon name="checkmark-circle" class="ok" />
            <h2>{{ 'AUTH.EMAIL_VERIFIED' | translate }}</h2>
            <ion-button [routerLink]="auth.isAuthenticated() ? '/' : '/login'" expand="block">
              {{ (auth.isAuthenticated() ? 'AUTH.CONTINUE' : 'LOGIN') | translate }}
            </ion-button>
          }
          @default {
            <ion-icon name="close-circle" class="ko" />
            <h2>{{ 'AUTH.LINK_INVALID' | translate }}</h2>
            <p class="rs-muted">{{ 'AUTH.VERIFY_LINK_INVALID_HINT' | translate }}</p>
            <ion-button
              [routerLink]="auth.isAuthenticated() ? '/settings/account' : '/login'"
              expand="block"
            >
              {{ 'AUTH.CONTINUE' | translate }}
            </ion-button>
          }
        }
      </div>
    </app-auth-layout>
  `,
  styles: `
    .state {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: center;
    }

    .state ion-button {
      align-self: stretch;
    }

    .state ion-icon {
      font-size: 64px;
    }

    .ok {
      color: var(--ion-color-success);
    }

    .ko {
      color: var(--ion-color-danger);
    }

    h2 {
      font-size: 1.375rem;
    }
  `,
})
export class VerifyEmailPage implements OnInit {
  readonly auth = inject(AuthService);

  readonly token = input<string | null>(null);
  readonly status = signal<'working' | 'done' | 'failed'>('working');

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const token = this.token();

    if (!token) {
      this.status.set('failed');

      return;
    }

    try {
      await this.auth.verifyEmail(token);
      this.status.set('done');
    } catch {
      this.status.set('failed');
    }
  }
}
