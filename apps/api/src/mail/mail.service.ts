import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

import {
  paymentConfirmationMail,
  resetPasswordMail,
  resolveLang,
  supportConfirmationMail,
  supportNotificationMail,
  verifyEmailMail,
  type RenderedMail,
} from './templates/index.js';

/**
 * Envío de correo transaccional.
 *
 * Con `MAIL_ENABLED=false` no se abre ninguna conexión SMTP: el mensaje se
 * escribe en el registro. Así el entorno de desarrollo funciona sin credenciales
 * y los enlaces de confirmación siguen siendo visibles en la consola.
 *
 * Los envíos nunca hacen fallar la operación que los provocó: si el servidor de
 * correo está caído, el usuario debe quedar registrado igualmente.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendVerifyEmail(to: string, name: string, url: string, lang: string): Promise<void> {
    await this.send(to, verifyEmailMail({ name, url, lang: resolveLang(lang) }));
  }

  async sendPasswordReset(to: string, name: string, url: string, lang: string): Promise<void> {
    await this.send(to, resetPasswordMail({ name, url, lang: resolveLang(lang) }));
  }

  async sendSupportConfirmation(to: string, name: string, lang: string): Promise<void> {
    await this.send(to, supportConfirmationMail({ name, lang: resolveLang(lang) }));
  }

  /** Avisa al buzón de soporte. No hace nada si `SUPPORT_MAIL` está vacío. */
  async sendSupportNotification(params: {
    name: string;
    email: string;
    phone: string | null;
    message: string;
  }): Promise<void> {
    const inbox = this.config.get<string>('mail.supportMail');

    if (!inbox) {
      return;
    }

    await this.send(inbox, supportNotificationMail(params), params.email);
  }

  async sendPaymentConfirmation(
    to: string,
    params: { name: string; orderId: string; total: string; lang: string },
  ): Promise<void> {
    await this.send(
      to,
      paymentConfirmationMail({ ...params, lang: resolveLang(params.lang) }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
  }

  private async send(to: string, mail: RenderedMail, replyTo?: string): Promise<void> {
    if (!this.config.get<boolean>('mail.enabled')) {
      this.logger.log(`[correo simulado] para=${to} asunto="${mail.subject}"\n${mail.text}`);

      return;
    }

    try {
      await this.getTransporter().sendMail({
        from: this.config.getOrThrow<string>('mail.from'),
        to,
        replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo "${mail.subject}" a ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private getTransporter(): Transporter {
    this.transporter ??= createTransport({
      host: this.config.getOrThrow<string>('mail.host'),
      port: this.config.getOrThrow<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure') ?? false,
      auth: this.authOptions(),
      pool: true,
      maxConnections: 3,
    });

    return this.transporter;
  }

  private authOptions(): { user: string; pass: string } | undefined {
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.password');

    return user && pass ? { user, pass } : undefined;
  }
}
