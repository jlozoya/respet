import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError, type GraphqlError } from './api-error';

/** Lo que devuelve el servidor: los datos pedidos, los errores, o ambos. */
interface GraphqlResponse<T> {
  data?: T | null;
  errors?: GraphqlError[];
}

export type Variables = Record<string, unknown>;

/**
 * Cliente de GraphQL.
 *
 * Sustituye al cliente REST, que tenía un método por verbo y construía rutas
 * a mano. Aquí sólo hay una dirección y un verbo: todo va en un POST a
 * `/graphql` con el documento y sus variables. Los servicios de cada dominio
 * siguen exponiendo promesas, que es como consume la API el resto de la
 * aplicación, así que ninguna pantalla se entera del cambio.
 *
 * No usa Apollo ni ningún otro cliente con caché: la aplicación ya guarda lo
 * que necesita en señales —el carrito, las conversaciones, el muro— y una
 * caché normalizada por encima sería un segundo sitio donde el mismo dato
 * puede quedarse viejo.
 *
 * La cabecera de autorización no se pone aquí, sino en `authInterceptor`, que
 * además sabe renovar el token cuando caduca.
 */
@Injectable({ providedIn: 'root' })
export class GraphqlClientService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.graphqlUrl;

  /**
   * Ejecuta un documento y devuelve sus datos.
   *
   * El nombre de la operación se saca del propio documento y se manda aparte:
   * aparece en los registros del servidor y, sobre todo, permite al
   * interceptor saber qué operación viaja dentro sin tener que leer la
   * consulta entera.
   */
  async request<T>(document: string, variables: Variables = {}): Promise<T> {
    const body = {
      query: document,
      variables,
      operationName: operationNameOf(document),
    };

    let response: GraphqlResponse<T>;

    try {
      response = await firstValueFrom(this.http.post<GraphqlResponse<T>>(this.url, body));
    } catch (error) {
      // Aquí sólo caen los fallos de transporte: sin red, servidor caído o una
      // respuesta que no es JSON. Lo demás llega con un 200 y errores dentro.
      throw ApiError.from(error as HttpErrorResponse);
    }

    if (response.errors?.length) {
      throw ApiError.fromGraphQL(response.errors);
    }

    if (response.data === null || response.data === undefined) {
      throw new ApiError(500, 'SERVER.ERROR', 'La respuesta no traía datos');
    }

    return response.data;
  }
}

/** Nombres ya extraídos, para no volver a mirar el mismo documento. */
const nombres = new Map<string, string>();

const OPERATION_PATTERN = /^\s*(?:query|mutation)\s+(\w+)/;

export function operationNameOf(document: string): string {
  const cached = nombres.get(document);

  if (cached !== undefined) {
    return cached;
  }

  // Todos los documentos de la aplicación llevan nombre; si alguno no lo
  // llevara, mandar una cadena vacía es lo mismo que no mandar nada.
  const name = OPERATION_PATTERN.exec(document)?.[1] ?? '';
  nombres.set(document, name);

  return name;
}
