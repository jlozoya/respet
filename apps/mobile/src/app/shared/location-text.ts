import type { Location, LocationInput } from '@respet/shared';

/**
 * Escribe una ubicación como se escribe una dirección.
 *
 * Va de lo concreto a lo general, que es como se lee una dirección en papel, y
 * se salta los huecos: casi ninguna trae los ocho campos, y una ristra de comas
 * vacías se lee peor que una ciudad a secas.
 *
 * `coarse` deja sólo la parte ancha. Se usa con las publicaciones que difuminan
 * su ubicación a propósito: decir la calle y el número echaría por tierra justo
 * lo que el difuminado protege.
 */
export function describeLocation(
  location: Location | LocationInput,
  coarse = false,
): string | null {
  const street = [location.route, location.streetNumber].filter(Boolean).join(' ');

  const parts = coarse
    ? [location.city, location.state, location.country]
    : [street, location.city, location.state, location.postalCode, location.country];

  const address = parts.filter((part) => Boolean(part?.trim())).join(', ');

  return address || null;
}
