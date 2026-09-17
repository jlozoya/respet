import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AccessTokenVerifierService } from '../../auth/access-token-verifier.service.js';
import { IS_PUBLIC_KEY } from '../decorators/index.js';
import { AppException } from '../errors.js';
import { requestOf, type RequestWithUser } from '../execution-context.js';

/**
 * Guard global de autenticación.
 *
 * Se aplica a todas las operaciones; las que no requieren sesión se marcan
 * con `@Public()`. Es más seguro que el enfoque contrario, en el que olvidar
 * el guard deja una operación abierta sin que nadie se dé cuenta.
 *
 * Ya no pasa por Passport. La estrategia JWT sólo sabía comprobar la firma, y
 * ahora hace falta más —que la sesión siga abierta, que la aplicación de
 * terceros conserve el acceso—, así que la verificación vive en
 * `AccessTokenVerifierService`, que es la misma que usan las suscripciones.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = requestOf(context);

    // Las operaciones que llegan por WebSocket ya traen a su usuario: se
    // autenticó una vez, al abrir la conexión.
    if (request.user) {
      return true;
    }

    const token = bearerTokenOf(request);

    if (token) {
      const user = await this.verifier.verify(token);

      if (user) {
        request.user = user;

        return true;
      }

      // Una operación pública con un token caducado o inválido sigue siendo
      // pública: se atiende sin usuario. Hay respuestas que dependen de quién
      // mira —si una publicación te gusta—, pero ninguna exige saberlo.
      if (!isPublic) {
        throw AppException.unauthorized('Missing or invalid access token');
      }
    }

    if (!isPublic) {
      throw AppException.unauthorized('Missing or invalid access token');
    }

    return true;
  }
}

export function bearerTokenOf(request: Pick<RequestWithUser, 'headers'>): string | null {
  const header = request.headers?.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();

  return token.length > 0 ? token : null;
}
