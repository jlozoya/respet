import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';

export interface ProbeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
}

/**
 * Lo que se le saca a un vídeo o a un audio con FFmpeg.
 *
 * Dos cosas: la duración y medidas —para reservar el hueco antes de cargarlo y
 * para limitar las historias a su minuto— y un fotograma de portada, que es lo
 * que se ve en el muro hasta que se pulsa reproducir.
 *
 * FFmpeg es opcional. Si no está instalado todo sigue funcionando: los vídeos
 * se guardan sin portada y con la duración que diga el cliente. La imagen de
 * Docker lo trae, así que en producción no falta.
 */
@Injectable()
export class VideoProcessorService implements OnModuleInit {
  private readonly logger = new Logger(VideoProcessorService.name);
  private readonly ffmpeg: string;
  private readonly ffprobe: string;
  private available = false;

  constructor(config: ConfigService) {
    this.ffmpeg = config.get<string>('storage.ffmpegPath') ?? 'ffmpeg';
    this.ffprobe = config.get<string>('storage.ffprobePath') ?? 'ffprobe';
  }

  async onModuleInit(): Promise<void> {
    this.available = (await this.run(this.ffprobe, ['-version'], 5000)) !== null;

    if (!this.available) {
      this.logger.warn('FFmpeg no está disponible: los vídeos se guardarán sin portada');
    }
  }

  get enabled(): boolean {
    return this.available;
  }

  async probe(path: string): Promise<ProbeResult | null> {
    if (!this.available) {
      return null;
    }

    const output = await this.run(
      this.ffprobe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
      20_000,
    );

    if (!output) {
      return null;
    }

    try {
      const parsed = JSON.parse(output.toString('utf8')) as {
        format?: { duration?: string };
        streams?: { codec_type?: string; width?: number; height?: number; tags?: { rotate?: string } }[];
      };
      const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
      const seconds = Number(parsed.format?.duration);
      // Los móviles graban en horizontal y apuntan el giro en una etiqueta; las
      // medidas que importan son las ya giradas.
      const rotated = Math.abs(Number(video?.tags?.rotate ?? 0)) % 180 === 90;

      return {
        durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
        width: (rotated ? video?.height : video?.width) ?? null,
        height: (rotated ? video?.width : video?.height) ?? null,
        hasVideo: video !== undefined,
      };
    } catch {
      return null;
    }
  }

  /** Un fotograma cerca del principio, en JPEG, o `null` si no se pudo. */
  async poster(path: string): Promise<Buffer | null> {
    if (!this.available) {
      return null;
    }

    return this.run(
      this.ffmpeg,
      ['-v', 'error', '-ss', '0.5', '-i', path, '-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'],
      30_000,
    );
  }

  private run(command: string, args: string[], timeoutMs: number): Promise<Buffer | null> {
    return new Promise((resolve) => {
      let settled = false;
      const chunks: Buffer[] = [];

      const finish = (value: Buffer | null): void => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      try {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          finish(null);
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.on('error', () => {
          clearTimeout(timer);
          finish(null);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          finish(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
        });
      } catch {
        finish(null);
      }
    });
  }
}
