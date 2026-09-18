import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import type {
  DeviceInfo,
  DeviceSession,
  MfaStatus,
  SecurityEvent,
  TotpSetup,
} from '@social-network/shared';

import { SecurityService } from '../../core/api/security.service';
import { UsersService } from '../../core/api/users.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandingService } from '../../core/branding/branding.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReauthService } from '../../core/ui/reauth.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { SettingsLayoutComponent } from './settings-layout.component';

/** En qué punto está el asistente para activar la verificación en dos pasos. */
type SetupStep = 'idle' | 'scan' | 'codes';

const EVENT_ICONS: Partial<Record<SecurityEvent['type'], string>> = {
  login: 'log-in-outline',
  login_failed: 'warning-outline',
  mfa_failed: 'warning-outline',
  logout: 'log-out-outline',
  session_revoked: 'close-circle-outline',
  refresh_reuse_detected: 'alert-circle-outline',
  password_changed: 'key-outline',
  password_reset: 'key-outline',
  email_changed: 'mail-outline',
  mfa_enabled: 'shield-checkmark-outline',
  mfa_disabled: 'shield-outline',
  recovery_codes_regenerated: 'refresh-outline',
  recovery_code_used: 'document-lock-outline',
  trusted_device_revoked: 'phone-portrait-outline',
  app_authorized: 'apps-outline',
  app_revoked: 'apps-outline',
};

/**
 * Seguridad e inicio de sesión.
 *
 * - **Verificación en dos pasos**, opcional: un asistente que enseña el código
 *   QR para la app de autenticación, pide un código para confirmarla y
 *   entrega los códigos de recuperación, que sólo se ven esa vez.
 * - **Dónde has iniciado sesión**: cada dispositivo, con la opción de
 *   cerrarlo a distancia.
 * - **Actividad reciente**: entradas, intentos fallidos, cambios de
 *   contraseña, aplicaciones autorizadas.
 */
