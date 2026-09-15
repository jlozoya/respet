import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { unwrapResolverError } from '@apollo/server/errors';
import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';
import { join } from 'node:path';

import { describeException } from '../common/error-description.js';
import { ErrorCode } from '../common/errors.js';
import './enums.js';

/**
 * El esquema de GraphQL, construido a partir de las clases del código.
 *
 * Se genera al arrancar —enfoque «code first»— y se escribe en `schema.gql`,
 * que se versiona: así un cambio en un tipo se ve en la revisión del código
 * como lo que es, un cambio del contrato público, y no escondido dentro de un
 * resolutor.
 *
 * La API ya no expone un árbol de rutas REST. Sólo quedan fuera de aquí las
 * operaciones que GraphQL no sabe hacer bien: subir archivos —que necesitan
 * `multipart/form-data`—, el aviso que manda PayPal y el enlace de
 * confirmación del correo, que abre una persona en un navegador.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        // La petición y la respuesta de Express quedan a mano en el contexto:
        // de ahí las sacan los guards, que son los mismos que protegen las
        // rutas REST que quedan.
        context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        // En producción el esquema deja de ser público: quien consume la API
        // es nuestra propia aplicación, que ya lo conoce.
        introspection: !config.getOrThrow<boolean>('isProduction'),
        playground: false,
        graphiql: !config.getOrThrow<boolean>('isProduction'),
        formatError: (formatted, error) => {
          const original = unwrapResolverError(error);

          // Lo que no sale de ningún resolutor lo ha rechazado el propio
          // motor: una consulta mal escrita, un campo que no existe, un valor
          // que no está en el enumerado. Es culpa de quien pregunta, así que
          // se cuenta como validación y no como un fallo del servidor.
          if (original instanceof GraphQLError) {
            return {
              ...formatted,
              extensions: {
                ...formatted.extensions,
                code: ErrorCode.ValidationFailed,
                statusCode: 400,
              },
            };
          }

          const { status, code, message, errors } = describeException(original);

          return {
            ...formatted,
            message,
            extensions: {
              // La app traduce por `code`, igual que hacía con el cuerpo de
              // error de REST; `statusCode` se conserva para los registros y
              // para que el cliente distinga un 401 de un 403 sin mirar la
              // clave.
              code,
              statusCode: status,
              ...(errors ? { errors } : {}),
            },
          };
        },
      }),
    }),
  ],
})
export class GraphqlApiModule {}
