import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

/**
 * Tope duro de multer, deliberadamente por encima del límite configurable.
 *
 * Su única función es que una subida enorme no llene la memoria del proceso
 * antes de que nadie la mire; el límite que de verdad se aplica al usuario es
 * `UPLOAD_MAX_MB`, que comprueba `MediaService` con un mensaje entendible.
 */
const HARD_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * Recibe una imagen en el campo `file` de un formulario multipart.
 *
 * Se guarda en memoria porque `sharp` la reconvierte enseguida: escribirla
 * antes en disco sólo dejaría archivos temporales que limpiar.
 */
export function UploadImage(field = 'file'): MethodDecorator {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(field, {
        storage: memoryStorage(),
        limits: { fileSize: HARD_LIMIT_BYTES, files: 1 },
      }),
    ),
  );
}
