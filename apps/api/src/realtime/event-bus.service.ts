import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';

import { createAsyncQueue } from './async-queue.js';

type Handler = (payload: unknown, topic: string) => void;

/**
 * Bus de eventos del servidor.
 *
 * Por aquí pasa todo lo que ocurre en vivo: un mensaje nuevo, alguien que
 * escribe, una reacción en un directo, una sesión cerrada desde otro
 * dispositivo. Lo publica el servicio que hace el cambio —siempre después de
 * guardarlo— y lo recogen las suscripciones de GraphQL y quien más escuche.
 *
 * Tiene dos motores y el resto del código no distingue cuál está activo:
 *
 * - **En memoria**, sin configurar nada. Vale mientras haya una sola
 *   instancia de la API: cada proceso sólo conoce a sus propios clientes.
 * - **Redis**, con `REDIS_URL`. Cada publicación sale hacia Redis y vuelve a
 *   todas las instancias, así que da igual a cuál esté conectado quien la
 *   recibe.
 *
 * Con Redis el evento no se entrega localmente al publicarlo, sino al volver
 * de Redis: de lo contrario la instancia que publica lo entregaría dos veces.
 */
@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly local = new EventEmitter();
  private readonly publisher?: Redis;
  private readonly subscriber?: Redis;
  /** Cuántos oyentes locales tiene cada tema, para no suscribirse a Redis de más. */
  private readonly topicRefs = new Map<string, number>();

  constructor(config: ConfigService) {
    // Cada conexión de GraphQL añade sus oyentes; el aviso de «posible fuga»
    // que da Node pasadas diez no tiene sentido aquí.
    this.local.setMaxListeners(0);

    const url = config.get<string>('redis.url');

    if (!url) {
      return;
    }

    this.publisher = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.subscriber = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });

    this.subscriber.on('message', (topic: string, raw: string) => {
      this.deliver(topic, raw);
    });

    for (const connection of [this.publisher, this.subscriber]) {
      connection.on('error', (error: Error) => {
        this.logger.warn(`Redis: ${error.message}`);
      });
    }

    this.logger.log('Eventos en tiempo real repartidos por Redis');
  }

  /** Cierto cuando los eventos viajan entre instancias. */
  get distributed(): boolean {
    return this.publisher !== undefined;
  }

  /** Publica un evento. Nunca falla: un aviso perdido no debe tumbar la escritura que lo originó. */
  async publish(topic: string, payload: unknown): Promise<void> {
    if (!this.publisher) {
      this.local.emit(topic, payload, topic);

      return;
    }

    try {
      await this.publisher.publish(topic, JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(`No se pudo publicar en "${topic}": ${describe(error)}`);
    }
  }

  /**
   * Escucha uno o varios temas desde el propio servidor.
   *
   * Devuelve la función que deja de escuchar.
   */
  on<T>(topics: string | string[], handler: (payload: T, topic: string) => void): () => void {
    const list = Array.isArray(topics) ? topics : [topics];
    const wrapped: Handler = (payload, topic) => handler(payload as T, topic);

    for (const topic of list) {
      this.local.on(topic, wrapped);
      this.retain(topic);
    }

    return () => {
      for (const topic of list) {
        this.local.off(topic, wrapped);
        this.release(topic);
      }
    };
  }

  /**
   * Los eventos de esos temas como iterador, que es lo que devuelve una
   * suscripción de GraphQL.
   *
   * `filter` descarta lo que no le corresponde a quien escucha —los mensajes
   * de una conversación ajena, por ejemplo— antes de encolarlo.
   */
  subscribe<T>(
    topics: string | string[],
    filter?: (payload: T, topic: string) => boolean,
  ): AsyncIterableIterator<T> {
    let stop: () => void = () => undefined;

    const queue = createAsyncQueue<T>(() => stop());

    stop = this.on<T>(topics, (payload, topic) => {
      if (!filter || filter(payload, topic)) {
        queue.push(payload);
      }
    });

    return queue;
  }

  async onModuleDestroy(): Promise<void> {
    this.local.removeAllListeners();
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
  }

  private deliver(topic: string, raw: string): void {
    try {
      this.local.emit(topic, JSON.parse(raw) as unknown, topic);
    } catch (error) {
      this.logger.warn(`Evento ilegible en "${topic}": ${describe(error)}`);
    }
  }

  private retain(topic: string): void {
    const count = this.topicRefs.get(topic) ?? 0;
    this.topicRefs.set(topic, count + 1);

    if (count === 0 && this.subscriber) {
      void this.subscriber.subscribe(topic).catch((error: unknown) => {
        this.logger.warn(`No se pudo escuchar "${topic}": ${describe(error)}`);
      });
    }
  }

  private release(topic: string): void {
    const count = (this.topicRefs.get(topic) ?? 1) - 1;

    if (count > 0) {
      this.topicRefs.set(topic, count);

      return;
    }

    this.topicRefs.delete(topic);

    if (this.subscriber) {
      void this.subscriber.unsubscribe(topic).catch(() => undefined);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
