import { BadRequestException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { describeException } from './error-description.js';
import { AppException, ErrorCode } from './errors.js';

/**
 * De aquí salen los dos formatos de error de la API: el cuerpo JSON de las
 * rutas HTTP que quedan y el `extensions` de cada error de GraphQL. La
 * aplicación decide qué mensaje enseña mirando `code`, así que una traducción
 * equivocada aquí se ve como un «ha ocurrido un error» en pantalla, sin más
 * pistas.
 */
describe('describeException', () => {
  it('conserva la clave y el estado de una excepción de dominio', () => {
    const descripcion = describeException(AppException.notFound('User'));

    expect(descripcion).toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.NotFound,
      message: 'User not found',
    });
  });

  it('agrupa por campo lo que protesta la validación', () => {
    // Es la forma en que `ValidationPipe` anuncia lo que no cuadra.
    const excepcion = new BadRequestException({
      message: ['email must be a valid address', 'password is too short'],
    });

    const descripcion = describeException(excepcion);

    expect(descripcion.status).toBe(HttpStatus.BAD_REQUEST);
    expect(descripcion.code).toBe(ErrorCode.ValidationFailed);
    expect(descripcion.errors).toEqual({
      email: ['email must be a valid address'],
      password: ['password is too short'],
    });
  });

  it('distingue una clave repetida de un fallo del servidor', () => {
    const duplicada = Object.assign(new Error('E11000 duplicate key'), {
      name: 'MongoServerError',
      code: 11000,
      keyPattern: { email: 1 },
    });

    const descripcion = describeException(duplicada);

    expect(descripcion.status).toBe(HttpStatus.CONFLICT);
    expect(descripcion.code).toBe(ErrorCode.Conflict);
    expect(descripcion.message).toContain('email');
  });

  it('avisa de que la base no responde en lugar de culpar a quien llama', () => {
    const caida = Object.assign(new Error('server selection timed out'), {
      name: 'MongooseServerSelectionError',
    });

    expect(describeException(caida)).toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: ErrorCode.DatabaseUnavailable,
    });
  });

  it('deja lo inesperado como error del servidor', () => {
    expect(describeException(new Error('vaya'))).toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.Error,
      message: 'vaya',
    });
  });
});
