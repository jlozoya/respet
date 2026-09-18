import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ReauthRequest } from '@social-network/shared';

import type { AuthenticatedUser, ClientInfo } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import type { Model } from '../database/mongoose.js';
import { User } from '../database/schemas/user.schema.js';
import { MfaService } from './mfa/mfa.service.js';
import { PasswordService } from './password.service.js';
import { LoginThrottleService } from './security/login-throttle.service.js';
import { SessionService } from './session/session.service.js';

/** Cuánto vale haber iniciado sesión como prueba de identidad, en cuentas sin contraseña ni 2FA. */
const RECENT_LOGIN_MS = 15 * 60 * 1000;

/**
 * Volver a confirmar la identidad antes de algo delicado.
 *
 * Activar o quitar el segundo factor, cambiar el correo o borrar la cuenta no
 * deben poder hacerse con sólo un móvil desbloqueado encima de una mesa. Se
 * pide la contraseña; si la cuenta no tiene —se creó con Google—, el código de
 * la app de autenticación; y si tampoco tiene segundo factor, que la sesión se
 * haya abierto hace menos de un cuarto de hora.
 */
@Injectable()
export class ReauthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async assert(actor: AuthenticatedUser, input: ReauthRequest | undefined, client: ClientInfo): Promise<void> {
    const user = await this.users.findById(actor.id).select('passwordHash mfaEnabled').lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (user.passwordHash && input?.password) {
      const key = `reauth:${actor.id}`;

      await this.throttle.assertNotLocked(key);

      if (await this.passwords.verify(user.passwordHash, input.password)) {
        await this.throttle.reset(key);

        return;
      }

      await this.throttle.registerFailure(key);
      throw reauthRequired('The password is not correct');
    }

    if (user.mfaEnabled && input?.code) {
      await this.mfa.verifyCode(actor.id, input.code, client);

      return;
    }

    if (!user.passwordHash && !user.mfaEnabled && actor.sessionId) {
      const startedAt = await this.sessions.startedAt(actor.sessionId);

      if (startedAt && Date.now() - startedAt.getTime() < RECENT_LOGIN_MS) {
        return;
      }
    }

    throw reauthRequired(
      user.passwordHash
        ? 'Confirm your password to continue'
        : user.mfaEnabled
          ? 'Enter your two-factor code to continue'
          : 'Sign in again to continue',
    );
  }
}

function reauthRequired(message: string): AppException {
  // 403 y no 401: el token vale, lo que falta es la confirmación. Con un 401
  // la aplicación intentaría renovar la sesión, que no arregla nada.
  return new AppException(ErrorCode.ReauthRequired, HttpStatus.FORBIDDEN, message);
}
