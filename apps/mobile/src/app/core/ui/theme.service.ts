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

/** Clase que activa la paleta oscura; sin ella queda la clara, que es la base. */
const DARK_CLASS = 'ion-palette-dark';

/**
 * Tema de la interfaz.
 *
 * El claro es el de partida, como en Facebook e Instagram: la hoja de estilos
 * lo define en `:root` y el oscuro se activa añadiendo una clase. Para que no
 * se vea un destello blanco al arrancar con el oscuro, `index.html` pone la
 * clase antes de que Angular empiece, leyendo la misma preferencia guardada.
 *
 * La opción «seguir al sistema» escucha `prefers-color-scheme`, de modo que
 * cambiar el tema del dispositivo se refleja al momento sin reiniciar.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);

  private readonly preferenceSignal = signal<ThemePreference>(ThemePreference.System);
  private readonly systemPrefersDark = signal(false);

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
    { value: ThemePreference.Light, label: 'THEME.LIGHT', icon: 'sunny-outline' },
    { value: ThemePreference.Dark, label: 'THEME.DARK', icon: 'moon-outline' },
    { value: ThemePreference.System, label: 'THEME.SYSTEM', icon: 'phone-portrait-outline' },
  ];

  private media?: MediaQueryList;

  /** Aplica el tema guardado. La llama `provideAppInitializer`. */
  async restore(): Promise<void> {
    this.watchSystem();

    const stored = await this.storage.get<string>(StorageKey.Theme);

    this.preferenceSignal.set(isPreference(stored) ? stored : ThemePreference.System);
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

    document.documentElement.classList.toggle(DARK_CLASS, dark);
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