@Component({
  selector: 'app-security-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslatePipe,
    IonButton,
    IonIcon,
    IonInput,
    IonSpinner,
    IonToggle,
    RelativeTimePipe,
    SettingsLayoutComponent,
  ],
  templateUrl: './security-settings.page.html',
  styleUrl: './settings.scss',
  styles: `
    .qr {
      background: #fff;
      border-radius: 8px;
      display: block;
      height: 200px;
      margin: 12px auto;
      padding: 8px;
      width: 200px;
    }

    .subheading {
      font-size: 0.9375rem;
      margin-top: 12px;
    }

    .secret {
      background: var(--rs-surface-2);
      border: 0;
      border-radius: 6px;
      color: inherit;
      cursor: copy;
      display: block;
      width: 100%;
      font-family: ui-monospace, monospace;
      letter-spacing: 0.08em;
      margin: 4px 0 12px;
      overflow-wrap: anywhere;
      padding: 8px 12px;
      text-align: center;
    }

    .codes {
      display: grid;
      font-family: ui-monospace, monospace;
      font-size: 1rem;
      gap: 6px 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 12px 0;
      text-align: center;
    }

    .codes span {
      background: var(--rs-surface-2);
      border-radius: 6px;
      padding: 6px;
    }

    .code-input {
      font-size: 1.375rem;
      letter-spacing: 0.3em;
      margin: 0 auto;
      max-width: 240px;
      text-align: center;
    }

    .steps {
      color: var(--rs-text-2);
      margin: 8px 0;
      padding-inline-start: 20px;
    }
  `,
})
export class SecuritySettingsPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly security = inject(SecurityService);
  private readonly users = inject(UsersService);
  private readonly reauth = inject(ReauthService);
  private readonly feedback = inject(FeedbackService);
  private readonly branding = inject(BrandingService);

  readonly mfa = signal<MfaStatus | null>(null);
  readonly sessions = signal<DeviceSession[]>([]);
  readonly events = signal<SecurityEvent[]>([]);
  readonly eventsPage = signal(1);
  readonly hasMoreEvents = signal(false);
  readonly loginAlerts = signal(true);

  readonly step = signal<SetupStep>('idle');
  readonly setup = signal<TotpSetup | null>(null);
  readonly code = signal('');
  readonly recoveryCodes = signal<string[]>([]);
  readonly busy = signal(false);

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.loginAlerts.set(this.auth.user()?.permissions?.loginAlerts ?? true);

    await Promise.all([
      this.security.mfaStatus().then(
        (status) => this.mfa.set(status),
        (error: unknown) => this.feedback.error(error),
      ),
      this.loadSessions(),
      this.loadEvents(1),
    ]);
  }

  deviceIcon(device: DeviceInfo): string {
    switch (device.type) {
      case 'mobile':
        return 'phone-portrait-outline';
      case 'tablet':
        return 'tablet-portrait-outline';
      case 'desktop':
        return 'desktop-outline';
      default:
        return 'hardware-chip-outline';
    }
  }

  deviceLabel(device: DeviceInfo): string {
    return [device.browser, device.os].filter(Boolean).join(' · ') || device.name;
  }

  eventIcon(event: SecurityEvent): string {
    return EVENT_ICONS[event.type] ?? 'information-circle-outline';
  }

  // --- Verificación en dos pasos --------------------------------------------

  async beginSetup(): Promise<void> {
    await this.guard(async () => {
      const setup = await this.reauth.run((reauth) => this.security.beginTotpSetup(reauth));

      if (setup) {
        this.setup.set(setup);
        this.code.set('');
        this.step.set('scan');
      }
    });
  }

  async confirmSetup(): Promise<void> {
    const code = this.code().replace(/\s+/g, '');

    if (code.length < 6) {
      return;
    }

    await this.guard(async () => {
      const result = await this.security.confirmTotpSetup(code);
      this.recoveryCodes.set(result.codes);
      this.step.set('codes');
      this.setup.set(null);
      await this.auth.patchUser({ mfaEnabled: true });
      this.mfa.set(await this.security.mfaStatus());
    });
  }

  cancelSetup(): void {
    this.setup.set(null);
    this.step.set('idle');
  }

  finishSetup(): void {
    this.recoveryCodes.set([]);
    this.step.set('idle');
  }

  async copySecret(): Promise<void> {
    const secret = this.setup()?.secret;

    if (secret) {
      await navigator.clipboard.writeText(secret);
      await this.feedback.toast('SECURITY.COPIED');
    }
  }

  async copyCodes(): Promise<void> {
    await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
    await this.feedback.toast('SECURITY.COPIED');
  }

  downloadCodes(): void {
    const blob = new Blob(
      [
        `${this.branding.name()} — ${this.auth.user()?.email ?? ''}\n\n${this.recoveryCodes().join('\n')}\n`,
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'social-network-codigos-de-recuperacion.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async regenerateCodes(): Promise<void> {
    await this.guard(async () => {
      const result = await this.reauth.run((reauth) =>
        this.security.regenerateRecoveryCodes(reauth),
      );

      if (result) {
        this.recoveryCodes.set(result.codes);
        this.step.set('codes');
        this.mfa.set(await this.security.mfaStatus());
      }
    });
  }

  async disable(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'SECURITY.DISABLE_TITLE',
      message: 'SECURITY.DISABLE_MESSAGE',
      confirmText: 'SECURITY.DISABLE',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await this.guard(async () => {
      const done = await this.reauth.run((reauth) => this.security.disableMfa(reauth));

      if (done !== null) {
        await this.auth.patchUser({ mfaEnabled: false });
        this.mfa.set(await this.security.mfaStatus());
        await this.feedback.toast('SECURITY.DISABLED', { color: 'success' });
      }
    });
  }

  async revokeTrusted(id?: string): Promise<void> {
    await this.guard(async () => {
      await this.security.revokeTrustedDevice(id);
      this.mfa.set(await this.security.mfaStatus());
    });
  }

  async setLoginAlerts(enabled: boolean): Promise<void> {
    this.loginAlerts.set(enabled);

    try {
      const permissions = await this.users.updatePermissions({ loginAlerts: enabled });
      await this.auth.patchUser({ permissions });
    } catch (error) {
      this.loginAlerts.set(!enabled);
      await this.feedback.error(error);
    }
  }

  // --- Sesiones -------------------------------------------------------------

  async revokeSession(session: DeviceSession): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'SECURITY.REVOKE_TITLE',
      message: 'SECURITY.REVOKE_MESSAGE',
      confirmText: 'SECURITY.REVOKE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(async () => {
        await this.security.revokeSession(session.id);
        this.sessions.update((items) => items.filter((item) => item.id !== session.id));
      });
    }
  }

  async revokeOthers(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'SECURITY.REVOKE_OTHERS',
      message: 'SECURITY.REVOKE_OTHERS_MESSAGE',
      confirmText: 'SECURITY.REVOKE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(async () => {
        await this.security.revokeOtherSessions();
        await this.loadSessions();
        await this.feedback.toast('SECURITY.OTHERS_REVOKED', { color: 'success' });
      });
    }
  }

  async moreEvents(): Promise<void> {
    await this.loadEvents(this.eventsPage() + 1);
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessions = await this.security.sessions();
      this.sessions.set(sessions.filter((session) => !session.revokedAt));
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private async loadEvents(page: number): Promise<void> {
    try {
      const result = await this.security.events(page, 15);
      this.events.update((items) => (page === 1 ? result.data : [...items, ...result.data]));
      this.eventsPage.set(page);
      this.hasMoreEvents.set(result.meta.hasNextPage);
    } catch {
      this.hasMoreEvents.set(false);
    }
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
