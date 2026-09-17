import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { AppCredentials, DeveloperApp, OAuthScopeInfo } from '@respet/shared';

import { environment } from '../../../environments/environment';
import { DevelopersService } from '../../core/api/developers.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { AppFormModalComponent } from './app-form-modal.component';
import { CredentialsModalComponent } from './credentials-modal.component';

/**
 * Respet para desarrolladores: la documentación esencial de la API y las
 * aplicaciones propias.
 *
 * Como en Facebook, una aplicación nace en desarrollo —sólo la usan su dueño y
 * sus probadores— y se publica cuando está lista. Accede con OAuth 2.0 en
 * nombre de cada persona, con los permisos que ésta le conceda.
 */
@Component({
  selector: 'app-developers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, IonContent, IonButton, IonIcon, IonSpinner, AvatarComponent, PageHeaderComponent],
  templateUrl: './developers.page.html',
  styleUrl: './developers.scss',
})
export class DevelopersPage implements OnInit {
  private readonly developers = inject(DevelopersService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  readonly apps = signal<DeveloperApp[]>([]);
  readonly scopes = signal<OAuthScopeInfo[]>([]);
  readonly loading = signal(true);

  readonly graphqlUrl = environment.graphqlUrl;
  readonly apiUrl = environment.apiUrl;
  readonly authorizeUrl = `${window.location.origin}/oauth/authorize`;
  readonly wsUrl = computed(() => this.graphqlUrl.replace(/^http/, 'ws'));

  readonly example = computed(
    () => `curl -X POST ${this.graphqlUrl} \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ me { id name firstName } }"}'`,
  );

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const [apps, scopes] = await Promise.all([this.developers.apps(), this.developers.scopes()]);
      this.apps.set(apps);
      this.scopes.set(scopes);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AppFormModalComponent,
      componentProps: { scopes: this.scopes() },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    const { data } = await modal.onWillDismiss<AppCredentials>();

    if (!data) {
      return;
    }

    this.apps.update((items) => [data.app, ...items]);

    const credentials = await this.modalCtrl.create({
      component: CredentialsModalComponent,
      componentProps: { credentials: data },
      cssClass: 'rs-dialog',
      backdropDismiss: false,
    });

    await credentials.present();
    await credentials.onWillDismiss();
    await this.router.navigate(['/developers', data.app.id]);
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    await this.feedback.toast('SECURITY.COPIED');
  }
}
