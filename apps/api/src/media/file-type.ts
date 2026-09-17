/**
 * Averigua qué es un archivo mirando sus primeros bytes.
 *
 * El tipo que declara el cliente no vale: cualquiera puede llamar `foto.jpg`
 * a una página HTML y mandarla como `image/jpeg`. Servida desde nuestro
 * dominio, esa página ejecutaría su código con nuestras cookies. Aquí sólo
 * cuenta la firma del contenido, y lo que no se reconoce no se acepta.
 *
 * La lista es corta a propósito: lo que la aplicación sabe enseñar o
 * reproducir, y los documentos habituales para adjuntar en el chat.
 */
export type FileKind = 'image' | 'video' | 'audio' | 'file';

export interface DetectedFileType {
  kind: FileKind;
  mime: string;
  extension: string;
}

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  const ascii = (start: number, end: number): string =>
    buffer.subarray(start, end).toString('latin1');
  const bytes = (start: number, ...expected: number[]): boolean =>
    expected.every((value, offset) => buffer[start + offset] === value);

  if (buffer.length < 12) {
    return null;
  }

  // --- Imágenes -------------------------------------------------------------
  if (bytes(0, 0xff, 0xd8, 0xff)) {
    return { kind: 'image', mime: 'image/jpeg', extension: 'jpg' };
  }

  if (bytes(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { kind: 'image', mime: 'image/png', extension: 'png' };
  }

  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') {
    return { kind: 'image', mime: 'image/gif', extension: 'gif' };
  }

  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { kind: 'image', mime: 'image/webp', extension: 'webp' };
  }

  // --- Contenedores ISO (MP4, MOV, M4A, AVIF) -------------------------------
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);

    if (brand === 'avif' || brand === 'avis') {
      return { kind: 'image', mime: 'image/avif', extension: 'avif' };
    }

    if (brand === 'M4A ' || brand === 'M4B ') {
      return { kind: 'audio', mime: 'audio/mp4', extension: 'm4a' };
    }

    if (brand === 'qt  ') {
      return { kind: 'video', mime: 'video/quicktime', extension: 'mov' };
    }

    if (['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'MSNV'].includes(brand)) {
      return { kind: 'video', mime: 'video/mp4', extension: 'mp4' };
    }

    return null;
  }

  // --- WebM / Matroska ------------------------------------------------------
  if (bytes(0, 0x1a, 0x45, 0xdf, 0xa3)) {
    // El tipo de documento va dentro de la cabecera EBML; basta con buscarlo
    // en los primeros bytes. Un WebM sin pista de vídeo es una nota de voz
    // grabada con MediaRecorder, pero eso no se sabe sin analizarlo entero: lo
    // decide quien lo sube según el campo en que lo manda.
    const header = ascii(0, Math.min(buffer.length, 64));

    if (header.includes('webm')) {
      return { kind: 'video', mime: 'video/webm', extension: 'webm' };
    }

    return null;
  }

  // --- Audio ----------------------------------------------------------------
  if (ascii(0, 4) === 'OggS') {
    return { kind: 'audio', mime: 'audio/ogg', extension: 'ogg' };
  }

  if (ascii(0, 3) === 'ID3' || bytes(0, 0xff, 0xfb) || bytes(0, 0xff, 0xf3) || bytes(0, 0xff, 0xf2)) {
    return { kind: 'audio', mime: 'audio/mpeg', extension: 'mp3' };
  }

  if (bytes(0, 0xff, 0xf1) || bytes(0, 0xff, 0xf9)) {
    return { kind: 'audio', mime: 'audio/aac', extension: 'aac' };
  }

  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') {
    return { kind: 'audio', mime: 'audio/wav', extension: 'wav' };
  }

  // --- Documentos -----------------------------------------------------------
  if (ascii(0, 5) === '%PDF-') {
    return { kind: 'file', mime: 'application/pdf', extension: 'pdf' };
  }

  if (bytes(0, 0x50, 0x4b, 0x03, 0x04)) {
    // Los documentos de Office son archivos ZIP; su tipo concreto va en el
    // nombre del primer archivo interno, que no siempre es el mismo. Se
    // guardan como ZIP genérico salvo que se reconozca el contenido.
    const head = ascii(0, Math.min(buffer.length, 2000));

    if (head.includes('word/')) {
      return {
        kind: 'file',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      };
    }

    if (head.includes('xl/')) {
      return {
        kind: 'file',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    }

    if (head.includes('ppt/')) {
      return {
        kind: 'file',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extension: 'pptx',
      };
    }

    return { kind: 'file', mime: 'application/zip', extension: 'zip' };
  }

  return null;
}
