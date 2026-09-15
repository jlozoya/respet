import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import type { Request, Response } from 'express';

import type { AuthenticatedUser } from './decorators/index.js';

/** Lo que hay debajo de una operación, venga de GraphQL o de una ruta REST. */
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * La petición HTTP, sea cual sea la puerta por la que entró.
 *
 * Casi todo pasa ahora por `/graphql`, pero siguen existiendo unas pocas rutas
 * REST —las subidas de archivos, el aviso de PayPal, el enlace de confirmación
 * del correo—. Los guards y los decoradores de parámetro son los mismos para
 * ambas, así que necesitan una forma única de llegar a la petición: en GraphQL
 * `switchToHttp()` devuelve un objeto vacío, y leer de ahí dejaba al usuario
 * autenticado sin aparecer por ninguna parte.
 */
export function requestOf(context: ExecutionContext): RequestWithUser {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: RequestWithUser }>().req;
  }

  return context.switchToHttp().getRequest<RequestWithUser>();
}

/** La respuesta HTTP, para las cabeceras que se escriben a mano. */
export function responseOf(context: ExecutionContext): Response {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ res: Response }>().res;
  }

  return context.switchToHttp().getResponse<Response>();
}
