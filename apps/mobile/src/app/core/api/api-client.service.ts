import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from './api-error';

/**
 * Lo que queda del cliente HTTP: subir archivos.
 *
 * Todo lo demás pasó a `GraphqlClientService`. Una imagen no viaja dentro de
 * una consulta de GraphQL sin añadir una extensión al protocolo y otra
 * librería en el cliente, así que las subidas siguen siendo lo que eran: un
 * formulario multipart contra una ruta que devuelve lo que se acaba de crear.
 *
 * La cabecera de autorización no se pone aquí, sino en `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  /**
   * Sube un archivo en un formulario multipart.
   *
   * No se fija `Content-Type`: el navegador debe generarlo él para incluir el
   * `boundary` que separa las partes.
   */
  async upload<T>(
    path: string,
    file: Blob,
    filename = 'upload',
    method: 'POST' | 'PUT' = 'POST',
  ): Promise<T> {
    const form = new FormData();
    form.append('file', file, filename);

    const url = this.absoluteUrl(path);

    try {
      return await firstValueFrom(
        method === 'PUT' ? this.http.put<T>(url, form) : this.http.post<T>(url, form),
      );
    } catch (error) {
      throw ApiError.from(error as HttpErrorResponse);
    }
  }

  /** URL absoluta de la API, para enlaces que se abren fuera de la app. */
  absoluteUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
