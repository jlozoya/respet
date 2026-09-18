import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { BlockedUser } from '@social-network/shared';

import { SocialService } from '../../core/api/social.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { SettingsLayoutComponent } from './settings-layout.component';

/** Las personas bloqueadas, con la opción de desbloquearlas. */
@Component({
  selector: 'app-blocked-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonSpinner,
    AvatarComponent,
    FullNamePipe,
    RelativeTimePipe,
    SettingsLayoutComponent,
  ],
  template: `
    <app-settings-layout title="SETTINGS.BLOCKED" subtitle="SETTINGS.BLOCKED_HINT">
      <section class="rs-card block">
        @for (entry of blocked(); track entry.user.id) {
          <div class="item">
            <a [routerLink]="['/profile', entry.user.name]"
              ><app-avatar [user]="entry.user" [size]="44"
            /></a>
            <span class="text">
              <span class="title">{{ entry.user | fullName }}</span>
              <span class="meta">{{
                'BLOCKED.SINCE' | translate: { time: (entry.blockedAt | relativeTime) }
              }}</span>
            </span>
            <ion-button size="small" class="rs-soft" (click)="unblock(entry)">{{
              'PROFILE.UNBLOCK' | translate
            }}</ion-button>
          </div>
        } @empty {
          @if (loading()) {
            <div class="rs-empty"><ion-spinner /></div>
          } @else {
            <div class="rs-empty">
              <ion-icon name="happy-outline" />
              <p>{{ 'BLOCKED.EMPTY' | translate }}</p>
            </div>
          }
        }
      </section>
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
})
export class BlockedSettingsPage implements OnInit {
  private readonly social = inject(SocialService);
  private readonly feedback = inject(FeedbackService);

  readonly blocked = signal<BlockedUser[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.blocked.set(await this.social.blockedUsers());
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async unblock(entry: BlockedUser): Promise<void> {
    try {
      await this.social.unblock(entry.user.id);
      this.blocked.update((items) => items.filter((item) => item.user.id !== entry.user.id));
    } catch (error) {
      await this.feedback.error(error);
    }
  }
}
