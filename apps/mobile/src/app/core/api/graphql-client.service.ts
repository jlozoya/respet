import { HttpClient, HttpHeaders, type HttpErrorResponse } from '@angular/common/http';
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
 * Toda la API pasa por aquí: consultas, mutaciones y también los archivos, que
 * viajan dentro de la misma operación con la especificación multipart de
 * GraphQL. Basta con poner un `Blob` o un `File` en las variables; el cliente
 * lo saca, lo manda como parte del formulario y deja en su sitio el hueco que
 * el servidor rellena.
 *
 * No usa Apollo ni ningún otro cliente con caché: la aplicación ya guarda lo
 * que necesita en señales, y una caché normalizada por encima sería un segundo
 * sitio donde el mismo dato puede quedarse viejo.
 *
 * La cabecera de autorización la pone `authInterceptor`, que además sabe
 * renovar el token cuando caduca.
 */
@Injectable({ providedIn: 'root' })
export class GraphqlClientService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.graphqlUrl;

  /**
   * Ejecuta un documento y devuelve sus datos.
   *
   * El nombre de la operación se saca del propio documento y se manda aparte:
   * aparece en los registros del servidor y permite al interceptor saber qué
   * operación viaja dentro sin leer la consulta entera.
   */
  async request<T>(document: string, variables: Variables = {}): Promise<T> {
    const operationName = operationNameOf(document);
    const files = extractFiles(variables);

    let response: GraphqlResponse<T>;

    try {
      response = await firstValueFrom(
        files.length === 0
          ? this.http.post<GraphqlResponse<T>>(this.url, {
              query: document,
              variables,
              operationName,
            })
          : this.http.post<GraphqlResponse<T>>(
              this.url,
              multipartBody(document, variables, operationName, files),
              {
                // Apollo sólo acepta formularios con una cabecera que un
                // formulario HTML corriente no podría poner: es su defensa
                // contra peticiones cruzadas.
                headers: new HttpHeaders({ 'X-Apollo-Operation-Name': operationName || 'upload' }),
              },
            ),
      );
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

  /**
   * Ejecuta un documento de un solo campo raíz y devuelve ese campo.
   *
   * Casi todas las operaciones piden una cosa —`post`, `createStory`—, y así
   * los servicios no tienen que desempaquetar `{ post }` cada vez.
   */
  async field<T>(document: string, variables: Variables = {}): Promise<T> {
    const data = await this.request<Record<string, T>>(document, variables);
    const [value] = Object.values(data);

    return value;
  }
}

/** Un archivo encontrado en las variables, con la ruta donde estaba. */
interface ExtractedFile {
  path: string;
  file: Blob;
}

/**
 * Saca los archivos de las variables y deja `null` en su lugar.
 *
 * Recorre objetos y listas; la ruta se escribe con puntos, como la pide la
 * especificación (`variables.files.0`).
 */
function extractFiles(
  value: unknown,
  path = 'variables',
  found: ExtractedFile[] = [],
): ExtractedFile[] {
  if (value instanceof Blob) {
    found.push({ path, file: value });

    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item instanceof Blob) {
        found.push({ path: `${path}.${index}`, file: item });
        value[index] = null;
      } else {
        extractFiles(item, `${path}.${index}`, found);
      }
    });

    return found;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item instanceof Blob) {
        found.push({ path: `${path}.${key}`, file: item });
        (value as Record<string, unknown>)[key] = null;
      } else {
        extractFiles(item, `${path}.${key}`, found);
      }
    }
  }

  return found;
}

function multipartBody(
  document: string,
  variables: Variables,
  operationName: string,
  files: ExtractedFile[],
): FormData {
  const form = new FormData();
  const map: Record<string, string[]> = {};

  files.forEach((entry, index) => {
    map[String(index)] = [entry.path];
  });

  form.append('operations', JSON.stringify({ query: document, variables, operationName }));
  form.append('map', JSON.stringify(map));

  files.forEach((entry, index) => {
    const name = entry.file instanceof File ? entry.file.name : `archivo-${index}`;
    form.append(String(index), entry.file, name);
  });

  return form;
}

/** Nombres ya extraídos, para no volver a mirar el mismo documento. */
const nombres = new Map<string, string>();

const OPERATION_PATTERN = /^\s*(?:query|mutation|subscription)\s+(\w+)/;

export function operationNameOf(document: string): string {
  const cached = nombres.get(document);

  if (cached !== undefined) {
    return cached;
  }

  const name = OPERATION_PATTERN.exec(document)?.[1] ?? '';
  nombres.set(document, name);

  return name;
}
