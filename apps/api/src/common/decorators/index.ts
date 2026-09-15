import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@respet/shared';

import { AppException } from '../errors.js';
import { requestOf } from '../execution-context.js';

export const IS_PUBLIC_KEY = 'respet:isPublic';
export const ROLES_KEY = 'respet:roles';
export const RATE_LIMIT_KEY = 'respet:rateLimit';

/** Marca una ruta como accesible sin sesión. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restringe una ruta a los roles indicados.
 *
 * Los roles son jerárquicos: `@Roles('supervisor')` deja pasar también a
 * `admin`. Ver `RolesGuard`.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export interface RateLimitOptions {
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Duración de la ventana, en segundos. */
  windowSeconds: number;
}

/** Límite de peticiones específico para una ruta sensible (login, registro…). */
export const RateLimit = (options: RateLimitOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Identidad del usuario autenticado, tal y como la deja `JwtStrategy`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Inyecta el usuario autenticado en un parámetro del controlador.
 *
 * `@CurrentUser()` devuelve el objeto completo y `@CurrentUser('id')` sólo esa
 * propiedad, que es lo habitual.
 */
/**
 * Usuario autenticado en una ruta pública, o `null` si no viene ninguno.
 *
 * `CurrentUser` da por hecho que hay sesión y protesta si falta, que es lo
 * correcto en una ruta protegida. Aquí la ausencia es un resultado válido: el
 * muro se puede leer sin cuenta, sólo que entonces no hay «te gusta» propio
 * que marcar.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | null =>
    requestOf(context).user ?? null,
);

export const CurrentUser = createParamDecorator(
  <K extends keyof AuthenticatedUser>(
    property: K | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[K] => {
    const user = requestOf(context).user;

    if (!user) {
      // Sólo ocurre si la ruta se marcó pública o se olvidó el guard: es un
      // error de programación, no algo que dependa de la petición.
      throw AppException.unauthorized('No authenticated user in request context');
    }

    return property ? user[property] : user;
  },
);
