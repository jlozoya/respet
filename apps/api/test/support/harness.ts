import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createClient, type Client } from 'graphql-ws';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import mongoose from 'mongoose';
import { WebSocket } from 'ws';

/**
 * La API levantada de verdad, contra una base de prueba, para las pruebas de
 * extremo a extremo.
 *
 * Se arranca el mismo `AppModule` que en producción, escuchando en un puerto
 * libre, y se le habla por HTTP y WebSocket como lo haría la aplicación. Antes
 * de empezar se vacía la base: cada ejecución parte de cero.
 */
export interface Harness {
  app: INestApplication;
  url: string;
  gql<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
    token?: string | null,
  ): Promise<GraphqlResult<T>>;
  upload<T = Record<string, unknown>>(
    query: string,
    variables: Record<string, unknown>,
    files: Record<string, { name: string; type: string; data: Buffer }>,
    token: string,
  ): Promise<GraphqlResult<T>>;
  ws(token: string): Client;
  close(): Promise<void>;
}

export interface GraphqlResult<T> {
  data: T | null;
  errors?: { message: string; extensions?: { code?: string; statusCode?: number } }[];
}

export async function startHarness(): Promise<Harness> {
  const databaseUrl = process.env['E2E_DATABASE_URL'] ?? 'mongodb://127.0.0.1:27019/respet_e2e?directConnection=true';

  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['JWT_ACCESS_SECRET'] ??= 'e2e-access-secret-with-more-than-thirty-two-chars';
  process.env['JWT_REFRESH_SECRET'] ??= 'e2e-refresh-secret-with-more-than-thirty-two-chars';
  process.env['MAIL_ENABLED'] = 'false';
  process.env['STORAGE_ROOT'] = 'storage/e2e-uploads';
  process.env['CLIENT_URL'] = 'http://localhost:8100';
  delete process.env['REDIS_URL'];

  const connection = await mongoose.createConnection(databaseUrl).asPromise();
  await connection.dropDatabase();
  await connection.close();

  const { AppModule } = await import('../../src/app.module.js');
  const { MediaService } = await import('../../src/media/media.service.js');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });

  app.set('trust proxy', 1);
  app.use('/graphql', graphqlUploadExpress({ maxFileSize: app.get(MediaService).maxUploadBytes, maxFiles: 10 }));
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const clients: Client[] = [];

  const gql = async <T>(
    query: string,
    variables: Record<string, unknown> = {},
    token: string | null = null,
  ): Promise<GraphqlResult<T>> => {
    const response = await fetch(`${url}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    return (await response.json()) as GraphqlResult<T>;
  };

  const upload = async <T>(
    query: string,
    variables: Record<string, unknown>,
    files: Record<string, { name: string; type: string; data: Buffer }>,
    token: string,
  ): Promise<GraphqlResult<T>> => {
    const form = new FormData();
    const map: Record<string, string[]> = {};
    const entries = Object.entries(files);

    entries.forEach(([path], index) => {
      map[String(index)] = [`variables.${path}`];
    });

    form.append('operations', JSON.stringify({ query, variables }));
    form.append('map', JSON.stringify(map));

    entries.forEach(([, file], index) => {
      form.append(String(index), new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
    });

    const response = await fetch(`${url}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'apollo-require-preflight': 'true' },
      body: form,
    });

    return (await response.json()) as GraphqlResult<T>;
  };

  const ws = (token: string): Client => {
    const client = createClient({
      url: url.replace('http', 'ws') + '/graphql',
      webSocketImpl: WebSocket,
      connectionParams: { authorization: `Bearer ${token}` },
      lazy: false,
      retryAttempts: 0,
    });

    clients.push(client);

    return client;
  };

  return {
    app,
    url,
    gql,
    upload,
    ws,
    close: async () => {
      for (const client of clients) {
        await client.dispose();
      }
      await app.close();
    },
  };
}

/** Espera el primer resultado de una suscripción que cumpla la condición. */
export function nextEvent<T>(
  client: Client,
  query: string,
  variables: Record<string, unknown>,
  match: (data: T) => boolean,
  timeoutMs = 8000,
): { promise: Promise<T>; ready: Promise<void> } {
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const promise = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for a subscription event'));
    }, timeoutMs);

    const unsubscribe = client.subscribe<T>(
      { query, variables },
      {
        next: (result) => {
          if (result.data && match(result.data)) {
            clearTimeout(timer);
            unsubscribe();
            resolve(result.data);
          }
        },
        error: (error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(JSON.stringify(error)));
        },
        complete: () => undefined,
      },
    );

    // graphql-ws no avisa de que la suscripción ya está activa en el
    // servidor; un margen corto basta para que el bus tenga al oyente.
    setTimeout(markReady, 300);
  });

  return { promise, ready };
}

/** Un PNG de 4×4 píxeles, generado sin depender de archivos del disco. */
export async function tinyPng(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 107, b: 53 } } })
    .png()
    .toBuffer();
}
