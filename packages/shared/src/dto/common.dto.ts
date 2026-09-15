/** Envoltorio de una respuesta paginada. Lo devuelven todos los listados. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Cuerpo de error de las rutas HTTP que quedan.
 *
 * Lo que entra por el esquema devuelve su error dentro de `errors[]`, con la
 * misma clave en `extensions.code`; esto es lo que sigue respondiendo la
 * subida de archivos, el aviso de PayPal y la confirmación del correo.
 */
export interface ApiErrorBody {
  statusCode: number;
  /** Clave i18n estable, p. ej. `SERVER.INCORRECT_CREDENTIALS`. */
  code: string;
  /** Mensaje legible en inglés, pensado para logs y depuración. */
  message: string;
  /** Errores de validación por campo, cuando aplican. */
  errors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}
