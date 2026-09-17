import { ChangeDetectionStrategy, Component, type OnInit, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { OAuthAuthorizationPreview, OAuthAuthorizeRequest } from '@respet/shared';

import { ApiError } from '../../core/api/api-error';
import { DevelopersService } from '../../core/api/developers.service';
import { AuthService } from '../../core/auth/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/**
 * «¿Autorizar esta aplicación?».
 *
 * Es el extremo de autorización de OAuth: la aplicación de terceros manda aquí
 * a la persona con sus parámetros en la dirección, y aquí se le enseña quién
 * pide acceso, a qué, y si ya le había concedido algo. Al aceptar o rechazar,
 * el servidor devuelve la dirección a la que volver —con el código o con el
 * error— y el navegador va allí.
 *
 * Los parámetros llegan con los nombres de RFC 6749 (`client_id`,
 * `redirect_uri`…) y se traducen a los del esquema.
 */
@Component({
  selector: 'app-authorize',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonContent, IonButton, IonIcon, IonSpinner, AvatarComponent, FullNamePipe],
  template: `
    <ion-content>
      <div class="wrapper">
        <div class="rs-card card">
          @if (preview(); as info) {
            <header class="head">
              <app-avatar [src]="info.app.icon?.url" [label]="info.app.name" [size]="72" />
              <h1>{{ 'OAUTH.TITLE' | translate: { app: info.app.name } }}</h1>
              <p class="rs-muted">{{ 'OAUTH.SUBTITLE' | translate: { app: info.app.name } }}</p>
              @if (info.app.inDevelopment) {
                <span class="dev">{{ 'OAUTH.IN_DEVELOPMENT' | translate }}</span>
              }
            </header>

            <div class="account">
              <app-avatar [user]="auth.user()" [size]="40" />
              <span class="rs-row-text">
                <span class="title">{{ auth.user() | fullName }}</span>
                <span class="subtitle">{{ auth.user()?.email }}</span>
              </span>
            </div>

            <h2>{{ 'OAUTH.WILL_BE_ABLE_TO' | translate }}</h2>
            <ul class="scopes">
              @for (scope of info.requestedScopes; track scope.scope) {
                <li>
                  <ion-icon [name]="scope.sensitive ? 'alert-circle' : 'checkmark-circle'" [class.sensitive]="scope.sensitive" />
                  <span>
                    <span class="rs-strong">{{ scope.title }}</span>
                    <span class="rs-small rs-muted">{{ scope.description }}</span>
                  </span>
                  @if (info.alreadyGranted.includes(scope.scope)) {
                    <span class="granted">{{ 'OAUTH.ALREADY_GRANTED' | translate }}</span>
                  }
                </li>
              }
            </ul>

            <p class="rs-small rs-muted legal">
              {{ 'OAUTH.LEGAL' | translate: { app: info.app.name } }}
              @if (info.app.privacyPolicyUrl) {
                <a [href]="info.app.privacyPolicyUrl" target="_blank" rel="noopener noreferrer">{{ 'PRIVACY_POLICY' | translate }}</a>
              }
              @if (info.app.websiteUrl) {
                · <a [href]="info.app.websiteUrl" target="_blank" rel="noopener noreferrer">{{ 'DEVELOPERS.WEBSITE' | translate }}</a>
              }
            </p>
            <p class="rs-small rs-muted owner">{{ 'OAUTH.OWNER' | translate: { name: ownerName(info) } }} · {{ redirectHost() }}</p>

            <div class="buttons">
              <ion-button class="rs-soft" [disabled]="busy()" (click)="decide(false)">{{ 'OAUTH.CANCEL' | translate }}</ion-button>
              <ion-button [disabled]="busy()" (click)="decide(true)">
                @if (busy()) {
                  <ion-spinner name="crescent" />
                } @else {
                  {{ 'OAUTH.CONTINUE_AS' | translate: { name: auth.user()?.firstName } }}
                }
              </ion-button>
            </div>
          } @else if (error(); as code) {
            <div class="rs-empty">
              <ion-icon name="alert-circle-outline" />
              <h2>{{ 'OAUTH.INVALID_TITLE' | translate }}</h2>
              <p>{{ code | translate }}</p>
            </div>
          } @else {
            <div class="rs-empty"><ion-spinner /></div>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .wrapper {
      display: flex;
      justify-content: center;
      padding: 24px 12px 48px;
    }

    .card {
      border-radius: 12px !important;
      margin: 0 !important;
      max-width: 520px;
      padding: 24px;
      width: 100%;
    }

    .head {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: center;
    }

    h1 {
      font-size: 1.375rem;
    }

    .head p {
      margin: 0;
    }

    .dev {
      background: rgb(247 185 40 / 20%);
      border-radius: 999px;
      color: #9a6b00;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 10px;
    }

    .account {
      align-items: center;
      background: var(--rs-surface-2);
      border-radius: 10px;
      display: flex;
      gap: 12px;
      margin: 20px 0;
      padding: 10px 12px;
    }

    h2 {
      font-size: 1rem;
      margin-bottom: 8px;
    }

    .scopes {
      display: flex;
      flex-direction: column;
      gap: 12px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .scopes li {
      align-items: flex-start;
      display: flex;
      gap: 10px;
    }

    .scopes ion-icon {
      color: var(--ion-color-success);
      flex: 0 0 auto;
      font-size: 22px;
    }

    .scopes ion-icon.sensitive {
      color: var(--ion-color-warning);
    }

    .scopes li > span {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
    }

    .granted {
      color: var(--rs-text-2);
      font-size: 0.75rem;
    }

    .legal,
    .owner {
      margin: 16px 0 0;
    }

    .legal a {
      color: var(--ion-color-primary);
    }

    .buttons {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 20px;
    }
  `,
})
export class AuthorizePage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly developers = inject(DevelopersService);

  /* Los parámetros llegan con los nombres de OAuth, con guion bajo. */
  readonly client_id = input<string | null>(null);
  readonly redirect_uri = input<string | null>(null);
  readonly response_type = input<string | null>(null);
  readonly scope = input<string | null>(null);
  readonly state = input<string | null>(null);
  readonly code_challenge = input<string | null>(null);
  readonly code_challenge_method = input<string | null>(null);

  readonly preview = signal<OAuthAuthorizationPreview | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    const request = this.request();

    if (!request) {
      this.error.set('SERVER.INVALID_CLIENT');

      return;
    }

    try {
      this.preview.set(await this.developers.authorizationPreview(request));
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.code : 'SERVER.ERROR');
    }
  }

  ownerName(info: OAuthAuthorizationPreview): string {
    return [info.app.owner.firstName, info.app.owner.lastName].filter(Boolean).join(' ') || info.app.owner.name;
  }

  redirectHost(): string {
    try {
      return new URL(this.redirect_uri() ?? '').host;
    } catch {
      return '';
    }
  }

  async decide(approve: boolean): Promise<void> {
    const request = this.request();

    if (!request) {
      return;
    }

    this.busy.set(true);

    try {
      const result = approve ? await this.developers.approve(request) : await this.developers.deny(request);

      // Se sale de la aplicación hacia la dirección que indicó el servidor:
      // es la de la aplicación de terceros, ya validada contra las suyas.
      window.location.href = result.redirectTo;
    } catch (error) {
      this.busy.set(false);
      this.error.set(error instanceof ApiError ? error.code : 'SERVER.ERROR');
    }
  }

  private request(): OAuthAuthorizeRequest | null {
    const clientId = this.client_id();
    const redirectUri = this.redirect_uri();

    if (!clientId || !redirectUri) {
      return null;
    }

    return {
      clientId,
      redirectUri,
      responseType: this.response_type() ?? 'code',
      scope: this.scope() ?? undefined,
      state: this.state() ?? undefined,
      codeChallenge: this.code_challenge() ?? undefined,
      codeChallengeMethod: this.code_challenge_method() ?? undefined,
    };
  }
}
