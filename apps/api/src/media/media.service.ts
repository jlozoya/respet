import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import sharp from 'sharp';

import { AppException, ErrorCode } from '../common/errors.js';
import type { Model, Types } from '../database/mongoose.js';
import { Media } from '../database/schemas/content.schema.js';
import { MediaType } from '../database/schemas/enums.js';
import { detectFileType, type DetectedFileType, type FileKind } from './file-type.js';
import { StorageService } from './storage.service.js';
import { readUpload, type PendingUpload, type UploadedFileData } from './upload.js';
import { VideoProcessorService } from './video-processor.service.js';

export interface ImageVariant {
  /** Lado mayor máximo, en píxeles. */
  maxSize: number;
  quality: number;
}

export const IMAGE_PRESETS = {
  avatar: { maxSize: 512, quality: 82 },
  cover: { maxSize: 1920, quality: 80 },
  post: { maxSize: 1600, quality: 80 },
  story: { maxSize: 1920, quality: 82 },
  chat: { maxSize: 1600, quality: 78 },
  product: { maxSize: 1600, quality: 80 },
  bulletin: { maxSize: 1920, quality: 80 },
  warehouse: { maxSize: 1600, quality: 80 },
  icon: { maxSize: 512, quality: 85 },
  poster: { maxSize: 1280, quality: 75 },
} as const satisfies Record<string, ImageVariant>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** De quién cuelga un archivo nuevo. */
export interface MediaOwner {
  postId?: string | Types.ObjectId;
  productId?: string | Types.ObjectId;
  uploaderId?: string | Types.ObjectId;
  alt?: string;
  position?: number;
}

export interface StoreUploadOptions extends MediaOwner {
  /** Qué clases de archivo se admiten en este sitio. */
  accept: readonly FileKind[];
  /** Cómo se reconvierten las imágenes; también da nombre a la carpeta. */
  preset: ImagePreset;
  /** Duración que declara el cliente, para cuando FFmpeg no está. */
  durationHintMs?: number | null;
  /** Duración máxima de vídeos y audios, en milisegundos. */
  maxDurationMs?: number;
}

/** Un archivo ya guardado, tal y como queda en la base. */
export type StoredMedia = Media & { _id: Types.ObjectId };

