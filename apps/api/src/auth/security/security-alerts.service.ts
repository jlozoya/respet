import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type { ClientInfo } from '../../common/decorators/index.js';
import type { Model } from '../../database/mongoose.js';
import { User, UserPermissions } from '../../database/schemas/user.schema.js';
import { MailService } from '../../mail/mail.service.js';
import type { SecurityAlertKind } from '../../mail/templates/index.js';
import { parseUserAgent } from '../session/device.js';

/**
 * Los correos que avisan de cambios en la seguridad de una cuenta.
 *
 * Todos se mandan salvo el de «nuevo inicio de sesión», que se puede apagar en
 * la privacidad: avisar de que alguien cambió tu contraseña no es opcional.
 */
@Injectable()
export class SecurityAlertsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    private readonly mail: MailService,
  ) {}

  async send(
    userId: string,
    kind: SecurityAlertKind,
    client: Partial<ClientInfo> = {},
    extraDetails: string[] = [],
  ): Promise<void> {
    const user = await this.users.findById(userId).select('email name lang').lean();

    if (!user) {
      return;
    }

    if (kind === 'new_login') {
      const prefs = await this.permissions.findOne({ userId }).select('loginAlerts').lean();

      if (prefs?.loginAlerts === false) {
        return;
      }
    }

    const details = [...extraDetails];

    if (client.userAgent) {
      details.push(parseUserAgent(client.userAgent).name);
    }

    if (client.ip) {
      details.push(`IP ${client.ip}`);
    }

    details.push(new Date().toUTCString());

    await this.mail.sendSecurityAlert(user.email, {
      name: user.name,
      lang: user.lang,
      kind,
      details,
    });
  }
}
