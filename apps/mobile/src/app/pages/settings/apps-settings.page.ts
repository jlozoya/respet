import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { AuthorizedApp } from '@social-network/shared';

import { SecurityService } from '../../core/api/security.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { SettingsLayoutComponent } from './settings-layout.component';

/**
 * «Apps y sitios web»: las aplicaciones de terceros a las que se ha dado
 * acceso, con lo que pueden hacer, y el botón para quitárselo en el acto.
 */
@Component({
  selector: 'app-apps-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonSpinner,
    AvatarComponent,
    RelativeTimePipe,
    SettingsLayoutComponent,
  ],
  template: `
    <app-settings-layout title="SETTINGS.APPS" subtitle="SETTINGS.APPS_HINT">
      <section class="rs-card block">
        @for (app of apps(); track app.id) {
          <div class="item app">
            <app-avatar [src]="app.icon?.url" [label]="app.name" [size]="48" />
            <span class="text">
              <span class="title">{{ app.name }}</span>
              <span class="meta">
                {{ 'APPS.AUTHORIZED_AGO' | translate: { time: (app.createdAt | relativeTime) } }}
                @if (app.lastUsedAt) {
                  · {{ 'APPS.LAST_USED' | translate: { time: (app.lastUsedAt | relativeTime) } }}
                }
              </span>
              <span class="scopes">
                @for (scope of app.scopes; track scope.scope) {
                  <span
                    class="scope"
                    [class.sensitive]="scope.sensitive"
                    [title]="scope.description"
                    >{{ scope.title }}</span
                  >
                }
              </span>
            </span>
            <ion-button size="small" color="danger" fill="outline" (click)="revoke(app)">{{
              'APPS.REMOVE' | translate
            }}</ion-button>
          </div>
        } @empty {
          @if (loading()) {
            <div class="rs-empty"><ion-spinner /></div>
          } @else {
            <div class="rs-empty">
              <ion-icon name="apps-outline" />
              <p>{{ 'APPS.EMPTY' | translate }}</p>
            </div>
          }
        }
      </section>

      <p class="rs-small rs-muted note">
        {{ 'APPS.BUILD_YOUR_OWN' | translate }}
        <a class="rs-link" routerLink="/developers">{{ 'NAV.DEVELOPERS' | translate }}</a>
      </p>
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
  styles: `
    .app {
      align-items: flex-start;
    }

    .scopes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .scope {
      background: var(--rs-surface-2);
      border-radius: 999px;
      font-size: 0.75rem;
      padding: 2px 8px;
    }

    .scope.sensitive {
      background: rgb(247 185 40 / 20%);
    }

    .note {
      padding: 0 4px;
    }
  `,
})
export class AppsSettingsPage implements OnInit {
  private readonly security = inject(SecurityService);
  private readonly feedback = inject(FeedbackService);

  readonly apps = signal<AuthorizedApp[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.apps.set(await this.security.authorizedApps());
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async revoke(app: AuthorizedApp): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'APPS.REMOVE_TITLE',
      message: 'APPS.REMOVE_MESSAGE',
      confirmText: 'APPS.REMOVE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.security.revokeAuthorizedApp(app.id);
      this.apps.update((items) => items.filter((item) => item.id !== app.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
