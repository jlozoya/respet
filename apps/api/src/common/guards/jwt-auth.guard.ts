import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/index.js';
import { AppException } from '../errors.js';
import { requestOf } from '../execution-context.js';

/**
 * Guard global de autenticación.
 *
 * Se aplica a todas las rutas; las que no requieren sesión se marcan con
 * `@Public()`. Es más seguro que el enfoque contrario, en el que olvidar el
 * guard deja una ruta abierta sin que nadie se dé cuenta.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    // Una ruta pública que además recibe un token identifica a quien lo manda,
    // porque hay respuestas que dependen de quién mira: si una publicación te
    // gusta, o si el muro debe limitarse a quienes sigues. Un token caducado o
    // inválido no cierra el paso —la ruta es pública—, simplemente deja la
    // petición sin usuario.
    const request = requestOf(context);

    if (typeof request.headers['authorization'] === 'string') {
      try {
        await super.canActivate(context);
      } catch {
        // Sin identificar, pero adelante.
      }
    }

    return true;
  }

  /**
   * De dónde saca Passport la petición.
   *
   * La suya la busca en el contexto HTTP, que en una operación de GraphQL está
   * vacío: sin esto, ninguna consulta llegaría autenticada.
   */
  override getRequest(context: ExecutionContext): unknown {
    return requestOf(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw AppException.unauthorized('Missing or invalid access token');
    }

    return user;
  }
}
