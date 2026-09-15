import { Injectable, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Conexión en tiempo real con el servidor.
 *
 * Envuelve Socket.IO para tres cosas: adjuntar el token de la sesión, exponer
 * los eventos como observables —que es como los consume Angular— y reconectar
 * con el token nuevo cuando la sesión se renueva, cosa que ocurre cada quince
 * minutos y dejaría el socket colgado si no se hiciera.
 *
 * El socket es un canal de avisos, no la fuente de la verdad: los datos se
 * piden y se guardan por REST. Si la conexión se cae, la aplicación sigue
 * funcionando y sólo se pierde la inmediatez.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);

  private socket?: Socket;

  readonly connected = signal(false);

  /** Abre la conexión, o la reutiliza si ya estaba abierta. */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const token = await this.auth.accessToken();

    if (!token) {
      return;
    }

    this.socket?.disconnect();

    this.socket = io(`${namespaceUrl(environment.apiUrl)}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      // Se reintenta con espera creciente para no castigar a un servidor que
      // acaba de caerse ni gastar batería en una red intermitente.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      autoConnect: true,
    });

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));

    // Un fallo de conexión suele ser un token caducado: se pide uno nuevo y se
    // vuelve a intentar una vez.
    this.socket.on('connect_error', () => {
      this.connected.set(false);
      void this.refreshAndRetry();
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.connected.set(false);
  }

  /** Escucha un evento del servidor mientras haya suscriptores. */
  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (payload: T): void => subscriber.next(payload);

      this.socket?.on(event, handler);

      return () => {
        this.socket?.off(event, handler);
      };
    });
  }

  emit(event: string, payload: unknown): void {
    this.socket?.emit(event, payload);
  }

  private async refreshAndRetry(): Promise<void> {
    const token = await this.auth.refreshAccessToken();

    if (!token || !this.socket) {
      return;
    }

    this.socket.auth = { token };
    this.socket.connect();
  }
}

/**
 * Convierte la URL de la API en la del servidor de sockets.
 *
 * `environment.apiUrl` incluye el prefijo `/api`, que no forma parte del
 * espacio de nombres del socket.
 */
function namespaceUrl(apiUrl: string): string {
  return apiUrl.replace(/\/api\/?$/, '');
}
