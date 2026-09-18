import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_HIERARCHY, type UserRole } from '@social-network/shared';

import { ROLES_KEY } from '../decorators/index.js';
import { AppException } from '../errors.js';
import { requestOf } from '../execution-context.js';

/**
 * Comprueba el rol del usuario contra el que exige la ruta.
 *
 * Los roles son acumulativos según `ROLE_HIERARCHY`: quien es `admin` cumple
 * también lo que se le pide a un `supervisor`. Así evitamos tener que repetir
 * `@Roles('supervisor', 'admin')` en cada ruta, como ocurría con el middleware
 * `hasRole` del backend anterior.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const role = requestOf(context).user?.role;

    if (!role) {
      throw AppException.unauthorized('Missing or invalid access token');
    }

    const minimumRank = Math.min(...required.map((candidate) => rankOf(candidate)));

    if (rankOf(role) < minimumRank) {
      throw AppException.forbidden(`Role "${role}" cannot access this resource`);
    }

    return true;
  }
}

function rankOf(role: UserRole): number {
  const rank = ROLE_HIERARCHY.indexOf(role);

  // Un rol desconocido no debe colarse por debajo del mínimo exigido.
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}
