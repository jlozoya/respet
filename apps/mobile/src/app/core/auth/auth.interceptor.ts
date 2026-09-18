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

import { environment } from '../../../environments/environment';
import type { GraphqlError } from '../api/api-error';
import { AuthService, PUBLIC_OPERATIONS } from './auth.service';

/**
 * Añade el token de acceso y renueva la sesión cuando caduca.
 *
 * Ante una respuesta que dice «hace falta sesión» pide un token nuevo y repite
 * la petición una sola vez. El token de acceso vive quince minutos, así que
 * esto ocurre con normalidad mientras se usa la aplicación y debe resultar
 * invisible: sin el reintento, la sesión parecería cerrarse sola cada cuarto de
 * hora.
 *
 * Con GraphQL hay que mirar en dos sitios: una operación responde 200 con el
 * fallo dentro de `errors[]`, porque el transporte funcionó y lo que no valía
 * era el token; y un proxy o el propio servidor pueden cortar antes con un 401
 * de toda la vida.
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
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isPublicOperation(request)
      ) {
        return throwError(() => error);
      }

      return retryWithFreshToken(request, next, auth, () => throwError(() => error));
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
    switchMap((token) => {
      if (token) {
        return next(withToken(request, token));
      }

      // La sesión ya no vale y `refreshAccessToken` la ha olvidado: se lleva
      // a la pantalla de acceso en lugar de dejar una interfaz a medias.
      if (!auth.isAuthenticated()) {
        void auth.forgetSession();
      }

      return onFailure();
    }),
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

  return body?.errors?.some((error) => error.extensions?.statusCode === 401) === true;
}

/** Cierto para las operaciones que no dependen de la sesión. */
function isPublicOperation(request: HttpRequest<unknown>): boolean {
  const body = request.body as { operationName?: unknown } | null;

  return typeof body?.operationName === 'string' && PUBLIC_OPERATIONS.includes(body.operationName);
}
