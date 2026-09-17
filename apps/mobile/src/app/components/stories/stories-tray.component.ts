import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { StoryGroup } from '@respet/shared';

import { StoriesService } from '../../core/api/stories.service';
import { AuthService } from '../../core/auth/auth.service';
import { CreateService } from '../feed/create.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { StoryViewerService } from './story-viewer.service';

/**
 * La barra de historias de arriba del muro.
 *
 * El primer círculo es el propio —con el «+» para crear si aún no hay ninguna—
 * y después los de quienes sigues, primero los que tienen algo sin ver. Tocar
 * uno abre el visor y deja seguir con los siguientes, como en Instagram.
 */
@Component({
  selector: 'app-stories-tray',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, AvatarComponent],
  template: `
    <div class="tray" role="list">
      <div class="item" role="listitem">
        <button type="button" class="circle" (click)="openOwn()" [attr.aria-label]="'STORIES.YOUR_STORY' | translate">
          <app-avatar [user]="auth.user()" [size]="64" [ring]="ownRing()" />
          @if (!own()) {
            <span class="plus"><ion-icon name="add" /></span>
          }
        </button>
        <span class="label">{{ 'STORIES.YOUR_STORY' | translate }}</span>
      </div>

      @for (group of others(); track group.user.id) {
        <div class="item" role="listitem">
          <button type="button" class="circle" (click)="open(group)" [attr.aria-label]="group.user.firstName || group.user.name">
            <app-avatar [user]="group.user" [size]="64" [ring]="group.hasUnseen ? 'unseen' : 'seen'" />
          </button>
          <span class="label" [class.seen]="!group.hasUnseen">{{ group.user.firstName || group.user.name }}</span>
        </div>
      }

      @if (!stories.loaded()) {
        @for (placeholder of [1, 2, 3, 4, 5]; track placeholder) {
          <div class="item">
            <span class="rs-skeleton skeleton-circle"></span>
            <span class="rs-skeleton skeleton-label"></span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .tray {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 12px 16px;
      scrollbar-width: none;
    }

    .tray::-webkit-scrollbar {
      display: none;
    }

    .item {
      align-items: center;
      display: flex;
      flex: 0 0 72px;
      flex-direction: column;
      gap: 4px;
    }

    .circle {
      background: none;
      border: 0;
      cursor: pointer;
      padding: 0;
      position: relative;
    }

    .plus {
      align-items: center;
      background: var(--ion-color-primary);
      border: 3px solid var(--rs-surface);
      border-radius: 50%;
      bottom: -2px;
      color: #fff;
      display: flex;
      font-size: 14px;
      height: 24px;
      justify-content: center;
      position: absolute;
      right: -2px;
      width: 24px;
    }

    .label {
      font-size: 0.75rem;
      max-width: 72px;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .label.seen {
      color: var(--rs-text-2);
    }

    .skeleton-circle {
      border-radius: 50%;
      height: 64px;
      width: 64px;
    }

    .skeleton-label {
      height: 10px;
      width: 48px;
    }
  `,
})
export class StoriesTrayComponent {
  readonly stories = inject(StoriesService);
  readonly auth = inject(AuthService);
  private readonly viewer = inject(StoryViewerService);
  private readonly creator = inject(CreateService);

  readonly own = computed(() => this.stories.feed().find((group) => group.user.id === this.auth.user()?.id) ?? null);
  readonly ownRing = computed(() => {
    const own = this.own();

    return own ? (own.hasUnseen ? 'unseen' : 'seen') : 'none';
  });
  readonly others = computed(() => this.stories.feed().filter((group) => group.user.id !== this.auth.user()?.id));

  async openOwn(): Promise<void> {
    const own = this.own();

    if (own) {
      await this.open(own);
    } else {
      await this.creator.story();
    }
  }

  async open(group: StoryGroup): Promise<void> {
    const groups = this.stories.feed();
    await this.viewer.open(groups, groups.indexOf(group));
  }
}