/**
 * Procesado y registro de archivos.
 *
 * Las imágenes se reconvierten a WebP con `sharp`. Reconvertir, además de
 * reducir mucho el peso, descarta de paso los metadatos EXIF —incluida la
 * posición GPS de la cámara, que nadie querría difundir sin darse cuenta al
 * subir una foto— y neutraliza los archivos que sólo aparentan ser imágenes.
 *
 * Los vídeos y audios se guardan tal cual llegan, una vez comprobado por su
 * contenido que son lo que dicen ser. Reconvertirlos sería caro y lento dentro
 * de la propia petición; los formatos que se aceptan ya los reproducen los
 * navegadores y los móviles.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly limits: Record<FileKind, number>;

  constructor(
    @InjectModel(Media.name) private readonly media: Model<Media>,
    private readonly storage: StorageService,
    private readonly video: VideoProcessorService,
    config: ConfigService,
  ) {
    const imageBytes = config.getOrThrow<number>('storage.maxBytes');

    this.limits = {
      image: imageBytes,
      video: config.getOrThrow<number>('storage.maxVideoBytes'),
      audio: config.getOrThrow<number>('storage.maxAudioBytes'),
      file: imageBytes * 2,
    };
  }

  /** El mayor de los topes, que es el que se configura en el middleware de subidas. */
  get maxUploadBytes(): number {
    return Math.max(...Object.values(this.limits));
  }

  /**
   * Recibe un archivo de una operación de GraphQL, lo comprueba, lo procesa y
   * lo registra.
   */
  async storeUpload(upload: PendingUpload, options: StoreUploadOptions): Promise<StoredMedia> {
    const allowedMax = Math.max(...options.accept.map((kind) => this.limits[kind]));
    const file = await readUpload(upload, allowedMax);

    return this.storeFile(file, options);
  }

  /** Como `storeUpload`, con el archivo ya leído. */
  async storeFile(file: UploadedFileData, options: StoreUploadOptions): Promise<StoredMedia> {
    const detected = detectFileType(file.buffer);
    // Un WebM puede ser una nota de voz aunque su contenedor sea el de vídeo.
    const acceptable =
      detected !== null &&
      (options.accept.includes(detected.kind) ||
        (detected.mime === 'video/webm' && options.accept.includes('audio')));

    if (!detected || !acceptable) {
      throw new AppException(
        ErrorCode.UnsupportedMedia,
        415,
        `Unsupported file type${detected ? ` "${detected.mime}"` : ''}`,
      );
    }

    if (file.size > this.limits[detected.kind]) {
      throw new AppException(
        ErrorCode.FileTooLarge,
        413,
        `File exceeds the ${Math.round(this.limits[detected.kind] / 1024 / 1024)} MB limit`,
      );
    }

    switch (detected.kind) {
      case 'image':
        return this.storeImage(file.buffer, detected, options);
      case 'video':
      case 'audio':
        return this.storeTimed(file, detected, options);
      case 'file':
        return this.storeDocument(file, detected, options);
    }
  }

  /**
   * Procesa una imagen ya validada y crea su documento.
   *
   * Lo usan las operaciones que sólo aceptan imágenes, como el avatar.
   */
  async createFromUpload(
    file: UploadedFileData,
    preset: ImagePreset,
    owner: MediaOwner = {},
  ): Promise<{ id: string; url: string; width: number | null; height: number | null }> {
    const stored = await this.storeFile(file, { ...owner, accept: ['image'], preset });

    return { id: String(stored._id), url: stored.url, width: stored.width, height: stored.height };
  }

  /**
   * Borra un archivo y lo que tenga en disco.
   *
   * El documento se quita primero y el archivo del disco después: un fallo al
   * borrar el archivo deja basura, que es molesto, mientras que el orden
   * contrario dejaría una imagen rota a la vista, que es peor.
   */
  async remove(mediaId: string | Types.ObjectId): Promise<void> {
    const media = await this.media.findById(mediaId).select('storageKey posterKey').lean();

    if (!media) {
      return;
    }

    await this.media.deleteOne({ _id: mediaId });
    await Promise.all([this.storage.remove(media.storageKey), this.storage.remove(media.posterKey)]);
  }

  /** Borra en bloque, por ejemplo al eliminar una publicación entera. */
  async removeMany(mediaIds: (string | Types.ObjectId)[]): Promise<void> {
    if (mediaIds.length === 0) {
      return;
    }

    const docs = await this.media
      .find({ _id: { $in: mediaIds } })
      .select('storageKey posterKey')
      .lean();

    await this.media.deleteMany({ _id: { $in: mediaIds } });
    await Promise.all(
      docs.flatMap((doc) => [this.storage.remove(doc.storageKey), this.storage.remove(doc.posterKey)]),
    );
  }

  /** Apunta a una publicación archivos subidos antes de que existiera. */
  async attachToPost(mediaIds: Types.ObjectId[], postId: Types.ObjectId): Promise<void> {
    await Promise.all(
      mediaIds.map((mediaId, position) =>
        this.media.updateOne({ _id: mediaId }, { $set: { postId, position } }),
      ),
    );
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

      if (raw.byteLength > this.limits.image) {
        return null;
      }

      const stored = await this.storeFile(
        { buffer: raw, mimetype: 'image/*', originalName: 'avatar', size: raw.byteLength },
        { accept: ['image'], preset: 'avatar', alt },
      );

      return String(stored._id);
    } catch (error) {
      this.logger.warn(`No se pudo importar el avatar remoto: ${describe(error)}`);

      return null;
    }
  }

  private async storeImage(
    input: Buffer,
    detected: DetectedFileType,
    options: StoreUploadOptions,
  ): Promise<StoredMedia> {
    const { buffer, width, height } = await this.transform(
      input,
      IMAGE_PRESETS[options.preset],
      // Un GIF animado sigue animado en el muro y en el chat; en un avatar no
      // tiene sentido y se queda con el primer fotograma.
      detected.mime === 'image/gif' && options.preset !== 'avatar' && options.preset !== 'icon',
    );
    const stored = await this.storage.save(options.preset, 'webp', buffer);

    return this.createDocument(options, {
      type: MediaType.Image,
      url: stored.url,
      storageKey: stored.key,
      mimeType: 'image/webp',
      sizeBytes: buffer.byteLength,
      width,
      height,
    });
  }

  private async storeTimed(
    file: UploadedFileData,
    detected: DetectedFileType,
    options: StoreUploadOptions,
  ): Promise<StoredMedia> {
    const stored = await this.storage.save(options.preset, detected.extension, file.buffer);

    try {
      const probe = await this.video.probe(this.storage.absolutePathOf(stored.key));
      const isAudio = isAudioFile(detected, probe?.hasVideo ?? null, options.accept);
      const durationMs = probe?.durationMs ?? sanitizeDuration(options.durationHintMs);

      if (options.maxDurationMs && durationMs && durationMs > options.maxDurationMs + 1000) {
        throw AppException.badRequest(
          ErrorCode.ValidationFailed,
          `The file lasts more than ${Math.round(options.maxDurationMs / 1000)} seconds`,
        );
      }

      if (!options.accept.includes(isAudio ? 'audio' : 'video')) {
        throw new AppException(
          ErrorCode.UnsupportedMedia,
          415,
          `${isAudio ? 'Audio' : 'Video'} is not accepted here`,
        );
      }

      let poster: { url: string; key: string } | null = null;

      if (!isAudio) {
        const frame = await this.video.poster(this.storage.absolutePathOf(stored.key));

        if (frame) {
          const { buffer } = await this.transform(frame, IMAGE_PRESETS.poster, false);
          const saved = await this.storage.save('poster', 'webp', buffer);
          poster = { url: saved.url, key: saved.key };
        }
      }

      return await this.createDocument(options, {
        type: isAudio ? MediaType.Audio : MediaType.Video,
        url: stored.url,
        storageKey: stored.key,
        mimeType: isAudio && detected.mime === 'video/webm' ? 'audio/webm' : detected.mime,
        sizeBytes: file.size,
        durationMs,
        width: probe?.width ?? null,
        height: probe?.height ?? null,
        posterUrl: poster?.url ?? null,
        posterKey: poster?.key ?? null,
      });
    } catch (error) {
      // Si algo falla después de escribir, el archivo no debe quedarse
      // huérfano en el disco.
      await this.storage.remove(stored.key);
      throw error;
    }
  }

  private async storeDocument(
    file: UploadedFileData,
    detected: DetectedFileType,
    options: StoreUploadOptions,
  ): Promise<StoredMedia> {
    const stored = await this.storage.save('files', detected.extension, file.buffer);

    return this.createDocument(options, {
      type: MediaType.File,
      url: stored.url,
      storageKey: stored.key,
      mimeType: detected.mime,
      sizeBytes: file.size,
      fileName: sanitizeFileName(file.originalName, detected.extension),
    });
  }

  private async createDocument(
    options: StoreUploadOptions,
    fields: Partial<Media> & Pick<Media, 'type' | 'url'>,
  ): Promise<StoredMedia> {
    const created = await this.media.create({
      alt: (options.alt ?? options.preset).slice(0, 255),
      postId: options.postId ?? null,
      productId: options.productId ?? null,
      uploaderId: options.uploaderId ?? null,
      position: options.position ?? 0,
      ...fields,
    });

    return created.toObject();
  }

  private async transform(
    input: Buffer,
    variant: ImageVariant,
    animated: boolean,
  ): Promise<{ buffer: Buffer; width: number | null; height: number | null }> {
    try {
      const pipeline = sharp(input, { failOn: 'error', animated })
        .rotate() // Aplica la orientación EXIF antes de descartar los metadatos.
        .resize({
          width: variant.maxSize,
          height: variant.maxSize,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: variant.quality });

      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        width: info.width,
        // En una imagen animada `height` es la de todos los fotogramas apilados.
        height: info.pageHeight ?? info.height,
      };
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

/**
 * Si un archivo con duración es sonido y no imagen.
 *
 * Un WebM grabado como nota de voz no lleva pista de vídeo aunque su
 * contenedor sea el de un vídeo. Con FFmpeg se mira qué pistas trae; sin él,
 * decide el sitio donde se sube: donde sólo cabe audio, es audio.
 */
function isAudioFile(
  detected: DetectedFileType,
  hasVideoTrack: boolean | null,
  accept: readonly FileKind[],
): boolean {
  if (detected.kind === 'audio') {
    return true;
  }

  if (hasVideoTrack !== null) {
    return !hasVideoTrack;
  }

  return detected.mime === 'video/webm' && !accept.includes('video');
}

/** Una duración declarada por el cliente, sólo si es un número razonable. */
function sanitizeDuration(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 6 * 3600_000
    ? Math.round(value)
    : null;
}

/**
 * El nombre con el que se ofrecerá el documento al descargarlo.
 *
 * Sólo se conservan caracteres inofensivos y se fuerza la extensión real: el
 * nombre lo escribió quien lo subió, y no debe poder disfrazar un tipo por otro.
 */
function sanitizeFileName(name: string, extension: string): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 80);

  return `${base || 'archivo'}.${extension}`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
