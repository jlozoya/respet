import type { LocationInput } from '@respet/shared';
import type { Model } from '../../database/mongoose.js';

import type { Location } from '../../database/schemas/content.schema.js';

/**
 * Crea o actualiza la ubicación asociada a una entidad.
 *
 * Usuarios, publicaciones, bodegas y pedidos comparten esta lógica: si ya
 * había un documento se actualiza en el sitio (así el identificador se mantiene
 * y no se acumulan ubicaciones huérfanas, como pasaba en el esquema anterior),
 * y si no, se crea. Pasar `null` desvincula la ubicación.
 *
 * @returns el identificador que debe guardarse en la referencia, o `null`.
 */
export async function upsertLocation(
  locations: Model<Location>,
  currentId: string | null,
  input: LocationInput | null | undefined,
): Promise<string | null | undefined> {
  // `undefined` significa «no tocar», que no es lo mismo que `null`.
  if (input === undefined) {
    return undefined;
  }

  if (input === null) {
    return null;
  }

  const data = toLocationData(input);

  if (currentId !== null) {
    await locations.updateOne({ _id: currentId }, { $set: data });

    return currentId;
  }

  const created = await locations.create(data);

  return String(created._id);
}

function toLocationData(input: LocationInput): Partial<Location> {
  return {
    country: trimOrNull(input.country, 60),
    state: trimOrNull(input.state, 60),
    city: trimOrNull(input.city, 60),
    route: trimOrNull(input.route, 120),
    streetNumber: trimOrNull(input.streetNumber, 15),
    postalCode: trimOrNull(input.postalCode, 15),
    lat: toCoordinate(input.lat),
    lng: toCoordinate(input.lng),
  };
}

function trimOrNull(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

function toCoordinate(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
