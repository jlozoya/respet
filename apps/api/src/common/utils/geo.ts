const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distancia en kilómetros entre dos puntos, por la fórmula del haversine. */
export function distanceKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Caja de coordenadas que contiene un círculo de `radiusKm` alrededor de un
 * punto. Sirve para acotar la consulta SQL con un `BETWEEN` sobre los índices
 * de `lat`/`lng`; el filtrado exacto por distancia se hace después en memoria.
 */
export function boundingBox(
  center: LatLng,
  radiusKm: number,
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / 111.32;
  // Los meridianos se juntan cerca de los polos, así que un grado de longitud
  // cubre menos distancia cuanto mayor es la latitud.
  const cosLat = Math.cos(toRadians(center.lat));
  const lngDelta = Math.abs(cosLat) < 1e-6 ? 180 : radiusKm / (111.32 * Math.abs(cosLat));

  return {
    minLat: clamp(center.lat - latDelta, -90, 90),
    maxLat: clamp(center.lat + latDelta, -90, 90),
    minLng: clamp(center.lng - lngDelta, -180, 180),
    maxLng: clamp(center.lng + lngDelta, -180, 180),
  };
}

/**
 * Desplaza un punto de forma determinista dentro de un radio, para publicar
 * una ubicación aproximada sin revelar la exacta.
 *
 * El desplazamiento depende de `seed` (el id de la publicación), de modo que
 * el punto difuminado no cambia entre peticiones: si variara, un observador
 * podría promediar varias lecturas y recuperar el centro real.
 */
export function fuzzyPoint(point: LatLng, accuracyKm: number, seed: string | number): LatLng {
  if (accuracyKm <= 0) {
    return point;
  }

  // La semilla es el identificador de la publicación, que con Mongo es una
  // cadena: se reduce a número para que el desplazamiento siga siendo siempre
  // el mismo para la misma publicación y no baile en cada petición.
  const semilla = typeof seed === 'number' ? seed : seedFromString(seed);
  const angle = (hash(semilla) % 360) * (Math.PI / 180);
  const distance = ((hash(semilla * 31 + 7) % 1000) / 1000) * accuracyKm;
  const latDelta = (distance / 111.32) * Math.cos(angle);
  const cosLat = Math.cos(toRadians(point.lat));
  const lngDelta =
    Math.abs(cosLat) < 1e-6 ? 0 : (distance / (111.32 * Math.abs(cosLat))) * Math.sin(angle);

  return {
    lat: clamp(point.lat + latDelta, -90, 90),
    lng: clamp(point.lng + lngDelta, -180, 180),
  };
}

function seedFromString(value: string): number {
  let acumulado = 0;

  for (let i = 0; i < value.length; i += 1) {
    acumulado = (acumulado * 31 + value.charCodeAt(i)) | 0;
  }

  return acumulado;
}

function hash(value: number): number {
  let x = Math.trunc(value) | 0;
  x = x ^ 61 ^ (x >>> 16);
  x = x + (x << 3);
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);

  return Math.abs(x);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
