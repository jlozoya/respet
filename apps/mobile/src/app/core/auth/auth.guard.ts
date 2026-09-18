import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { UserRole } from '@social-network/shared';

import { AuthService } from './auth.service';

/**
 * Exige una sesión abierta.
 *
 * Guarda la ruta pedida en `redirectTo` para volver a ella tras iniciar
 * sesión, en lugar de dejar siempre al usuario en la pantalla de inicio.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
};

/**
 * Exige un rol mínimo, según la jerarquía compartida con el servidor.
 *
 * Es sólo una comodidad para la navegación: quien intente saltárselo se
 * encontrará igualmente con el 403 del servidor, que es quien manda.
 */
export function roleGuard(minimum: UserRole): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { redirectTo: state.url } });
    }

    return auth.hasRole(minimum) ? true : router.createUrlTree(['/error'], {
      queryParams: { reason: 'forbidden' },
    });
  };
}

/** Impide volver al inicio de sesión con la sesión ya abierta. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
