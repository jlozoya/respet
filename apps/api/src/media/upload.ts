import GraphQLUploadScalar from 'graphql-upload/GraphQLUpload.mjs';
import type { FileUpload } from 'graphql-upload/processRequest.mjs';

import { AppException, ErrorCode } from '../common/errors.js';

/**
 * El escalar `Upload` de la especificación multipart de GraphQL.
 *
 * Con él los archivos viajan dentro de la misma operación que los usa —la
 * foto va en `createStory`, el adjunto en `sendMessage`— en lugar de subirse
 * aparte por una ruta REST y enlazarse después. El middleware
 * `graphqlUploadExpress`, montado en `main.ts`, es quien lee el formulario y
 * deja cada archivo en su variable.
 */
export const GraphQLUpload = GraphQLUploadScalar;

export type { FileUpload };

/**
 * Lo que recibe un resolutor en un argumento `Upload`: la promesa del archivo.
 *
 * Es una interfaz y no un alias de `Promise` a propósito. TypeScript emite
 * como metadato del parámetro la clase del tipo, y con `Promise` el
 * `ValidationPipe` global intentaría construir una promesa a partir del valor
 * —y reventaría—; una interfaz se emite como `Object`, que el pipe deja pasar.
 */
export interface PendingUpload extends Promise<FileUpload> {
  readonly __pendingUpload?: never;
}

/** Un archivo ya leído entero, listo para procesar. */
export interface UploadedFileData {
  buffer: Buffer;
  /** El tipo que declaró el cliente. No es de fiar: el real se averigua por el contenido. */
  mimetype: string;
  originalName: string;
  size: number;
}

/**
 * Lee un archivo subido hasta el final, sin pasar de `maxBytes`.
 *
 * Se corta en cuanto se supera el tope, en lugar de leerlo todo y comprobar
 * después: quien sube un archivo enorme no debe poder llenar la memoria del
 * proceso antes de que alguien mire el tamaño.
 */
export async function readUpload(
  upload: PendingUpload | Promise<FileUpload> | FileUpload,
  maxBytes: number,
): Promise<UploadedFileData> {
  let file: FileUpload;

  try {
    file = await upload;
  } catch {
    throw AppException.badRequest(ErrorCode.ValidationFailed, 'The file could not be received');
  }

  const chunks: Buffer[] = [];
  let size = 0;

  const stream = file.createReadStream();

  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      size += buffer.byteLength;

      if (size > maxBytes) {
        stream.destroy();

        throw tooLarge(maxBytes);
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof AppException) {
      throw error;
    }

    // `graphqlUploadExpress` corta el flujo con un error propio cuando se
    // supera su tope general, que es el del tipo de archivo más grande.
    if (error instanceof Error && /max file size|limit/i.test(error.message)) {
      throw tooLarge(maxBytes);
    }

    throw AppException.badRequest(ErrorCode.ValidationFailed, 'The upload was interrupted');
  }

  if (size === 0) {
    throw AppException.badRequest(ErrorCode.ValidationFailed, 'The file is empty');
  }

  return {
    buffer: Buffer.concat(chunks, size),
    mimetype: file.mimetype,
    originalName: file.filename,
    size,
  };
}

function tooLarge(maxBytes: number): AppException {
  return new AppException(
    ErrorCode.FileTooLarge,
    413,
    `File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
  );
}
