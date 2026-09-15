import { describe, expect, it } from 'vitest';

import * as dominio from '../database/schemas/enums.js';
import * as esquema from './enums.js';

/**
 * El detalle más fácil de romper de toda la migración.
 *
 * GraphQL toma como valor de un enumerado la *clave* del objeto que se le
 * registra, no su valor. Los del dominio se declaran con nombres legibles
 * —`PostKind.General`—, así que registrarlos tal cual haría que una
 * publicación viajara como `General` mientras la aplicación compara con
 * `'general'`: nada fallaría en el servidor y todo dejaría de reconocerse en
 * el cliente. `graphql/enums.ts` le da la vuelta al objeto, y esto comprueba
 * que sigue haciéndolo.
 */
const enumerados = [
  ['UserRole', esquema.UserRole, dominio.UserRole],
  ['AuthProvider', esquema.AuthProvider, dominio.AuthProvider],
  ['Gender', esquema.Gender, dominio.Gender],
  ['MediaType', esquema.MediaType, dominio.MediaType],
  ['PostKind', esquema.PostKind, dominio.PostKind],
  ['VoteValue', esquema.VoteValue, dominio.VoteValue],
  ['OrderState', esquema.OrderState, dominio.OrderState],
  ['PaymentProvider', esquema.PaymentProvider, dominio.PaymentProvider],
  ['PaymentStatus', esquema.PaymentStatus, dominio.PaymentStatus],
  ['MessageKind', esquema.MessageKind, dominio.MessageKind],
] as const satisfies readonly (readonly [string, Record<string, string>, Record<string, string>])[];

describe('enumerados del esquema', () => {
  it.each(enumerados)('%s viaja con los valores del dominio', (_nombre, delEsquema, delDominio) => {
    expect(Object.keys(delEsquema)).toEqual(Object.values(delDominio));
  });

  it.each(enumerados)('%s tiene la clave y el valor iguales', (_nombre, delEsquema) => {
    for (const [clave, valor] of Object.entries(delEsquema)) {
      expect(clave).toBe(valor);
    }
  });

  it('describe los muros y los intervalos con sus propios valores', () => {
    expect(esquema.PostFeed).toEqual({ discover: 'discover', following: 'following' });
    expect(Object.keys(esquema.RegistrationInterval)).toEqual(['day', 'week', 'month', 'year']);
  });
});
