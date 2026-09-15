import { Injectable, type PipeTransform } from '@nestjs/common';
import { isValidObjectId } from '../../database/mongoose.js';

import { AppException } from '../errors.js';

/**
 * Valida que un parámetro de ruta tenga forma de `ObjectId`.
 *
 * Ocupa el lugar de `ParseIntPipe`, que era lo que validaba los identificadores
 * cuando eran enteros. Sin esta comprobación, una cadena con cualquier forma
 * llegaría hasta la consulta y Mongo respondería con un error de conversión
 * —un 500— en lugar del 404 que corresponde a algo que no existe.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw AppException.notFound('Resource');
    }

    return value;
  }
}
