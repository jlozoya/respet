import type { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from '@respet/shared';

/**
 * Un error del servidor, ya interpretado.
 *
 * `code` es una clave de traducción (`SERVER.INCORRECT_USER`), así que la
 * interfaz puede mostrarlo con `translate` sin mirar el código de estado.
 *
 * Los errores llegan por dos caminos. Los de GraphQL vienen dentro de la
 * respuesta, en `errors[]`, con un 200 por encima: el transporte funcionó, lo
 * que falló fue la operación. Los de transporte —sin red, un proxy que corta—
 * llegan como un error HTTP de toda la vida. Las dos formas acaban aquí para
 * que el resto de la aplicación no tenga que distinguirlas.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Cierto cuando el servidor no llegó a responder. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Cierto cuando hace falta una sesión y la que hay no vale. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Cierto si el servidor respondió con esta clave (`SERVER.REAUTH_REQUIRED`). */
  is(code: string): boolean {
    return this.code === code;
  }

  static from(response: HttpErrorResponse): ApiError {
    const body = response.error as Partial<ApiErrorBody> | string | null;

    if (response.status === 0) {
      return new ApiError(0, 'SERVER.NETWORK_ERROR', 'No se pudo contactar con el servidor');
    }

    if (body && typeof body === 'object' && typeof body.code === 'string') {
      return new ApiError(response.status, body.code, body.message ?? response.message, body.errors);
    }

    return new ApiError(response.status, 'SERVER.ERROR', response.message);
  }

  /**
   * El primero de los errores que devuelve una operación de GraphQL.
   *
   * Una respuesta puede traer varios —uno por campo que falló—, pero la
   * aplicación pide una cosa por consulta: enseñar el primero es enseñar el
   * que importa.
   */
  static fromGraphQL(errors: readonly GraphqlError[]): ApiError {
    const first = errors[0];
    const extensions = first?.extensions;

    return new ApiError(
      typeof extensions?.statusCode === 'number' ? extensions.statusCode : 500,
      typeof extensions?.code === 'string' ? extensions.code : 'SERVER.ERROR',
      first?.message ?? 'Unexpected error',
      extensions?.errors,
    );
  }
}

/** Un error tal y como lo devuelve el servidor dentro de `errors[]`. */
export interface GraphqlError {
  message: string;
  path?: (string | number)[];
  extensions?: {
    /** Clave i18n estable, la misma que llevaba el cuerpo de error de REST. */
    code?: string;
    statusCode?: number;
    errors?: Record<string, string[]>;
  };
}
