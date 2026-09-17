import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@respet/shared';

import { AppException } from '../errors.js';
import { requestOf } from '../execution-context.js';

export const IS_PUBLIC_KEY = 'respet:isPublic';
export const ROLES_KEY = 'respet:roles';
export const RATE_LIMIT_KEY = 'respet:rateLimit';
export const SCOPES_KEY = 'respet:scopes';

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

/**
 * Abre una operación a las aplicaciones de terceros que tengan esos permisos.
 *
 * Lo que no lo lleva sólo lo puede usar la propia aplicación: una operación
 * nueva no queda expuesta a terceros por olvido, igual que no queda abierta
 * sin sesión por olvidar `@Public()`. Ver `ScopesGuard`.
 */
export const Scopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(SCOPES_KEY, scopes);

export interface RateLimitOptions {
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Duración de la ventana, en segundos. */
  windowSeconds: number;
}

/** Límite de peticiones específico para una ruta sensible (login, registro…). */
export const RateLimit = (options: RateLimitOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Una aplicación de terceros que actúa en nombre de alguien. */
export interface ThirdPartyApp {
  /** Id interno de la aplicación. */
  id: string;
  clientId: string;
  /** Id del consentimiento del que cuelga el token. */
  grantId: string;
  scopes: string[];
}

/** Identidad del usuario autenticado, tal y como la deja `JwtStrategy`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  /** La sesión propia desde la que se opera. Nula con un token de terceros. */
  sessionId: string | null;
  /** La aplicación de terceros, si la petición viene de una. */
  app: ThirdPartyApp | null;
}

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

/**
 * Inyecta el usuario autenticado en un parámetro del resolutor.
 *
 * `@CurrentUser()` devuelve el objeto completo y `@CurrentUser('id')` sólo esa
 * propiedad, que es lo habitual.
 */
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

/** Quién pide y desde dónde: lo que se apunta en sesiones y registros de seguridad. */
export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export const Client = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = requestOf(context);
    const header = request.headers?.['user-agent'];

    return {
      ip: request.ip ?? null,
      userAgent: typeof header === 'string' ? header.slice(0, 500) : null,
    };
  },
);
