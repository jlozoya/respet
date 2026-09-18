import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonPopover } from '@ionic/angular/ion-popover';
import { TranslatePipe } from '@ngx-translate/core';
import type { Conversation } from '@social-network/shared';

import { ChatService } from '../../core/api/chat.service';
import { NotificationsService } from '../../core/api/notifications.service';
import { OrdersService } from '../../core/api/store.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConversationListComponent } from '../chat/conversation-list.component';
import { CreateService } from '../feed/create.service';
import { NotificationsPanelComponent } from '../notifications/notifications-panel.component';
import { AccountMenuComponent } from './account-menu.component';
import { BrandComponent } from './brand.component';
import { SearchBoxComponent } from './search-box.component';
import { AvatarComponent } from '../../shared/components/avatar.component';

/**
 * La barra superior del escritorio, la de Facebook.
 *
 * A la izquierda la marca y el buscador; en el centro las secciones; a la
 * derecha crear, Messenger, los avisos y la cuenta, cada uno con su
 * desplegable para no tener que salir de lo que se está viendo.
 */
@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    IonIcon,
    IonPopover,
    AvatarComponent,
    BrandComponent,
    SearchBoxComponent,
    ConversationListComponent,
    NotificationsPanelComponent,
    AccountMenuComponent,
  ],
  template: `
    <header class="bar">
      <div class="left">
        <a routerLink="/" class="brand" [attr.aria-label]="'NAV.HOME' | translate"><app-brand /></a>
        <app-search-box class="search" />
      </div>

      <nav class="center" [attr.aria-label]="'NAV.MENU' | translate">
        <a
          class="tab"
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          [title]="'NAV.HOME' | translate"
        >
          <ion-icon name="home-outline" class="off" /><ion-icon name="home" class="on" />
        </a>
        <a
          class="tab"
          routerLink="/explore"
          routerLinkActive="active"
          [title]="'NAV.EXPLORE' | translate"
        >
          <ion-icon name="compass-outline" class="off" /><ion-icon name="compass" class="on" />
        </a>
        <a
          class="tab"
          routerLink="/live"
          routerLinkActive="active"
          [title]="'NAV.LIVE' | translate"
        >
          <ion-icon name="videocam-outline" class="off" /><ion-icon name="videocam" class="on" />
        </a>
        <a
          class="tab"
          routerLink="/products"
          routerLinkActive="active"
          [title]="'NAV.STORE' | translate"
        >
          <ion-icon name="storefront-outline" class="off" /><ion-icon
            name="storefront"
            class="on"
          />
          @if (orders.itemCount() > 0) {
            <span class="rs-badge">{{ orders.itemCount() }}</span>
          }
        </a>
      </nav>

      <div class="right">
        <button
          id="topbar-create"
          type="button"
          class="rs-icon-btn"
          [title]="'CREATE.TITLE' | translate"
        >
          <ion-icon name="add" />
        </button>
        <button
          id="topbar-messenger"
          type="button"
          class="rs-icon-btn"
          [title]="'NAV.MESSAGES' | translate"
        >
          <ion-icon name="chatbubble-ellipses" />
          @if (chat.unreadConversations() > 0) {
            <span class="rs-badge">{{ chat.unreadConversations() }}</span>
          }
        </button>
        <button
          id="topbar-notifications"
          type="button"
          class="rs-icon-btn"
          [title]="'NAV.NOTIFICATIONS' | translate"
        >
          <ion-icon name="notifications" />
          @if (notifications.unreadCount() > 0) {
            <span class="rs-badge">{{
              notifications.unreadCount() > 99 ? '99+' : notifications.unreadCount()
            }}</span>
          }
        </button>
        <button
          id="topbar-account"
          type="button"
          class="account"
          [title]="'NAV.ACCOUNT' | translate"
        >
          <app-avatar [user]="auth.user()" [size]="40" />
        </button>
      </div>
    </header>

    <ion-popover
      #createPopover
      trigger="topbar-create"
      triggerAction="click"
      cssClass="rs-menu"
      alignment="end"
    >
      <ng-template>
        <div class="rs-menu-list">
          <h3 class="menu-title">{{ 'CREATE.TITLE' | translate }}</h3>
          <button type="button" class="rs-row" (click)="create('post')">
            <span class="rs-row-icon"><ion-icon name="create" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'CREATE.POST' | translate }}</span
              ><span class="subtitle">{{ 'CREATE.POST_HINT' | translate }}</span></span
            >
          </button>
          <button type="button" class="rs-row" (click)="create('story')">
            <span class="rs-row-icon"><ion-icon name="book" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'CREATE.STORY' | translate }}</span
              ><span class="subtitle">{{ 'CREATE.STORY_HINT' | translate }}</span></span
            >
          </button>
          <button type="button" class="rs-row" (click)="create('live')">
            <span class="rs-row-icon"><ion-icon name="videocam" /></span>
            <span class="rs-row-text"
              ><span class="title">{{ 'CREATE.LIVE' | translate }}</span
              ><span class="subtitle">{{ 'CREATE.LIVE_HINT' | translate }}</span></span
            >
          </button>
        </div>
      </ng-template>
    </ion-popover>

    <ion-popover
      #messengerPopover
      trigger="topbar-messenger"
      triggerAction="click"
      cssClass="rs-menu wide"
      alignment="end"
    >
      <ng-template>
        <app-conversation-list
          class="popover-list"
          [compact]="true"
          (selected)="openConversation($event)"
        />
        <a class="see-all" routerLink="/messages" (click)="messengerPopover.dismiss()">{{
          'MESSENGER.SEE_ALL' | translate
        }}</a>
      </ng-template>
    </ion-popover>

    <ion-popover
      #notificationsPopover
      trigger="topbar-notifications"
      triggerAction="click"
      cssClass="rs-menu wide"
      alignment="end"
    >
      <ng-template>
        <app-notifications-panel [compact]="true" (navigated)="notificationsPopover.dismiss()" />
      </ng-template>
    </ion-popover>

    <ion-popover
      #accountPopover
      trigger="topbar-account"
      triggerAction="click"
      cssClass="rs-menu"
      alignment="end"
    >
      <ng-template>
        <app-account-menu (done)="accountPopover.dismiss()" />
      </ng-template>
    </ion-popover>
  `,
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  readonly auth = inject(AuthService);
  readonly chat = inject(ChatService);
  readonly notifications = inject(NotificationsService);
  readonly orders = inject(OrdersService);
  private readonly creator = inject(CreateService);
  private readonly router = inject(Router);

  readonly createPopover = viewChild<IonPopover>('createPopover');
  readonly messengerPopover = viewChild<IonPopover>('messengerPopover');
  readonly notificationsPopover = viewChild<IonPopover>('notificationsPopover');
  readonly accountPopover = viewChild<IonPopover>('accountPopover');

  async create(kind: 'post' | 'story' | 'live'): Promise<void> {
    await this.createPopover()?.dismiss();

    if (kind === 'post') {
      await this.creator.post();
    } else if (kind === 'story') {
      await this.creator.story();
    } else {
      await this.router.navigateByUrl('/live/new');
    }
  }

  async openConversation(conversation: Conversation): Promise<void> {
    await this.messengerPopover()?.dismiss();
    await this.chat.openConversation(conversation.id);
  }
}
