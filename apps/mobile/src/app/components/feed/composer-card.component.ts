import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Post } from '@social-network/shared';

import { AuthService } from '../../core/auth/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { CreateService } from './create.service';

/**
 * «¿Qué estás pensando?»: la tarjeta de arriba del muro que abre el creador.
 */
@Component({
  selector: 'app-composer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, AvatarComponent],
  template: `
    <div class="rs-card card">
      <div class="top">
        <app-avatar [user]="auth.user()" [size]="40" />
        <button type="button" class="prompt" (click)="write()">
          {{ 'COMPOSER.PLACEHOLDER' | translate: { name: auth.user()?.firstName } }}
        </button>
      </div>
      <div class="bottom">
        <button type="button" class="option" (click)="live()">
          <ion-icon name="videocam" class="live" /> <span>{{ 'CREATE.LIVE_SHORT' | translate }}</span>
        </button>
        <button type="button" class="option" (click)="write(true)">
          <ion-icon name="images" class="photo" /> <span>{{ 'COMPOSER.PHOTO_VIDEO' | translate }}</span>
        </button>
        <button type="button" class="option" (click)="story()">
          <ion-icon name="book" class="story" /> <span>{{ 'CREATE.STORY_SHORT' | translate }}</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    .card {
      padding: 12px 16px 6px;
    }

    .top {
      align-items: center;
      display: flex;
      gap: 8px;
      padding-bottom: 12px;
    }

    .prompt {
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 999px;
      color: var(--rs-text-2);
      cursor: pointer;
      flex: 1 1 auto;
      font-size: 1.0625rem;
      height: 40px;
      overflow: hidden;
      padding: 0 12px;
      text-align: start;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .prompt:hover {
      background: var(--rs-surface-3);
    }

    .bottom {
      border-top: 1px solid var(--rs-divider);
      display: flex;
      padding-top: 6px;
    }

    .option {
      align-items: center;
      background: none;
      border: 0;
      border-radius: 8px;
      color: var(--rs-text-2);
      cursor: pointer;
      display: flex;
      flex: 1 1 0;
      font-size: 0.9375rem;
      font-weight: 600;
      gap: 8px;
      height: 40px;
      justify-content: center;
    }

    .option:hover {
      background: var(--rs-hover);
    }

    .option ion-icon {
      font-size: 24px;
    }

    .live {
      color: #f3425f;
    }

    .photo {
      color: #45bd62;
    }

    .story {
      color: #f05a22;
    }

    @media (max-width: 479.98px) {
      .option span {
        display: none;
      }
    }
  `,
})
export class ComposerCardComponent {
  readonly auth = inject(AuthService);
  private readonly creator = inject(CreateService);
  private readonly router = inject(Router);

  readonly published = output<Post>();

  async write(openFiles = false): Promise<void> {
    const post = await this.creator.post({ openFiles });

    if (post) {
      this.published.emit(post);
    }
  }

  async story(): Promise<void> {
    await this.creator.story();
  }

  live(): void {
    void this.router.navigateByUrl('/live/new');
  }
}
