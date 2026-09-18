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
import type { GraphqlContext } from '../common/execution-context.js';
import './enums.js';
import { queryLimitsPlugin } from './query-limits.plugin.js';
import {
  SubscriptionConnectionsService,
  type SubscriptionContext,
} from './subscriptions/subscription-connections.service.js';

/** Las conexiones de las suscripciones, en un módulo propio para poder inyectarlas en la fábrica. */
@Module({
  providers: [SubscriptionConnectionsService],
  exports: [SubscriptionConnectionsService],
})
export class SubscriptionsModule {}

/**
 * El esquema de GraphQL, construido a partir de las clases del código.
 *
 * Se genera al arrancar —enfoque «code first»— y se escribe en `schema.gql`,
 * que se versiona: así un cambio en un tipo se ve en la revisión del código
 * como lo que es, un cambio del contrato público, y no escondido dentro de un
 * resolutor.
 *
 * Toda la API vive aquí:
 *
 * - **Consultas y mutaciones** por `POST /graphql`.
 * - **Archivos** dentro de las propias mutaciones, con la especificación
 *   multipart de GraphQL (el escalar `Upload`).
 * - **Tiempo real** con suscripciones sobre WebSocket en la misma dirección,
 *   con el protocolo `graphql-transport-ws`.
 *
 * Fuera sólo quedan los extremos que llaman terceros que no hablan GraphQL: el
 * aviso de PayPal, los de OAuth que dicta el estándar y `/health`.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [SubscriptionsModule],
      inject: [ConfigService, SubscriptionConnectionsService],
      useFactory: (config: ConfigService, connections: SubscriptionConnectionsService) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        /*
          El contexto es la petición HTTP en consultas y mutaciones. En las
          suscripciones no hay petición: la construyó `onConnect` con el
          usuario ya autenticado, y los guards la leen igual.
        */
        context: (arg: { req?: Request; res?: Response } | SubscriptionContext): GraphqlContext => {
          if ('req' in arg && arg.req) {
            return { req: arg.req, res: arg.res };
          }

          const ws = arg as SubscriptionContext;

          return { req: ws.extra.pseudoRequest ?? ({ headers: {} } as GraphqlContext['req']) };
        },
        subscriptions: {
          'graphql-ws': {
            path: '/graphql',
            connectionInitWaitTimeout: 10_000,
            onConnect: (context) => connections.onConnect(context as SubscriptionContext),
            onClose: (context) => connections.onClose(context as SubscriptionContext),
          },
        },
        // La API se ofrece a terceros: el esquema es público y se puede
        // explorar. Lo que protege al servidor son los límites de coste.
        introspection: config.getOrThrow<boolean>('graphql.introspection'),
        playground: false,
        graphiql: config.getOrThrow<boolean>('graphql.introspection'),
        plugins: [
          queryLimitsPlugin({
            maxDepth: config.getOrThrow<number>('graphql.maxDepth'),
            maxComplexity: config.getOrThrow<number>('graphql.maxComplexity'),
          }),
        ],
        formatError: (formatted, error) => {
          const original = unwrapResolverError(error);

          // Lo que no sale de ningún resolutor lo ha rechazado el propio
          // motor: una consulta mal escrita, un campo que no existe, un valor
          // que no está en el enumerado. Es culpa de quien pregunta, así que
          // se cuenta como validación —salvo que ya traiga una clave propia,
          // como la de una consulta demasiado costosa—.
          // Por nombre y no con `instanceof`: `graphql` puede cargarse dos
          // veces —como ESM desde este código y como CommonJS desde Apollo— y
          // entonces la clase de uno no es la del otro.
          if (
            original instanceof GraphQLError ||
            (original instanceof Error && original.name === 'GraphQLError')
          ) {
            const code = formatted.extensions?.['code'];
            const own = typeof code === 'string' && code.startsWith('SERVER.');

            return {
              ...formatted,
              extensions: {
                ...formatted.extensions,
                code: own ? code : ErrorCode.ValidationFailed,
                statusCode: own ? (formatted.extensions?.['statusCode'] ?? 400) : 400,
              },
            };
          }

          const { status, code, message, errors } = describeException(original);

          return {
            ...formatted,
            message,
            extensions: {
              // La app traduce por `code`; `statusCode` permite distinguir un
              // 401 de un 403 sin mirar la clave.
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
