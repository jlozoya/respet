import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, SCOPES_KEY } from '../decorators/index.js';
import { AppException, ErrorCode } from '../errors.js';
import { requestOf } from '../execution-context.js';

/**
 * Lo que una aplicación de terceros puede hacer con su token.
 *
 * La propia aplicación de Respet no tiene permisos: puede hacerlo todo lo que
 * su rol le deje. Una aplicación de terceros sólo puede usar las operaciones
 * marcadas con `@Scopes(...)` y sólo si la persona le concedió esos permisos.
 * Lo que no está marcado le queda cerrado, de modo que añadir una operación
 * nueva no la expone por descuido.
 *
 * Las operaciones públicas —las que se pueden usar sin sesión— quedan abiertas
 * también a las aplicaciones: lo que cualquiera puede leer sin cuenta no
 * necesita permiso.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const app = requestOf(context).user?.app;

    if (!app) {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<string[] | undefined>(SCOPES_KEY, targets);

    if (!required) {
      if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
        return true;
      }

      throw new AppException(
        ErrorCode.InsufficientScope,
        HttpStatus.FORBIDDEN,
        'This operation is not available to third-party apps',
      );
    }

    const missing = required.filter((scope) => !app.scopes.includes(scope));

    if (missing.length > 0) {
      throw new AppException(
        ErrorCode.InsufficientScope,
        HttpStatus.FORBIDDEN,
        `The app lacks the permissions: ${missing.join(', ')}`,
        { scopes: missing },
      );
    }

    return true;
  }
}
