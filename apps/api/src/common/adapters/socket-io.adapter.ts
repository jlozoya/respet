import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Adaptador de Socket.IO con la política de CORS de la aplicación.
 *
 * El decorador `@WebSocketGateway` sólo admite valores fijos, así que la lista
 * de orígenes —que vive en la configuración— hay que aplicarla aquí. Dejarla
 * abierta sería más permisivo que la API REST sin motivo: aunque el handshake
 * exige un token válido y una página ajena no lo tiene, no hay razón para
 * conceder más de lo necesario.
 */
export class ConfiguredIoAdapter extends IoAdapter {
  private readonly origins: string[];

  constructor(app: INestApplicationContext) {
    super(app);

    this.origins = app.get(ConfigService).getOrThrow<string[]>('corsOrigins');
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // `ServerOptions` exige todas sus propiedades, así que se compone sobre lo
    // que recibe y se afirma el tipo en la llamada.
    const merged = {
      ...options,
      cors: { origin: this.origins, credentials: false },
    } as ServerOptions;

    return super.createIOServer(port, merged) as Server;
  }
}
