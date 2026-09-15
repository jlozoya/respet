import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { SupportedLanguage } from '../../../environments/environment.model';
import { StorageKey, StorageService } from '../storage/storage.service';

/**
 * Idioma de la interfaz.
 *
 * Decide con qué idioma arranca la aplicación —el guardado, si lo hay; si no,
 * el del dispositivo; y en último término el de por defecto— y lo mantiene
 * sincronizado entre `TranslateService`, el almacenamiento local y el perfil
 * del usuario en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly storage = inject(StorageService);

  private readonly currentSignal = signal<SupportedLanguage>(environment.defaultLanguage);

  readonly current = this.currentSignal.asReadonly();
  readonly available = computed(() =>
    environment.supportedLanguages.map((code) => ({ code, label: LANGUAGE_LABELS[code] ?? code })),
  );

  /** Aplica el idioma inicial. La llama `provideAppInitializer`. */
  async restore(): Promise<void> {
    const stored = await this.storage.get<string>(StorageKey.Language);
    const browser = this.translate.getBrowserLang();

    await this.apply(this.normalize(stored ?? browser), { persist: false });
  }

  /**
   * Cambia el idioma de la interfaz.
   *
   * @param persist guarda la elección en el dispositivo (por defecto, sí).
   */
  async use(lang: string, options: { persist?: boolean } = {}): Promise<void> {
    await this.apply(this.normalize(lang), { persist: options.persist ?? true });
  }

  /** Idioma admitido más cercano al indicado, con respaldo en el de por defecto. */
  normalize(lang: string | null | undefined): SupportedLanguage {
    const code = lang?.toLowerCase().split('-')[0];

    return (environment.supportedLanguages as readonly string[]).includes(code ?? '')
      ? (code as SupportedLanguage)
      : environment.defaultLanguage;
  }

  private async apply(lang: SupportedLanguage, options: { persist: boolean }): Promise<void> {
    await firstValueFrom(this.translate.use(lang));
    this.currentSignal.set(lang);
    document.documentElement.lang = lang;

    if (options.persist) {
      await this.storage.set(StorageKey.Language, lang);
    }
  }
}

const LANGUAGE_LABELS: Record<string, string> = {
  es: 'Español',
  en: 'English',
};
