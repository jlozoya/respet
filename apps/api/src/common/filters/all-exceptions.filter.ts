import { Catch, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import type { ApiErrorBody } from '@social-network/shared';
import type { Request, Response } from 'express';

import { describeException } from '../error-description.js';

/**
 * Convierte en el mismo cuerpo JSON cualquier excepción de las rutas REST.
 *
 * Quedan pocas —las subidas de archivos, el aviso de PayPal y el enlace de
 * confirmación del correo—, pero siguen respondiendo con el formato de
 * siempre. Lo que entra por GraphQL se relanza tal cual: allí el error viaja
 * dentro de `errors[]` de la respuesta, y de darle forma se encarga
 * `formatError`, que usa esta misma descripción.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType<GqlContextType>() === 'graphql') {
      throw exception;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const { status, code, message, errors } = describeException(exception);

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} -> ${status} ${code}`);
    }

    const body: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }
}
