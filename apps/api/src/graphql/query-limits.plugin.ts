import type { ApolloServerPlugin } from '@apollo/server';
import {
  GraphQLError,
  Kind,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
  type ComplexityEstimator,
} from 'graphql-query-complexity';

import { ErrorCode } from '../common/errors.js';

/** Tope de elementos que se supone que devuelve un listado al estimar su coste. */
const MAX_PAGE_ESTIMATE = 100;

/**
 * Límites de profundidad y de coste de las consultas.
 *
 * Con la API abierta a terceros cualquiera puede escribir una consulta que
 * anide seguidores de seguidores de seguidores hasta tumbar la base. Antes de
 * ejecutar nada se mide:
 *
 * - **Profundidad**: cuántos niveles de campos anidados tiene.
 * - **Coste**: cada campo cuenta uno, y lo que cuelga de un listado cuenta
 *   tantas veces como elementos puede traer la página. Pedir veinte
 *   publicaciones con su autor cuesta más que pedir una.
 *
 * Por encima de cualquiera de los dos, la consulta se rechaza sin tocar la
 * base.
 */
export function queryLimitsPlugin(options: {
  maxDepth: number;
  maxComplexity: number;
}): ApolloServerPlugin {
  return {
    requestDidStart() {
      return Promise.resolve({
        didResolveOperation({ request, document, schema }) {
          const depth = maxDepthOf(document, request.operationName ?? undefined);

          if (depth > options.maxDepth) {
            throw new GraphQLError(
              `Query depth ${depth} exceeds the limit of ${options.maxDepth}`,
              {
                extensions: { code: ErrorCode.QueryTooComplex, statusCode: 400 },
              },
            );
          }

          const complexity = getComplexity({
            schema,
            query: document,
            operationName: request.operationName ?? undefined,
            variables: request.variables ?? {},
            estimators: [
              paginationEstimator,
              fieldExtensionsEstimator(),
              simpleEstimator({ defaultComplexity: 1 }),
            ],
          });

          if (complexity > options.maxComplexity) {
            throw new GraphQLError(
              `Query complexity ${complexity} exceeds the limit of ${options.maxComplexity}`,
              { extensions: { code: ErrorCode.QueryTooComplex, statusCode: 400 } },
            );
          }

          return Promise.resolve();
        },
      });
    },
  };
}

/**
 * Lo que cuelga de un listado cuesta tantas veces como elementos pueda traer.
 *
 * Se reconoce un listado por sus argumentos de tamaño, que en este esquema se
 * llaman `perPage` o `limit`, sueltos o dentro de `query`.
 */
const paginationEstimator: ComplexityEstimator = ({ args, childComplexity }) => {
  const query = (args['query'] ?? args['input'] ?? {}) as Record<string, unknown>;
  const size = [
    args['perPage'],
    args['limit'],
    args['first'],
    query['perPage'],
    query['limit'],
  ].find((value): value is number => typeof value === 'number');

  if (size === undefined) {
    return undefined;
  }

  return 1 + childComplexity * Math.min(Math.max(size, 1), MAX_PAGE_ESTIMATE);
};

function maxDepthOf(document: DocumentNode, operationName: string | undefined): number {
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  const operations = document.definitions.filter(
    (definition) =>
      definition.kind === Kind.OPERATION_DEFINITION &&
      (!operationName || definition.name?.value === operationName),
  );

  let max = 0;

  for (const operation of operations) {
    if (operation.kind === Kind.OPERATION_DEFINITION) {
      max = Math.max(max, depthOf(operation.selectionSet, fragments, new Set()));
    }
  }

  return max;
}

function depthOf(
  selectionSet: SelectionSetNode | undefined,
  fragments: Map<string, FragmentDefinitionNode>,
  visiting: Set<string>,
): number {
  if (!selectionSet) {
    return 0;
  }

  let max = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      // La introspección es profunda por naturaleza y no toca la base.
      if (selection.name.value.startsWith('__')) {
        continue;
      }

      max = Math.max(max, 1 + depthOf(selection.selectionSet, fragments, visiting));
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      max = Math.max(max, depthOf(selection.selectionSet, fragments, visiting));
    } else {
      const name = selection.name.value;
      const fragment = fragments.get(name);

      // Un fragmento que se incluye a sí mismo lo rechaza la validación de
      // GraphQL; aquí sólo se evita dar vueltas mientras tanto.
      if (fragment && !visiting.has(name)) {
        visiting.add(name);
        max = Math.max(max, depthOf(fragment.selectionSet, fragments, visiting));
        visiting.delete(name);
      }
    }
  }

  return max;
}
