import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ChatService } from '../../core/api/chat.service';
import { AuthService } from '../../core/auth/auth.service';
import { CreateService } from '../feed/create.service';
import { AvatarComponent } from '../../shared/components/avatar.component';

/**
 * La barra de pestañas del móvil, la de Instagram: inicio, explorar, crear,
 * mensajes y el perfil propio.
 */
@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, IonIcon, AvatarComponent],
  template: `
    <nav class="bar" [attr.aria-label]="'NAV.MENU' | translate">
      <a class="tab" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" [attr.aria-label]="'NAV.HOME' | translate">
        <ion-icon name="home-outline" class="off" /><ion-icon name="home" class="on" />
      </a>
      <a class="tab" routerLink="/explore" routerLinkActive="active" [attr.aria-label]="'NAV.EXPLORE' | translate">
        <ion-icon name="search-outline" class="off" /><ion-icon name="search" class="on" />
      </a>
      <button type="button" class="tab create" (click)="create()" [attr.aria-label]="'CREATE.TITLE' | translate">
        <ion-icon name="add-circle-outline" />
      </button>
      <a class="tab" routerLink="/messages" routerLinkActive="active" [attr.aria-label]="'NAV.MESSAGES' | translate">
        <ion-icon name="chatbubble-ellipses-outline" class="off" /><ion-icon name="chatbubble-ellipses" class="on" />
        @if (chat.unreadConversations() > 0) {
          <span class="rs-badge">{{ chat.unreadConversations() }}</span>
        }
      </a>
      @if (auth.user(); as user) {
        <a class="tab" [routerLink]="['/profile', user.name]" routerLinkActive="active" [attr.aria-label]="'NAV.PROFILE' | translate">
          <app-avatar class="me" [user]="user" [size]="28" />
        </a>
      }
    </nav>
  `,
  styles: `
    :host {
      background: var(--rs-surface);
      border-top: 1px solid var(--rs-divider);
      display: block;
      flex: 0 0 auto;
      padding-bottom: var(--ion-safe-area-bottom, 0px);
      z-index: 20;
    }

    .bar {
      display: flex;
      height: var(--rs-tabbar-height);
    }

    .tab {
      align-items: center;
      background: none;
      border: 0;
      color: var(--ion-text-color);
      display: flex;
      flex: 1 1 0;
      font-size: 26px;
      justify-content: center;
      position: relative;
    }

    .tab .on {
      display: none;
    }

    .tab.active .on {
      display: block;
    }

    .tab.active .off {
      display: none;
    }

    .tab .rs-badge {
      right: calc(50% - 22px);
      top: 6px;
    }

    .tab.active .me {
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--ion-text-color);
    }
  `,
})
export class TabBarComponent {
  readonly auth = inject(AuthService);
  readonly chat = inject(ChatService);
  private readonly creator = inject(CreateService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  async create(): Promise<void> {
    const t = (key: string) => this.translate.instant(key) as string;
    const sheet = await this.actionSheetCtrl.create({
      header: t('CREATE.TITLE'),
      buttons: [
        { text: t('CREATE.POST'), icon: 'create-outline', data: 'post' },
        { text: t('CREATE.STORY'), icon: 'book-outline', data: 'story' },
        { text: t('CREATE.LIVE'), icon: 'videocam-outline', data: 'live' },
        { text: t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    if (data === 'post') {
      await this.creator.post();
    } else if (data === 'story') {
      await this.creator.story();
    } else if (data === 'live') {
      await this.router.navigateByUrl('/live/new');
    }
  }
}
