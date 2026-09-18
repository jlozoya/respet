import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { DeveloperApp, OAuthClientType, OAuthScopeInfo } from '@social-network/shared';

import { DevelopersService } from '../../core/api/developers.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';

/**
 * Alta y edición de una aplicación de terceros.
 *
 * Las direcciones de retorno van una por línea, que es como se escriben en la
 * consola de Facebook, y los permisos son los que la aplicación podrá pedir:
 * nunca se concede nada aquí, sólo se declara lo que llegará a la pantalla de
 * autorización.
 */
@Component({
  selector: 'app-app-form-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonCheckbox,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{
          (app() ? 'DEVELOPERS.EDIT_APP' : 'DEVELOPERS.CREATE_APP') | translate
        }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form class="form" [formGroup]="form" (ngSubmit)="save()">
        <ion-input
          fill="outline"
          labelPlacement="floating"
          [label]="'DEVELOPERS.APP_NAME' | translate"
          formControlName="name"
        />
        <app-control-messages [control]="form.controls.name" />

        <ion-textarea
          fill="outline"
          labelPlacement="floating"
          [label]="'DESCRIPTION' | translate"
          formControlName="description"
          [autoGrow]="true"
          [maxlength]="500"
        />

        <ion-input
          fill="outline"
          labelPlacement="floating"
          [label]="'DEVELOPERS.WEBSITE' | translate"
          formControlName="websiteUrl"
          type="url"
          placeholder="https://"
        />
        <ion-input
          fill="outline"
          labelPlacement="floating"
          [label]="'DEVELOPERS.PRIVACY_URL' | translate"
          formControlName="privacyPolicyUrl"
          type="url"
          placeholder="https://"
        />

        @if (!app()) {
          <ion-select
            fill="outline"
            labelPlacement="floating"
            [label]="'DEVELOPERS.CLIENT_TYPE' | translate"
            formControlName="clientType"
            interface="popover"
          >
            <ion-select-option value="confidential">{{
              'DEVELOPERS.CONFIDENTIAL' | translate
            }}</ion-select-option>
            <ion-select-option value="public">{{
              'DEVELOPERS.PUBLIC' | translate
            }}</ion-select-option>
          </ion-select>
          <p class="rs-small rs-muted hint">{{ 'DEVELOPERS.CLIENT_TYPE_HINT' | translate }}</p>
        }

        <ion-textarea
          fill="outline"
          labelPlacement="floating"
          [label]="'DEVELOPERS.REDIRECT_URIS' | translate"
          formControlName="redirectUris"
          [autoGrow]="true"
          [rows]="3"
        />
        <p class="rs-small rs-muted hint">{{ 'DEVELOPERS.REDIRECT_URIS_HINT' | translate }}</p>

        <h3>{{ 'DEVELOPERS.ALLOWED_SCOPES' | translate }}</h3>
        <div class="checks">
          @for (scope of scopes(); track scope.scope) {
            <ion-checkbox
              labelPlacement="end"
              justify="start"
              [checked]="selected().has(scope.scope)"
              (ionChange)="toggleScope(scope.scope, $event.detail.checked)"
            >
              {{ scope.title }}
            </ion-checkbox>
          }
        </div>

        <div class="actions">
          <ion-button class="rs-soft" type="button" (click)="close()">{{
            'CANCEL' | translate
          }}</ion-button>
          <ion-button type="submit" [disabled]="busy()">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ (app() ? 'SAVE' : 'DEVELOPERS.CREATE') | translate }}
            }
          </ion-button>
        </div>
      </form>
    </ion-content>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hint {
      margin: -6px 0 0;
    }

    h3 {
      font-size: 1rem;
      margin-top: 8px;
    }

    .checks {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
    }
  `,
})
export class AppFormModalComponent implements OnInit {
  private readonly developers = inject(DevelopersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  readonly scopes = input<OAuthScopeInfo[]>([]);
  /** La aplicación que se edita; sin ella, se crea una nueva. */
  readonly app = input<DeveloperApp | null>(null);

  readonly busy = signal(false);
  readonly selected = signal<ReadonlySet<string>>(new Set(['public_profile']));

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: [''],
    websiteUrl: [''],
    privacyPolicyUrl: [''],
    clientType: new FormControl<OAuthClientType>('confidential', { nonNullable: true }),
    redirectUris: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const app = this.app();

    if (app) {
      this.form.patchValue({
        name: app.name,
        description: app.description,
        websiteUrl: app.websiteUrl ?? '',
        privacyPolicyUrl: app.privacyPolicyUrl ?? '',
        clientType: app.clientType,
        redirectUris: app.redirectUris.join('\n'),
      });
      this.selected.set(new Set(app.allowedScopes));
    }
  }

  toggleScope(scope: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(scope);
      } else {
        next.delete(scope);
      }

      return next;
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      websiteUrl: value.websiteUrl.trim() || undefined,
      privacyPolicyUrl: value.privacyPolicyUrl.trim() || undefined,
      redirectUris: value.redirectUris
        .split(/[\n,]/)
        .map((uri) => uri.trim())
        .filter(Boolean),
      allowedScopes: [...this.selected()],
    };

    this.busy.set(true);

    try {
      const app = this.app();
      const result = app
        ? await this.developers.update(app.id, request)
        : await this.developers.create({ ...request, clientType: value.clientType });

      await this.modalCtrl.dismiss(result);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
