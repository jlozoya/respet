import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { UserRole, type User } from '@respet/shared';

import { UsersService } from '../../../core/api/users.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ImagePickerService } from '../../../core/media/image-picker.service';
import { FeedbackService } from '../../../core/ui/feedback.service';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { FullNamePipe } from '../../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

/**
 * La ficha de una persona en el panel: su rol, su insignia de verificada, su
 * foto y la posibilidad de borrar la cuenta.
 */
@Component({
  selector: 'app-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSpinner,
    AvatarComponent,
    PageHeaderComponent,
    FullNamePipe,
    RelativeTimePipe,
  ],
  template: `
    <app-page-header title="NAV.USERS" backTo="/users" [always]="true" />

    <ion-content>
      <div class="rs-container narrow">
        @if (user(); as person) {
          <section class="rs-card card">
            <div class="head">
              <app-avatar [user]="person" [size]="80" />
              <div class="text">
                <h1>{{ person | fullName }}</h1>
                <a class="rs-muted" [routerLink]="['/profile', person.name]">&#64;{{ person.name }}</a>
                <span class="rs-small rs-muted">{{ person.email }}</span>
                <span class="rs-small rs-muted">{{ 'USERS_ADMIN.JOINED' | translate: { time: (person.createdAt | relativeTime) } }}</span>
              </div>
              <ion-button size="small" class="rs-soft" (click)="changeAvatar()" [disabled]="busy()">
                <ion-icon slot="start" name="camera-outline" /> {{ 'CHANGE_AVATAR' | translate }}
              </ion-button>
            </div>

            <div class="setting">
              <span class="text">
                <span class="label">{{ 'ROLE' | translate }}</span>
                <span class="hint">{{ 'USERS_ADMIN.ROLE_HINT' | translate }}</span>
              </span>
              <ion-select interface="popover" [value]="person.role" [disabled]="isSelf(person)" (ionChange)="setRole($event.detail.value)" [attr.aria-label]="'ROLE' | translate">
                @for (role of roles; track role.value) {
                  <ion-select-option [value]="role.value">{{ role.label | translate }}</ion-select-option>
                }
              </ion-select>
            </div>

            <div class="setting">
              <span class="text">
                <span class="label">{{ 'USERS_ADMIN.VERIFIED' | translate }}</span>
                <span class="hint">{{ 'USERS_ADMIN.VERIFIED_HINT' | translate }}</span>
              </span>
              <ion-toggle [checked]="person.verified" (ionChange)="setVerified($event.detail.checked)" [attr.aria-label]="'USERS_ADMIN.VERIFIED' | translate" />
            </div>

            <div class="stats">
              <span><b>{{ person.followerCount }}</b> {{ 'PROFILE.FOLLOWERS' | translate }}</span>
              <span><b>{{ person.followingCount }}</b> {{ 'PROFILE.FOLLOWING' | translate }}</span>
              <span>{{ person.provider }}</span>
              @if (person.mfaEnabled) {
                <span class="mfa"><ion-icon name="shield-checkmark" /> 2FA</span>
              }
            </div>

            @if (!isSelf(person)) {
              <div class="actions">
                <ion-button size="small" color="danger" fill="outline" (click)="remove(person)">{{ 'DELETE' | translate }}</ion-button>
              </div>
            }
          </section>
        } @else {
          <div class="rs-empty"><ion-spinner /></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .card {
      padding: 16px;
    }

    .head {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding-bottom: 12px;
    }

    .head .text {
      display: flex;
      flex: 1 1 200px;
      flex-direction: column;
    }

    h1 {
      font-size: 1.375rem;
    }

    .setting {
      align-items: center;
      border-top: 1px solid var(--rs-divider);
      display: flex;
      gap: 12px;
      padding: 12px 0;
    }

    .setting .text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
    }

    .label {
      font-weight: 600;
    }

    .hint {
      color: var(--rs-text-2);
      font-size: 0.8125rem;
    }

    .stats {
      border-top: 1px solid var(--rs-divider);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding-top: 12px;
    }

    .mfa {
      align-items: center;
      color: var(--ion-color-success);
      display: inline-flex;
      gap: 4px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 12px;
    }
  `,
})
export class UserDetailPage {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly images = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly user = signal<User | null>(null);
  readonly busy = signal(false);

  readonly roles = [
    { value: UserRole.Visitor, label: 'VISITOR' },
    { value: UserRole.User, label: 'USER' },
    { value: UserRole.Roundsman, label: 'ROUNDSMAN' },
    { value: UserRole.Supervisor, label: 'SUPERVISOR' },
    { value: UserRole.Admin, label: 'ADMIN' },
  ];

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  isSelf(user: User): boolean {
    return this.auth.user()?.id === user.id;
  }

  async setRole(role: UserRole): Promise<void> {
    const person = this.user();

    if (!person || person.role === role) {
      return;
    }

    await this.guard(async () => this.user.set(await this.users.setRole(person.id, role)));
  }

  async setVerified(verified: boolean): Promise<void> {
    const person = this.user();

    if (!person || person.verified === verified) {
      return;
    }

    await this.guard(async () => this.user.set(await this.users.setVerified(person.id, verified)));
  }

  async changeAvatar(): Promise<void> {
    const person = this.user();
    const file = await this.images.pick({ aspectRatio: 1, targetWidth: 720 });

    if (person && file) {
      await this.guard(async () => {
        await this.users.updateAvatarById(person.id, file);
        this.user.set(await this.users.findById(person.id));
      });
    }
  }

  async remove(person: User): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'USERS_ADMIN.DELETE_TITLE',
      message: 'USERS_ADMIN.DELETE_MESSAGE',
      confirmText: 'DELETE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(async () => {
        await this.users.remove(person.id);
        await this.router.navigateByUrl('/users');
      });
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.user.set(await this.users.findById(id));
    } catch (error) {
      await this.feedback.error(error);
      await this.router.navigateByUrl('/users');
    }
  }

  private async guard(operation: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);

    try {
      await operation();
      await this.feedback.success();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
