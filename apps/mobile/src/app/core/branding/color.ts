/**
 * Los tonos que Ionic espera alrededor de un color.
 *
 * Una variable `--ion-color-primary` no basta: los botones pulsados usan el
 * `shade`, los fondos suaves el `tint` y el texto encima el `contrast`. Como el
 * color de la marca se decide al desplegar, aquí se calculan a partir de él en
 * lugar de estar escritos en el tema.
 */

/** De `#f05a22` a `240, 90, 34`, que es como quiere Ionic los `-rgb`. */
export function rgbOf(hex: string): string {
  const [red, green, blue] = channelsOf(hex);

  return `${red}, ${green}, ${blue}`;
}

/** El mismo color un 12 % más oscuro: es el de «pulsado». */
export function shadeOf(hex: string): string {
  return hexOf(channelsOf(hex).map((channel) => Math.round(channel * 0.88)));
}

/** El mismo color un 10 % más claro, para fondos y estados de paso. */
export function tintOf(hex: string): string {
  return hexOf(channelsOf(hex).map((channel) => Math.round(channel + (255 - channel) * 0.1)));
}

/**
 * Blanco o negro, el que se lea encima.
 *
 * Se decide con la luminancia relativa de la recomendación WCAG: un naranja
 * fuerte pide texto blanco, pero un amarillo claro lo pide negro.
 */
export function contrastOf(hex: string): string {
  const [red, green, blue] = channelsOf(hex).map((channel) => {
    const ratio = channel / 255;

    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.45 ? '#000000' : '#ffffff';
}

/** Admite `#abc` y `#aabbcc`; con cualquier otra cosa se queda en negro. */
function channelsOf(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((character) => character + character)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return [0, 0, 0];
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function hexOf(channels: number[]): string {
  return `#${channels.map((channel) => clamp(channel).toString(16).padStart(2, '0')).join('')}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
