import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Branding } from '@social-network/shared';
import compression from 'compression';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import helmet from 'helmet';
import { mkdir } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

import { AppModule } from './app.module.js';
import { MediaService } from './media/media.service.js';
import { StorageService } from './media/storage.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const prefix = config.getOrThrow<string>('apiPrefix');
  const port = config.getOrThrow<number>('port');
  const isProduction = config.getOrThrow<boolean>('isProduction');

  app.setGlobalPrefix(prefix, {
    // Fuera del prefijo: `/graphql`, que es la API; `/health`, donde lo buscan
    // los monitores; `/uploads`, porque las URL de las imágenes ya están
    // guardadas en la base; y `/oauth` y `/.well-known`, donde los esperan las
    // bibliotecas de OAuth de las aplicaciones de terceros.
    exclude: ['health', 'graphql', 'uploads/{*path}', 'oauth/{*path}', '.well-known/{*path}'],
  });

  app.use(
    helmet({
      // Las imágenes se sirven desde este mismo origen hacia una app en otro
      // dominio, así que la política estricta por defecto las bloquearía.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // GraphiQL carga sus hojas de estilo y scripts de una CDN.
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: config.getOrThrow<string[]>('corsOrigins'),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Accept-Language',
      // Las subidas viajan como `multipart/form-data`, que el navegador manda
      // sin preflight; Apollo sólo las acepta si llevan alguna de estas
      // cabeceras, que es lo que impide que otra web las provoque a ciegas.
      'Apollo-Require-Preflight',
      'X-Apollo-Operation-Name',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-App-Usage',
    ],
    credentials: false,
    maxAge: 86_400,
  });

  // Necesario detrás de un proxy inverso para que `request.ip` sea la del
  // cliente y no la del propio proxy, de la que dependen los límites.
  app.set('trust proxy', 1);

  /*
    Los archivos de las mutaciones.

    Lee el formulario multipart antes de que llegue a Apollo y deja cada
    archivo en su variable como una promesa. El tope es el del tipo de archivo
    más grande —un vídeo—; cada operación aplica después el suyo.
  */
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFileSize: app.get(MediaService).maxUploadBytes,
      maxFiles: 10,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      // En producción no se detallan los valores recibidos, para no devolver
      // en el error datos que el cliente no debería ver reflejados.
      disableErrorMessages: false,
      validationError: { target: false, value: !isProduction },
    }),
  );

  const storage = app.get(StorageService);
  await mkdir(storage.rootPath, { recursive: true });
  app.useStaticAssets(storage.rootPath, {
    prefix: '/uploads/',
    maxAge: '30d',
    immutable: true,
    // Un documento adjunto se descarga, no se abre dentro de nuestro dominio.
    setHeaders: (response: ServerResponse, path: string) => {
      if (/\.(pdf|zip|docx|xlsx|pptx)$/i.test(path)) {
        response.setHeader('Content-Disposition', 'attachment');
      }

      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(
    `API de ${config.getOrThrow<Branding>('branding').name} escuchando en http://localhost:${port}/graphql`,
  );
}

void bootstrap();
