/**
 * Etiquetas y menciones dentro de un texto.
 *
 * `#Perros` y `#perros` son la misma etiqueta: se guardan en minúsculas. Las
 * menciones siguen el formato del nombre de usuario —minúsculas, dígitos,
 * guion y guion bajo—, así que `@ana.` menciona a `ana` y el punto se queda
 * fuera.
 */

const HASHTAG = /(?:^|[^\p{L}\p{N}_&])#(\p{L}[\p{L}\p{N}_]{0,49})/gu;
const MENTION = /(?:^|[^\p{L}\p{N}_@])@([a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?)/giu;

/** Máximo de etiquetas por texto: más es spam. */
const MAX_TAGS = 30;
const MAX_MENTIONS = 20;

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  const tags = new Set<string>();

  for (const match of text.matchAll(HASHTAG)) {
    const tag = match[1]?.toLowerCase();

    if (tag) {
      tags.add(tag);
    }

    if (tags.size >= MAX_TAGS) {
      break;
    }
  }

  return [...tags];
}

export function extractMentions(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  const names = new Set<string>();

  for (const match of text.matchAll(MENTION)) {
    const name = match[1]?.toLowerCase();

    if (name) {
      names.add(name);
    }

    if (names.size >= MAX_MENTIONS) {
      break;
    }
  }

  return [...names];
}

/** Normaliza lo que alguien escribe en el buscador de etiquetas: sin almohadilla ni mayúsculas. */
export function normalizeHashtag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase();
}
