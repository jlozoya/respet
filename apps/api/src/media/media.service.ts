import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import { AppException, ErrorCode } from '../common/errors.js';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from '../database/mongoose.js';

import { Media } from '../database/schemas/content.schema.js';
import { MediaType } from '../database/schemas/enums.js';
import { StorageService } from './storage.service.js';

/** Formatos que aceptamos subir. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export interface ImageVariant {
  /** Lado mayor máximo, en píxeles. */
  maxSize: number;
  quality: number;
}

export const IMAGE_PRESETS = {
  avatar: { maxSize: 512, quality: 82 },
  post: { maxSize: 1600, quality: 80 },
  product: { maxSize: 1600, quality: 80 },
  bulletin: { maxSize: 1920, quality: 80 },
  warehouse: { maxSize: 1600, quality: 80 },
} as const satisfies Record<string, ImageVariant>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * Procesado y registro de imágenes.
 *
 * Todo lo que se sube se reconvierte a WebP con `sharp`, en sustitución de
 * Intervention Image del backend anterior. Reconvertir, además de reducir mucho
 * el peso, descarta de paso los metadatos EXIF —incluida la posición GPS de la
 * cámara, que nadie querría difundir sin darse cuenta al subir una foto— y
 * neutraliza los archivos que sólo aparentan ser imágenes.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly maxBytes: number;

  constructor(
    @InjectModel(Media.name) private readonly media: Model<Media>,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxBytes = config.getOrThrow<number>('storage.maxBytes');
  }

  /** Comprueba tipo y tamaño antes de gastar tiempo en procesar el archivo. */
  assertValidUpload(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'No file was uploaded');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppException(
        ErrorCode.UnsupportedMedia,
        415,
        `Unsupported file type "${file.mimetype}"`,
      );
    }

    if (file.size > this.maxBytes) {
      throw new AppException(
        ErrorCode.FileTooLarge,
        413,
        `File exceeds the ${Math.round(this.maxBytes / 1024 / 1024)} MB limit`,
      );
    }
  }

  /**
   * Procesa una imagen y crea su fila en `media`.
   *
   * `owner` decide de quién cuelga: una galería (`post`/`product`) o un dueño
   * único (avatar, portada de aviso o de bodega), en cuyo caso el llamante se
   * encarga de apuntar la clave foránea.
   */
  async createFromUpload(
    file: Express.Multer.File,
    preset: ImagePreset,
    owner: { postId?: string; productId?: string; alt?: string; position?: number } = {},
  ): Promise<{ id: string; url: string; width: number | null; height: number | null }> {
    this.assertValidUpload(file);

    const { buffer, width, height } = await this.transform(file.buffer, IMAGE_PRESETS[preset]);
    const stored = await this.storage.save(preset, 'webp', buffer);

    const media = await this.media.create({
      type: MediaType.Image,
      url: stored.url,
      storageKey: stored.key,
      alt: (owner.alt ?? preset).slice(0, 255),
      width,
      height,
      postId: owner.postId ?? null,
      productId: owner.productId ?? null,
      position: owner.position ?? 0,
    });

    return { id: String(media._id), url: media.url, width: media.width, height: media.height };
  }

  /**
   * Borra una imagen y su archivo.
   *
   * El documento se quita primero y el archivo del disco después: un fallo al
   * borrar el archivo deja basura, que es molesto, mientras que el orden
   * contrario dejaría una imagen rota a la vista, que es peor.
   */
  async remove(mediaId: string): Promise<void> {
    const media = await this.media.findById(mediaId).select('storageKey').lean();

    if (!media) {
      return;
    }

    await this.media.deleteOne({ _id: mediaId });
    await this.storage.remove(media.storageKey);
  }

  /** Borra en bloque, por ejemplo al eliminar una publicación entera. */
  async removeMany(mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }

    const docs = await this.media.find({ _id: { $in: mediaIds } }).select('storageKey').lean();

    await this.media.deleteMany({ _id: { $in: mediaIds } });
    await Promise.all(docs.map((doc) => this.storage.remove(doc.storageKey)));
  }

  /**
   * Descarga el avatar que devuelve un proveedor externo y lo guarda como
   * imagen propia, para no depender de una URL ajena que puede caducar.
   */
  async importRemoteAvatar(url: string, alt: string): Promise<string | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!response.ok) {
        return null;
      }

      const raw = Buffer.from(await response.arrayBuffer());

      if (raw.byteLength > this.maxBytes) {
        return null;
      }

      const { buffer, width, height } = await this.transform(raw, IMAGE_PRESETS.avatar);
      const stored = await this.storage.save('avatar', 'webp', buffer);

      const media = await this.media.create({
        type: MediaType.Image,
        url: stored.url,
        storageKey: stored.key,
        alt: alt.slice(0, 255),
        width,
        height,
      });

      return String(media._id);
    } catch (error) {
      this.logger.warn(`No se pudo importar el avatar remoto: ${describe(error)}`);

      return null;
    }
  }

  private async transform(
    input: Buffer,
    variant: ImageVariant,
  ): Promise<{ buffer: Buffer; width: number | null; height: number | null }> {
    try {
      const pipeline = sharp(input, { failOn: 'error' })
        .rotate() // Aplica la orientación EXIF antes de descartar los metadatos.
        .resize({
          width: variant.maxSize,
          height: variant.maxSize,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

      return { buffer: data, width: info.width, height: info.height };
    } catch (error) {
      this.logger.warn(`Imagen rechazada por sharp: ${describe(error)}`);

      throw new AppException(
        ErrorCode.UnsupportedMedia,
        415,
        'The file could not be read as an image',
      );
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
