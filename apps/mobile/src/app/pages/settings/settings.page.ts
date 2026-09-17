import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/auth/auth.service';
import { NavigationService } from '../../core/ui/navigation.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { SETTINGS_SECTIONS } from './settings-sections';

/** «Configuración y privacidad»: la lista de apartados. */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, IonIcon, AvatarComponent, PageHeaderComponent, FullNamePipe],
  template: `
    <app-page-header title="NAV.SETTINGS" />

    <ion-content>
      <div class="rs-container narrow">
        <h1 class="rs-desktop-only title">{{ 'NAV.SETTINGS' | translate }}</h1>

        @if (auth.user(); as user) {
          <a class="rs-card rs-row account" routerLink="/settings/profile">
            <app-avatar [user]="user" [size]="56" />
            <span class="rs-row-text">
              <span class="title">{{ user | fullName }}</span>
              <span class="subtitle">{{ user.email }}</span>
            </span>
            <ion-icon name="chevron-forward" />
          </a>
        }

        <div class="rs-card list">
          @for (section of sections; track section.link) {
            <a class="rs-row" [routerLink]="section.link">
              <span class="rs-row-icon"><ion-icon [name]="section.icon" /></span>
              <span class="rs-row-text">
                <span class="title">{{ section.title | translate }}</span>
                <span class="subtitle">{{ section.hint | translate }}</span>
              </span>
              <ion-icon name="chevron-forward" class="chevron" />
            </a>
          }
        </div>

        <div class="rs-card list">
          <button type="button" class="rs-row" (click)="navigation.closeSession()">
            <span class="rs-row-icon"><ion-icon name="log-out-outline" /></span>
            <span class="rs-row-text"><span class="title">{{ 'NAV.LOGOUT' | translate }}</span></span>
          </button>
          <button type="button" class="rs-row" (click)="navigation.closeSession({ everywhere: true })">
            <span class="rs-row-icon"><ion-icon name="exit-outline" /></span>
            <span class="rs-row-text"><span class="title">{{ 'SETTINGS.LOGOUT_EVERYWHERE' | translate }}</span></span>
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .title {
      font-size: 1.5rem;
      padding: 0 8px 12px;
    }

    .account {
      padding: 12px 16px;
    }

    .list {
      padding: 8px;
    }

    .chevron {
      color: var(--rs-text-3);
    }
  `,
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  readonly navigation = inject(NavigationService);
  readonly sections = SETTINGS_SECTIONS;
}
