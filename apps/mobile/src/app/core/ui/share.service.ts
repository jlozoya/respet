import { Injectable, inject } from '@angular/core';
import { Share } from '@capacitor/share';

import { FeedbackService } from './feedback.service';

export interface ShareContent {
  title: string;
  text: string;
  /** Ruta dentro de la aplicación; se convierte en enlace absoluto. */
  path: string;
}

/**
 * Compartir contenido fuera de la aplicación.
 *
 * Sustituye a `@ionic-native/social-sharing`, un plugin de Cordova sin
 * mantenimiento que además exigía una rama por cada red social. `@capacitor/share`
 * abre el diálogo nativo del sistema, donde el usuario elige la aplicación que
 * ya tiene instalada; en los navegadores que no admiten la Web Share API se
 * recurre a copiar el enlace al portapapeles.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly feedback = inject(FeedbackService);

  async share(content: ShareContent): Promise<void> {
    const url = this.absoluteUrl(content.path);

    try {
      const { value } = await Share.canShare();

      if (value) {
        await Share.share({ title: content.title, text: content.text, url });

        return;
      }
    } catch {
      // Si el plugin falla se prueba igualmente con el portapapeles.
    }

    await this.copyToClipboard(url);
  }

  private async copyToClipboard(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      await this.feedback.toast('SHARE.LINK_COPIED', { color: 'success' });
    } catch {
      await this.feedback.toast('SHARE.ERROR.GENERIC', { color: 'danger' });
    }
  }

  private absoluteUrl(path: string): string {
    // `location.origin` en lugar de una URL fija: así el enlace apunta al
    // mismo sitio desde el que se está usando la aplicación, sea producción o
    // una copia de pruebas.
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
