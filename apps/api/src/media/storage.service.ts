import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve, sep } from 'node:path';

export interface StoredFile {
  /** Ruta relativa dentro del almacén, la que se guarda en la base de datos. */
  key: string;
  /** URL pública con la que la app pide el archivo. */
  url: string;
}

/**
 * Almacenamiento de archivos en disco.
 *
 * Se deja detrás de una interfaz sencilla —guardar, borrar, construir la URL—
 * para que sustituirlo por S3 o similar sea cuestión de cambiar esta clase, sin
 * tocar los módulos que suben imágenes.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly publicBase: string;

  constructor(config: ConfigService) {
    this.root = resolve(process.cwd(), config.getOrThrow<string>('storage.root'));
    this.publicBase = `${config.getOrThrow<string>('appUrl')}/uploads`;
  }

  /**
   * Escribe un archivo bajo `folder` con un nombre aleatorio.
   *
   * El nombre nunca procede de la petición: usar el que envía el cliente abre
   * la puerta a colisiones y a rutas con `..`.
   */
  async save(folder: string, extension: string, data: Buffer): Promise<StoredFile> {
    const safeFolder = sanitizeSegment(folder);
    const key = `${safeFolder}/${randomUUID()}.${sanitizeExtension(extension)}`;
    const absolute = this.absolutePathOf(key);

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, data);

    return { key, url: this.urlOf(key) };
  }

  /** Borra un archivo. No falla si ya no está. */
  async remove(key: string | null | undefined): Promise<void> {
    if (!key) {
      return;
    }

    try {
      await unlink(this.absolutePathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`No se pudo borrar el archivo "${key}": ${describe(error)}`);
      }
    }
  }

  urlOf(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  /** Directorio raíz, que `main.ts` publica como contenido estático. */
  get rootPath(): string {
    return this.root;
  }

  /**
   * Resuelve una clave a una ruta absoluta, comprobando que no se escape del
   * directorio raíz.
   */
  absolutePathOf(key: string): string {
    const absolute = resolve(this.root, normalize(key));

    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error(`Ruta de almacenamiento fuera de la raíz: "${key}"`);
    }

    return absolute;
  }
}

function sanitizeSegment(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, '');

  return clean.length > 0 ? clean : 'misc';
}

function sanitizeExtension(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  return clean.length > 0 ? clean : 'bin';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
