import { Injectable, computed, inject, signal } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { StorageKey, StorageService } from '../storage/storage.service';

/** Preferencia del usuario, no el tema que acaba aplicándose. */
export const ThemePreference = {
  Dark: 'dark',
  Light: 'light',
  System: 'system',
} as const;

export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];

/** Clase que activa la paleta clara; sin ella queda la oscura, que es la base. */
const LIGHT_CLASS = 'ion-palette-light';

/**
 * Tema de la interfaz.
 *
 * El oscuro es el de partida, así que la hoja de estilos lo define en `:root`
 * y el claro se activa añadiendo una clase. Hacerlo en ese orden —y no al
 * revés, como sugiere Ionic— evita el destello blanco que se vería mientras
 * arranca la aplicación.
 *
 * La opción «seguir al sistema» escucha `prefers-color-scheme`, de modo que
 * cambiar el tema del dispositivo se refleja al momento sin reiniciar.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);

  private readonly preferenceSignal = signal<ThemePreference>(ThemePreference.Dark);
  private readonly systemPrefersDark = signal(true);

  readonly preference = this.preferenceSignal.asReadonly();

  /** Tema realmente aplicado, ya resuelta la opción «seguir al sistema». */
  readonly isDark = computed(() => {
    const preference = this.preferenceSignal();

    if (preference === ThemePreference.System) {
      return this.systemPrefersDark();
    }

    return preference === ThemePreference.Dark;
  });

  readonly options = [
    { value: ThemePreference.Dark, label: 'THEME.DARK', icon: 'moon-outline' },
    { value: ThemePreference.Light, label: 'THEME.LIGHT', icon: 'sunny-outline' },
    { value: ThemePreference.System, label: 'THEME.SYSTEM', icon: 'phone-portrait-outline' },
  ];

  private media?: MediaQueryList;

  /** Aplica el tema guardado. La llama `provideAppInitializer`. */
  async restore(): Promise<void> {
    this.watchSystem();

    const stored = await this.storage.get<string>(StorageKey.Theme);

    this.preferenceSignal.set(isPreference(stored) ? stored : ThemePreference.Dark);
    this.apply();
  }

  async use(preference: ThemePreference): Promise<void> {
    this.preferenceSignal.set(preference);
    this.apply();
    await this.storage.set(StorageKey.Theme, preference);
  }

  /** Alterna entre claro y oscuro, dejando de seguir al sistema. */
  async toggle(): Promise<void> {
    await this.use(this.isDark() ? ThemePreference.Light : ThemePreference.Dark);
  }

  private apply(): void {
    const dark = this.isDark();

    document.documentElement.classList.toggle(LIGHT_CLASS, !dark);
    // `color-scheme` hace que el navegador pinte con el tema correcto las
    // partes que no controlamos: barras de desplazamiento y controles nativos.
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    void this.syncStatusBar(dark);
  }

  private watchSystem(): void {
    if (this.media || typeof window.matchMedia !== 'function') {
      return;
    }

    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark.set(this.media.matches);

    this.media.addEventListener('change', (event) => {
      this.systemPrefersDark.set(event.matches);

      // Sólo repercute si el usuario eligió seguir al sistema; con una
      // preferencia explícita, el cambio del dispositivo no debe pisarla.
      if (this.preferenceSignal() === ThemePreference.System) {
        this.apply();
      }
    });
  }

  /** Ajusta la barra de estado del móvil para que no quede ilegible. */
  private async syncStatusBar(dark: boolean): Promise<void> {
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    } catch {
      // En el navegador el plugin no existe, y no pasa nada.
    }
  }
}

function isPreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}
