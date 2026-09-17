import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';
import type { Request, Response } from 'express';

import type { AuthenticatedUser } from './decorators/index.js';

/** Lo que hay debajo de una operación, venga de GraphQL o de una ruta HTTP. */
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/** El contexto de GraphQL tal y como lo construye `GraphqlApiModule`. */
export interface GraphqlContext {
  req: RequestWithUser;
  /** Ausente en las operaciones que llegan por WebSocket. */
  res?: Response;
}

/**
 * La petición HTTP, sea cual sea la puerta por la que entró.
 *
 * Casi todo pasa por `/graphql`, pero siguen existiendo unas pocas rutas HTTP
 * —el aviso de PayPal, los extremos estándar de OAuth, `/health`—. Los guards
 * y los decoradores de parámetro son los mismos para todas, así que necesitan
 * una forma única de llegar a la petición: en GraphQL `switchToHttp()`
 * devuelve un objeto vacío, y leer de ahí dejaba al usuario autenticado sin
 * aparecer por ninguna parte.
 *
 * En una suscripción no hay petición HTTP: el contexto trae una construida al
 * abrir la conexión, con el usuario ya autenticado.
 */
export function requestOf(context: ExecutionContext): RequestWithUser {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<GraphqlContext>().req;
  }

  return context.switchToHttp().getRequest<RequestWithUser>();
}

/** La respuesta HTTP, para las cabeceras que se escriben a mano. Nula por WebSocket. */
export function responseOf(context: ExecutionContext): Response | null {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<GraphqlContext>().res ?? null;
  }

  return context.switchToHttp().getResponse<Response>();
}
