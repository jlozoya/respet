/**
 * Los retoques que se aplican a lo que llega antes de validarlo.
 *
 * Son cuatro líneas repetidas en media docena de ficheros de entrada: quitar
 * los espacios de los extremos y, en los correos, pasar a minúsculas. Aquí
 * están una sola vez.
 *
 * Todos aceptan `unknown` y devuelven lo que reciben cuando no es texto: la
 * validación viene después y es la que debe protestar si el tipo no cuadra;
 * un retoque no es sitio para lanzar errores.
 */

/** Quita los espacios de los extremos. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Como `trim` y además en minúsculas: en un correo no cuentan las mayúsculas. */
export const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** `trim` elemento a elemento, para los campos que son una lista. */
export const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value.map((item: unknown) => trim({ value: item })) : value;

/** `normalizeEmail` elemento a elemento. */
export const normalizeEmailEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value.map((item: unknown) => normalizeEmail({ value: item })) : value;
