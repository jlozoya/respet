import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Post } from '@respet/shared';

import { AvatarComponent } from '../../shared/components/avatar.component';
import { MediaGridComponent } from '../../shared/components/media-grid.component';
import { RichTextComponent } from '../../shared/components/rich-text.component';
import { UserNameComponent } from '../../shared/components/user-name.component';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { audienceIcon } from '../../shared/utils/audience';

/**
 * La publicación que otra comparte, metida en un recuadro.
 *
 * Si la original ya no se puede ver —se borró o su autor la restringió— se
 * dice así, como hace Facebook, en lugar de dejar el hueco vacío.
 */
@Component({
  selector: 'app-shared-post-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonIcon, AvatarComponent, MediaGridComponent, RichTextComponent, UserNameComponent, RelativeTimePipe],
  template: `
    @if (post(); as shared) {
      @if (shared.media.length) {
        <app-media-grid [media]="shared.media" />
      }
      <div class="body">
        <div class="head">
          <app-avatar [user]="shared.author" [size]="32" />
          <div class="meta">
            <app-user-name [user]="shared.author" />
            <a class="rs-small rs-muted" [routerLink]="['/post', shared.id]">
              {{ shared.createdAt | relativeTime }} · <ion-icon [name]="icon(shared)" />
            </a>
          </div>
        </div>
        @if (shared.description) {
          <app-rich-text [text]="shared.description" [clamp]="220" />
        }
      </div>
    } @else {
      <div class="unavailable">
        <ion-icon name="lock-closed" />
        <span>
          <span class="rs-strong">{{ 'POST.UNAVAILABLE_TITLE' | translate }}</span>
          <span class="rs-small rs-muted">{{ 'POST.UNAVAILABLE' | translate }}</span>
        </span>
      </div>
    }
  `,
  styles: `
    :host {
      border: 1px solid var(--rs-divider);
      border-radius: 8px;
      display: block;
      margin: 8px 0;
      overflow: hidden;
    }

    .body {
      padding: 12px 16px;
    }

    .head {
      align-items: center;
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    .meta {
      display: flex;
      flex-direction: column;
    }

    .meta a {
      align-items: center;
      display: inline-flex;
      gap: 4px;
    }

    .unavailable {
      align-items: center;
      display: flex;
      gap: 12px;
      padding: 16px;
    }

    .unavailable ion-icon {
      font-size: 24px;
    }

    .unavailable > span {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class SharedPostPreviewComponent {
  readonly post = input<Post | null>(null);

  icon(post: Post): string {
    return audienceIcon(post.audience);
  }
}
