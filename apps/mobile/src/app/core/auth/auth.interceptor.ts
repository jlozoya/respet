import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { type Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import type { GraphqlError } from '../api/api-error';
import { environment } from '../../../environments/environment';
import { AuthService, PUBLIC_OPERATIONS } from './auth.service';

/**
 * Añade el token de acceso y renueva la sesión cuando caduca.
 *
 * Ante una respuesta que dice «hace falta sesión» pide un token nuevo y repite
 * la petición una sola vez. Al ser un access token de vida corta (quince
 * minutos), esto ocurre con normalidad mientras se usa la aplicación y debe
 * resultar invisible: sin este reintento, la sesión parecería cerrarse sola
 * cada cuarto de hora.
 *
 * Con GraphQL hay que mirar en dos sitios. Las subidas de archivos siguen
 * respondiendo 401, como antes; una operación del esquema, en cambio, responde
 * 200 con el fallo dentro de `errors[]`, porque el transporte funcionó: lo que
 * no valía era el token.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  if (!isApiRequest(request.url)) {
    return next(request);
  }

  return from(auth.accessToken()).pipe(
    switchMap((token) => next(withToken(request, token))),
    switchMap((event) => {
      if (event instanceof HttpResponse && isExpiredSession(event) && !isPublicOperation(request)) {
        // Si la renovación falla, se deja pasar la respuesta original: ya
        // trae el error que la pantalla necesita enseñar.
        return retryWithFreshToken(request, next, auth, () => of(event));
      }

      return of(event);
    }),
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return retryWithFreshToken(request, next, auth, () =>
        // `refreshAccessToken` ya ha cerrado la sesión; se propaga el 401 para
        // que el guard de rutas lleve al inicio de sesión.
        throwError(
          () => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', url: request.url }),
        ),
      );
    }),
  );
};

function retryWithFreshToken(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  onFailure: () => Observable<HttpEvent<unknown>>,
): Observable<HttpEvent<unknown>> {
  return from(auth.refreshAccessToken()).pipe(
    switchMap((token) => (token ? next(withToken(request, token)) : onFailure())),
  );
}

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) {
    return request;
  }

  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isApiRequest(url: string): boolean {
  // El token sólo viaja a nuestro servidor: mandarlo a Google Maps o a
  // cualquier otro servicio sería filtrarlo.
  return url.startsWith(environment.apiUrl) || url.startsWith(environment.graphqlUrl);
}

/** Cierto si la respuesta de una operación se quejó de la sesión. */
function isExpiredSession(response: HttpResponse<unknown>): boolean {
  const body = response.body as { errors?: GraphqlError[] } | null;

  return (
    body?.errors?.some((error) => error.extensions?.statusCode === 401) === true
  );
}

/**
 * Cierto para las operaciones que no dependen de la sesión.
 *
 * Entrar, darse de alta o renovar el token fallan por lo que fallan —una
 * contraseña equivocada, un refresh token ya usado—, y reintentarlas con un
 * token nuevo no arreglaría nada: sólo gastaría otra renovación.
 */
function isPublicOperation(request: HttpRequest<unknown>): boolean {
  const body = request.body as { operationName?: unknown } | null;

  return typeof body?.operationName === 'string' && PUBLIC_OPERATIONS.includes(body.operationName);
}
