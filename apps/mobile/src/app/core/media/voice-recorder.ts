import { signal } from '@angular/core';

/** Una nota de voz grabada, lista para enviar. */
export interface VoiceNote {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

/** Tope de una nota de voz, como en WhatsApp o Messenger tiene poco sentido pasar de aquí. */
const MAX_DURATION_MS = 5 * 60 * 1000;

/**
 * Grabadora de notas de voz con `MediaRecorder`.
 *
 * Funciona igual en el navegador y dentro de la app nativa, cuyo WebView
 * expone el micrófono. Prefiere Opus en WebM, que es lo que graban Chrome y
 * Android, y recurre a MP4/AAC en Safari.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private limit: ReturnType<typeof setTimeout> | null = null;

  readonly recording = signal(false);
  readonly elapsedMs = signal(0);

  static get supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );

    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.start(250);
    this.startedAt = Date.now();
    this.elapsedMs.set(0);
    this.recording.set(true);
    this.ticker = setInterval(() => this.elapsedMs.set(Date.now() - this.startedAt), 200);
    this.limit = setTimeout(() => this.recorder?.stop(), MAX_DURATION_MS);
  }

  /** Para la grabación y devuelve la nota. */
  stop(): Promise<VoiceNote | null> {
    const recorder = this.recorder;

    if (!recorder) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const durationMs = Date.now() - this.startedAt;
        const blob = new Blob(this.chunks, { type: mimeType.split(';')[0] });

        this.release();
        resolve(durationMs < 500 || blob.size === 0 ? null : { blob, durationMs, mimeType });
      };

      if (recorder.state === 'inactive') {
        recorder.onstop?.(new Event('stop'));
      } else {
        recorder.stop();
      }
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }

    this.release();
  }

  private release(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
    }

    if (this.limit) {
      clearTimeout(this.limit);
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.recording.set(false);
  }
}
