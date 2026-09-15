import { HttpException, HttpStatus } from '@nestjs/common';

import { MongooseError } from '../database/mongoose.js';
import { AppException, ErrorCode } from './errors.js';

/**
 * Un error, ya traducido a lo que la aplicación necesita saber.
 *
 * La app sólo mira `code` para decidir qué mensaje enseña, así que conviene
 * que todos los errores tengan la misma forma vengan de una validación, de la
 * base de datos o de un fallo inesperado. Antes esto vivía dentro del filtro de
 * excepciones; ahora lo comparten el filtro —que responde a las pocas rutas
 * REST que quedan— y `formatError` del esquema de GraphQL, por donde pasa el
 * resto.
 */
export interface ErrorDescription {
  status: number;
  /** Clave i18n estable, p. ej. `SERVER.INCORRECT_USER`. */
  code: string;
  /** Mensaje legible en inglés, pensado para registros y depuración. */
  message: string;
  /** Errores de validación por campo, cuando aplican. */
  errors?: Record<string, string[]>;
}

export function describeException(exception: unknown): ErrorDescription {
  if (exception instanceof AppException) {
    const payload = exception.getResponse() as {
      message: string;
      errors?: Record<string, string[]>;
    };

    return {
      status: exception.getStatus(),
      code: exception.code,
      message: payload.message,
      errors: payload.errors,
    };
  }

  if (exception instanceof HttpException) {
    return describeHttpException(exception);
  }

  if (isDatabaseError(exception)) {
    return describeDatabaseError(exception);
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.Error,
    message: exception instanceof Error ? exception.message : 'Unexpected error',
  };
}

function describeHttpException(exception: HttpException): ErrorDescription {
  const status = exception.getStatus();
  const payload = exception.getResponse();

  // `ValidationPipe` responde con `{ message: string[] }`; lo agrupamos por
  // campo para que el formulario pueda señalar el control equivocado.
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const raw = (payload).message;

    if (Array.isArray(raw)) {
      return {
        status,
        code: ErrorCode.ValidationFailed,
        message: 'Validation failed',
        errors: groupValidationMessages(raw.map(String)),
      };
    }
  }

  return {
    status,
    code: statusToCode(status),
    message: typeof payload === 'string' ? payload : exception.message,
  };
}

/**
 * Traduce los fallos que vienen de la base.
 *
 * Con Prisma llegaban con un código P2002 y compañía; Mongo usa los suyos,
 * pero la intención es la misma: distinguir lo que es culpa de quien llama
 * —una clave repetida— de lo que no lo es —la base caída—, en lugar de
 * responder 500 a todo.
 */
function describeDatabaseError(exception: DatabaseError): ErrorDescription {
  if (
    exception.name === 'MongoNetworkError' ||
    exception.name === 'MongooseServerSelectionError' ||
    /server selection|connection .* closed|topology/i.test(exception.message)
  ) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: ErrorCode.DatabaseUnavailable,
      message: 'The database is unreachable',
    };
  }

  // 11000 es la clave duplicada: el equivalente del P2002 de Prisma.
  if (exception.code === 11000) {
    return {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.Conflict,
      message: `Unique constraint failed on ${fieldsOf(exception)}`,
    };
  }

  if (exception.name === 'ValidationError' || exception.name === 'CastError') {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.ValidationFailed,
      message: 'The request does not match the expected shape',
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.Error,
    message:
      exception.code === undefined ? 'Database error' : `Database error ${exception.code}`,
  };
}

/**
 * Lo que hace falta saber de un error de base de datos.
 *
 * El driver de Mongo y Mongoose lanzan tipos distintos sin un ancestro común
 * útil, así que se describen por su forma en lugar de por su clase.
 */
interface DatabaseError {
  name: string;
  message: string;
  code?: number | string;
  keyPattern?: Record<string, unknown>;
}

function isDatabaseError(exception: unknown): exception is DatabaseError {
  if (exception instanceof MongooseError) {
    return true;
  }

  return (
    exception instanceof Error && (exception.name.startsWith('Mongo') || 'keyPattern' in exception)
  );
}

/** Los campos del índice que se ha violado, para decir cuál falló. */
function fieldsOf(exception: DatabaseError): string {
  const campos = Object.keys(exception.keyPattern ?? {});

  return campos.length > 0 ? campos.join(', ') : 'unknown field';
}

function groupValidationMessages(messages: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const message of messages) {
    const field = message.split(' ')[0] ?? '_';
    (grouped[field] ??= []).push(message);
  }

  return grouped;
}

function statusToCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.Unauthorized;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.NotEnoughRights;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NotFound;
    case HttpStatus.CONFLICT:
      return ErrorCode.Conflict;
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return ErrorCode.FileTooLarge;
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return ErrorCode.UnsupportedMedia;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ErrorCode.TooManyRequests;
    default:
      return ErrorCode.Error;
  }
}
