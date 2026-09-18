import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  WEBHOOK_EVENTS,
  type ApiUsagePoint,
  type AppCredentials,
  type DeveloperApp,
  type OAuthScopeInfo,
  type WebhookDelivery,
} from '@social-network/shared';

import { DevelopersService } from '../../core/api/developers.service';
import { ImagePickerService } from '../../core/media/image-picker.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { AppFormModalComponent } from './app-form-modal.component';
import { CredentialsModalComponent } from './credentials-modal.component';

type Tab = 'settings' | 'webhook' | 'testers' | 'usage';

/**
 * La ficha de una aplicación: sus credenciales, sus permisos, su webhook, sus
 * probadores y cuánto se usa.
 */
@Component({
  selector: 'app-developer-app',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonToggle,
    IonCheckbox,
    IonSpinner,
    AvatarComponent,
    PageHeaderComponent,
    RelativeTimePipe,
  ],
  templateUrl: './developer-app.page.html',
  styleUrl: './developers.scss',
})
export class DeveloperAppPage {
  private readonly developers = inject(DevelopersService);
  private readonly images = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly app = signal<DeveloperApp | null>(null);
  readonly scopes = signal<OAuthScopeInfo[]>([]);
  readonly usage = signal<ApiUsagePoint[]>([]);
  readonly deliveries = signal<WebhookDelivery[]>([]);
  readonly tab = signal<Tab>('settings');
  readonly busy = signal(false);

  readonly webhookUrl = signal('');
  readonly webhookEvents = signal<ReadonlySet<string>>(new Set());
  readonly webhookActive = signal(true);
  readonly availableEvents = WEBHOOK_EVENTS;

  /** La barra más alta de la gráfica de uso, para escalar las demás. */
  readonly peak = computed(() => Math.max(1, ...this.usage().map((point) => point.requests)));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  async load(id: string): Promise<void> {
    try {
      const [app, scopes] = await Promise.all([this.developers.app(id), this.developers.scopes()]);
      this.apply(app);
      this.scopes.set(scopes);

      const [usage, deliveries] = await Promise.all([
        this.developers.usage(id).catch(() => []),
        this.developers
          .deliveries(id, 1, 10)
          .then((page) => page.data)
          .catch(() => []),
      ]);

      this.usage.set(usage);
      this.deliveries.set(deliveries);
    } catch (error) {
      await this.feedback.error(error);
      await this.router.navigateByUrl('/developers');
    }
  }

  scopeTitle(scope: string): string {
    return this.scopes().find((item) => item.scope === scope)?.title ?? scope;
  }

  barHeight(point: ApiUsagePoint): number {
    return Math.round((point.requests / this.peak()) * 100);
  }

  errorHeight(point: ApiUsagePoint): number {
    return Math.round((point.errors / this.peak()) * 100);
  }

  hourLabel(point: ApiUsagePoint): string {
    return point.hour.slice(11, 16) || point.hour;
  }

  async edit(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: AppFormModalComponent,
      componentProps: { app, scopes: this.scopes() },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    const { data } = await modal.onWillDismiss<DeveloperApp>();

    if (data) {
      this.apply(data);
    }
  }

  async changeIcon(): Promise<void> {
    const file = await this.images.pick({ aspectRatio: 1, targetWidth: 512 });
    const app = this.app();

    if (file && app) {
      await this.guard(async () => this.apply(await this.developers.setIcon(app.id, file)));
    }
  }

  async toggleStatus(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    await this.guard(async () =>
      this.apply(
        await this.developers.setStatus(app.id, app.status === 'live' ? 'development' : 'live'),
      ),
    );
  }

  async rotateSecret(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    const confirmed = await this.feedback.confirm({
      header: 'DEVELOPERS.ROTATE_SECRET',
      message: 'DEVELOPERS.ROTATE_SECRET_MESSAGE',
      confirmText: 'DEVELOPERS.ROTATE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await this.guard(async () => {
      const credentials = await this.developers.rotateSecret(app.id);
      this.apply(credentials.app);
      await this.showCredentials(credentials);
    });
  }

  async saveWebhook(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    await this.guard(async () => {
      const credentials = await this.developers.updateWebhook(app.id, {
        url: this.webhookUrl().trim() || null,
        events: [...this.webhookEvents()],
        active: this.webhookActive(),
      });

      this.apply(credentials.app);

      if (credentials.webhookSecret) {
        await this.showCredentials(credentials);
      } else {
        await this.feedback.success('SETTINGS.SAVED');
      }
    });
  }

  toggleEvent(event: string, checked: boolean): void {
    this.webhookEvents.update((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(event);
      } else {
        next.delete(event);
      }

      return next;
    });
  }

  async verifyWebhook(): Promise<void> {
    const app = this.app();

    if (app) {
      await this.guard(async () => {
        this.apply(await this.developers.verifyWebhook(app.id));
        await this.feedback.success('DEVELOPERS.WEBHOOK_VERIFIED');
      });
    }
  }

  async testWebhook(): Promise<void> {
    const app = this.app();

    if (app) {
      await this.guard(async () => {
        await this.developers.sendTestWebhook(app.id);
        await this.feedback.toast('DEVELOPERS.TEST_SENT', { color: 'success' });
        this.deliveries.set((await this.developers.deliveries(app.id, 1, 10)).data);
      });
    }
  }

  async rotateWebhookSecret(): Promise<void> {
    const app = this.app();

    if (app) {
      await this.guard(async () => {
        const credentials = await this.developers.rotateWebhookSecret(app.id);
        this.apply(credentials.app);
        await this.showCredentials(credentials);
      });
    }
  }

  async addTester(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('DEVELOPERS.ADD_TESTER') as string,
      message: this.translate.instant('DEVELOPERS.ADD_TESTER_HINT') as string,
      inputs: [{ name: 'username', placeholder: 'usuario' }],
      buttons: [
        { text: this.translate.instant('CANCEL') as string, role: 'cancel' },
        { text: this.translate.instant('ADD') as string, role: 'confirm' },
      ],
    });

    await alert.present();
    const { data, role } = await alert.onWillDismiss<{ values: { username?: string } }>();
    const username = data?.values.username?.trim().replace(/^@/, '');

    if (role === 'confirm' && username) {
      await this.guard(async () => this.apply(await this.developers.addTester(app.id, username)));
    }
  }

  async removeTester(userId: string): Promise<void> {
    const app = this.app();

    if (app) {
      await this.guard(async () => this.apply(await this.developers.removeTester(app.id, userId)));
    }
  }

  async remove(): Promise<void> {
    const app = this.app();

    if (!app) {
      return;
    }

    const confirmed = await this.feedback.confirm({
      header: 'DEVELOPERS.DELETE_APP',
      message: 'DEVELOPERS.DELETE_APP_MESSAGE',
      confirmText: 'DELETE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(async () => {
        await this.developers.remove(app.id);
        await this.router.navigateByUrl('/developers');
      });
    }
  }

  async copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    await this.feedback.toast('SECURITY.COPIED');
  }

  private apply(app: DeveloperApp): void {
    this.app.set(app);
    this.webhookUrl.set(app.webhook.url ?? '');
    this.webhookEvents.set(new Set(app.webhook.events));
    this.webhookActive.set(app.webhook.active);
  }

  private async showCredentials(credentials: AppCredentials): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CredentialsModalComponent,
      componentProps: { credentials },
      cssClass: 'rs-dialog',
      backdropDismiss: false,
    });

    await modal.present();
    await modal.onWillDismiss();
  }

  private async guard(operation: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);

    try {
      await operation();
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
