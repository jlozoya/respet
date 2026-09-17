import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { TranslatePipe } from '@ngx-translate/core';
import type { Gender } from '@respet/shared';

import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { ImagePickerService } from '../../core/media/image-picker.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { phoneValidator, usernameValidator } from '../../shared/validators/form-validators';
import { SettingsLayoutComponent } from './settings-layout.component';

/** «Editar perfil»: fotos, nombre, presentación y datos personales. */
@Component({
  selector: 'app-profile-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    AvatarComponent,
    ControlMessagesComponent,
    SettingsLayoutComponent,
  ],
  template: `
    <app-settings-layout title="SETTINGS.PROFILE" subtitle="SETTINGS.PROFILE_HINT">
      <section class="rs-card block">
        <div class="photo-row">
          <div>
            <h3>{{ 'PROFILE.AVATAR' | translate }}</h3>
            <p class="rs-small rs-muted">{{ 'PROFILE.AVATAR_HINT' | translate }}</p>
          </div>
          <ion-button class="rs-tinted" size="small" (click)="changeAvatar()" [disabled]="busy() === 'avatar'">
            {{ 'EDIT' | translate }}
          </ion-button>
        </div>
        <div class="avatar-preview">
          @if (busy() === 'avatar') {
            <ion-spinner />
          } @else {
            <app-avatar [user]="auth.user()" [size]="140" />
          }
        </div>

        <hr class="rs-divider" />

        <div class="photo-row">
          <div>
            <h3>{{ 'PROFILE.COVER' | translate }}</h3>
            <p class="rs-small rs-muted">{{ 'PROFILE.COVER_HINT' | translate }}</p>
          </div>
          <span class="buttons">
            @if (auth.user()?.cover) {
              <ion-button class="rs-soft" size="small" (click)="removeCover()">{{ 'REMOVE' | translate }}</ion-button>
            }
            <ion-button class="rs-tinted" size="small" (click)="changeCover()" [disabled]="busy() === 'cover'">
              {{ (auth.user()?.cover ? 'EDIT' : 'ADD') | translate }}
            </ion-button>
          </span>
        </div>
        <div class="cover-preview" [style.background-image]="auth.user()?.cover ? 'url(' + auth.user()?.cover?.url + ')' : null">
          @if (busy() === 'cover') {
            <ion-spinner />
          }
        </div>
      </section>

      <form class="rs-card block form" [formGroup]="form" (ngSubmit)="save()">
        <div class="pair">
          <div>
            <ion-input fill="outline" labelPlacement="floating" [label]="'FIRST_NAME' | translate" formControlName="firstName" />
            <app-control-messages [control]="form.controls.firstName" />
          </div>
          <div>
            <ion-input fill="outline" labelPlacement="floating" [label]="'LAST_NAME' | translate" formControlName="lastName" />
            <app-control-messages [control]="form.controls.lastName" />
          </div>
        </div>

        <ion-input fill="outline" labelPlacement="floating" [label]="'SIGNUP_PAGE.USERNAME' | translate" formControlName="name" autocapitalize="off" [helperText]="'PROFILE.USERNAME_HINT' | translate" />
        <app-control-messages [control]="form.controls.name" />

        <ion-textarea
          fill="outline"
          labelPlacement="floating"
          [label]="'PROFILE.BIO' | translate"
          formControlName="bio"
          [autoGrow]="true"
          [counter]="true"
          [maxlength]="280"
        />

        <ion-input fill="outline" labelPlacement="floating" [label]="'PROFILE.WEBSITE' | translate" formControlName="website" type="url" inputmode="url" placeholder="https://" />
        <app-control-messages [control]="form.controls.website" />

        <ion-input fill="outline" labelPlacement="floating" [label]="'PHONE' | translate" formControlName="phone" type="tel" inputmode="tel" />
        <app-control-messages [control]="form.controls.phone" />

        <div class="pair">
          <label class="date-field">
            <span class="rs-small rs-muted">{{ 'BIRTHDAY' | translate }}</span>
            <input type="date" formControlName="birthday" [max]="today" />
          </label>
          <ion-select fill="outline" labelPlacement="floating" [label]="'GENDER' | translate" formControlName="gender" interface="popover">
            <ion-select-option value="female">{{ 'FEMALE' | translate }}</ion-select-option>
            <ion-select-option value="male">{{ 'MALE' | translate }}</ion-select-option>
            <ion-select-option value="unspecified">{{ 'PREFER_NOT_TO_SAY' | translate }}</ion-select-option>
          </ion-select>
        </div>

        <div class="actions">
          <ion-button type="submit" [disabled]="saving() || form.pristine">
            @if (saving()) {
              <ion-spinner name="crescent" />
            } @else {
              <ion-icon slot="start" name="checkmark" /> {{ 'SAVE' | translate }}
            }
          </ion-button>
        </div>
      </form>
    </app-settings-layout>
  `,
  styleUrl: './settings.scss',
})
export class ProfileSettingsPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly images = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);

  readonly busy = signal<'avatar' | 'cover' | null>(null);
  readonly saving = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, usernameValidator()]],
    bio: ['', [Validators.maxLength(280)]],
    website: ['', [Validators.pattern(/^(https?:\/\/)?[^\s]+\.[^\s]+$/i)]],
    phone: ['', [phoneValidator()]],
    birthday: [''],
    gender: new FormControl<Gender | ''>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const user = this.auth.user();

    if (user) {
      this.form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        bio: user.bio ?? '',
        website: user.website ?? '',
        phone: user.phone ?? '',
        birthday: user.birthday?.slice(0, 10) ?? '',
        gender: user.gender ?? '',
      });
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const website = value.website.trim();
    this.saving.set(true);

    try {
      const user = await this.users.updateProfile({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        name: value.name.trim(),
        bio: value.bio.trim() || null,
        website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
        phone: value.phone.trim() || null,
        birthday: value.birthday || null,
        gender: value.gender || null,
      });

      await this.auth.setUser(user);
      this.form.markAsPristine();
      await this.feedback.success('SETTINGS.SAVED');
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  async changeAvatar(): Promise<void> {
    const file = await this.images.pick({ aspectRatio: 1, targetWidth: 720 });

    if (file) {
      await this.upload('avatar', () => this.users.updateAvatar(file));
    }
  }

  async changeCover(): Promise<void> {
    const file = await this.images.pick({ aspectRatio: 16 / 6, targetWidth: 1640 });

    if (file) {
      await this.upload('cover', () => this.users.updateCover(file));
    }
  }

  async removeCover(): Promise<void> {
    await this.upload('cover', () => this.users.removeCover());
  }

  private async upload(kind: 'avatar' | 'cover', operation: () => Promise<unknown>): Promise<void> {
    this.busy.set(kind);

    try {
      await operation();
      await this.auth.refreshUser();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(null);
    }
  }
}
