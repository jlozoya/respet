import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { mkdir } from 'node:fs/promises';

import { AppModule } from './app.module.js';
import { ConfiguredIoAdapter } from './common/adapters/socket-io.adapter.js';
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
    // Estas rutas quedan fuera del prefijo: la primera para que los monitores
    // la encuentren donde suelen mirar, la segunda porque las URL de las
    // imágenes ya están guardadas en la base de datos. El esquema se sirve en
    // `/graphql`, que tampoco lleva prefijo: lo monta el propio módulo.
    exclude: ['health', 'graphql', 'uploads/{*path}'],
  });

  app.use(
    helmet({
      // Las imágenes se sirven desde este mismo origen hacia una app en otro
      // dominio, así que la política estricta por defecto las bloquearía.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: config.getOrThrow<string[]>('corsOrigins'),
    // Casi todo va por POST a `/graphql`; el resto son las subidas de archivos
    // y los dos enlaces que abre un navegador.
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Accept-Language'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
    maxAge: 86_400,
  });

  // Necesario detrás de un proxy inverso para que `request.ip` sea la del
  // cliente y no la del propio proxy, de la que depende el límite de peticiones.
  app.set('trust proxy', 1);

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
  });

  // El chat en tiempo real usa la misma lista de orígenes que el resto.
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app));

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`Respet API escuchando en http://localhost:${port}/graphql`);
}

void bootstrap();
