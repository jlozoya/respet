import { Injectable, NgZone, inject, signal } from '@angular/core';
import { createClient, type Client, type ExecutionResult } from 'graphql-ws';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError, type GraphqlError } from '../api/api-error';
import { operationNameOf, type Variables } from '../api/graphql-client.service';
import { AuthService } from '../auth/auth.service';

/** El servidor cierra con esto cuando la sesión deja de valer en otro sitio. */
const CLOSE_UNAUTHORIZED = 4401;
/** Y con esto cuando el token con el que se conectó ya no se acepta. */
const CLOSE_FORBIDDEN = 4403;

/** Una suscripción abierta, lista para volver a lanzarse si se rehace el cliente. */
interface ActiveSubscription {
  document: string;
  variables: Variables;
  next: (data: unknown) => void;
  error: (error: unknown) => void;
  dispose?: () => void;
}

/**
 * Las suscripciones de GraphQL: lo que llega sin pedirlo.
 *
 * Una sola conexión WebSocket con `graphql-ws` para todo —chat, avisos,
 * presencia y directos—, que se abre al iniciar sesión y se cierra al salir.
 * Sustituye al socket de Socket.IO, que hablaba un protocolo propio.
 *
 * Lo delicado es la sesión. El servidor autentica la conexión una vez, al
 * abrirla, así que:
 *
 * - Cada intento de conexión pide un token vigente, renovándolo si está a
 *   punto de caducar. Un reintento tras perder la red no se presenta con el
 *   token de hace una hora.
 * - Si el servidor cierra con 4401 —la sesión se cerró desde otro
 *   dispositivo, o se cambió la contraseña— `graphql-ws` lo da por fatal y no
 *   reintenta. Aquí se comprueba si la sesión sigue viva: si lo está, se rehace
 *   la conexión y se relanzan las suscripciones; si no, `AuthService` la cierra
 *   y la aplicación vuelve a la pantalla de acceso.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  private client: Client | null = null;
  private readonly active = new Set<ActiveSubscription>();
  private recovering = false;

  private readonly connectedSignal = signal(false);
  private readonly epochSignal = signal(0);

  /** Cierto mientras hay conexión con el servidor. */
  readonly connected = this.connectedSignal.asReadonly();

  /**
   * Sube cada vez que se (re)conecta.
   *
   * Lo que llegó mientras no había conexión se perdió: quien necesite ponerse
   * al día —el chat, sobre todo— lo vigila y pide lo que falta.
   */
  readonly epoch = this.epochSignal.asReadonly();

  /** Abre la conexión. Llamarla con la conexión ya abierta no hace nada. */
  start(): void {
    if (this.client) {
      return;
    }

    this.client = this.createClient();

    for (const subscription of this.active) {
      this.launch(subscription);
    }
  }

  /** Cierra la conexión, al salir de la cuenta. Las suscripciones se completan. */
  stop(): void {
    for (const subscription of this.active) {
      subscription.dispose?.();
    }

    this.active.clear();
    void this.client?.dispose();
    this.client = null;
    this.connectedSignal.set(false);
  }

  /**
   * Se suscribe a una operación.
   *
   * El observable sobrevive a las reconexiones: si la conexión se rehace, la
   * suscripción se relanza sola, y quien escucha no se entera.
   */
  subscribe<T>(document: string, variables: Variables = {}): Observable<T> {
    return new Observable<T>((observer) => {
      const subscription: ActiveSubscription = {
        document,
        variables,
        next: (data) => observer.next(data as T),
        error: (error) => observer.error(error),
      };

      this.active.add(subscription);

      if (this.client) {
        this.launch(subscription);
      }

      return () => {
        this.active.delete(subscription);
        subscription.dispose?.();
      };
    });
  }

  private launch(subscription: ActiveSubscription): void {
    if (!this.client) {
      return;
    }

    subscription.dispose?.();
    subscription.dispose = this.client.subscribe<unknown>(
      {
        query: subscription.document,
        variables: subscription.variables,
        operationName: operationNameOf(subscription.document),
      },
      {
        next: (result: ExecutionResult<unknown>) => {
          this.zone.run(() => {
            if (result.errors?.length) {
              subscription.error(ApiError.fromGraphQL(result.errors as unknown as GraphqlError[]));

              return;
            }

            if (result.data) {
              subscription.next(result.data);
            }
          });
        },
        error: (error: unknown) => {
          if (
            isCloseEvent(error) &&
            (error.code === CLOSE_UNAUTHORIZED || error.code === CLOSE_FORBIDDEN)
          ) {
            void this.recover();

            return;
          }

          if (Array.isArray(error)) {
            this.zone.run(() => subscription.error(ApiError.fromGraphQL(error as GraphqlError[])));
          }

          // Los demás cierres ya los reintenta `graphql-ws` por su cuenta; si
          // agota los intentos, se vuelve a probar en la siguiente reconexión.
        },
        complete: () => undefined,
      },
    );
  }

  /**
   * Rehace la conexión tras un cierre por sesión.
   *
   * Varias suscripciones reciben el mismo cierre a la vez; sólo la primera
   * pone en marcha la recuperación.
   */
  private async recover(): Promise<void> {
    if (this.recovering || !this.client) {
      return;
    }

    this.recovering = true;

    try {
      const token = await this.auth.refreshAccessToken();

      void this.client.dispose();
      this.client = null;
      this.connectedSignal.set(false);

      if (!token) {
        // La sesión está cerrada: `AuthService` ya la ha olvidado, y quien
        // vigila `isAuthenticated` para esta conexión se encargará del resto.
        return;
      }

      this.client = this.createClient();

      for (const subscription of this.active) {
        this.launch(subscription);
      }
    } finally {
      this.recovering = false;
    }
  }

  private createClient(): Client {
    return createClient({
      url: environment.graphqlUrl.replace(/^http/, 'ws'),
      lazy: false,
      keepAlive: 20_000,
      // Nunca se da por vencida mientras haya sesión: el móvil entra y sale de
      // cobertura constantemente, y cada vuelta debe reconectar sola.
      retryAttempts: Number.POSITIVE_INFINITY,
      shouldRetry: () => true,
      retryWait: async (retries) => {
        const seconds = Math.min(30, 2 ** retries);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + Math.random() * 1000));
      },
      connectionParams: async () => {
        const token = await this.auth.freshAccessToken();

        return token ? { authorization: `Bearer ${token}` } : {};
      },
      on: {
        connected: () => {
          this.zone.run(() => {
            this.connectedSignal.set(true);
            this.epochSignal.update((value) => value + 1);
          });
        },
        closed: () => {
          this.zone.run(() => this.connectedSignal.set(false));
        },
      },
      onNonLazyError: (error) => {
        if (
          isCloseEvent(error) &&
          (error.code === CLOSE_UNAUTHORIZED || error.code === CLOSE_FORBIDDEN)
        ) {
          void this.recover();
        }
      },
    });
  }
}

function isCloseEvent(value: unknown): value is { code: number; reason: string } {
  return (
    typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'number'
  );
}
