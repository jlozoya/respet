/**
 * Escapa lo que en una expresión regular tendría significado propio.
 *
 * Las búsquedas de texto se hacen con `$regex` sobre lo que la gente escribe.
 * Sin escapar, un paréntesis suelto haría fallar la consulta y un patrón
 * rebuscado podría dejar la base masticando indefinidamente.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
