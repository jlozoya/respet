import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuración de Capacitor 8.
 *
 * Pasa de JSON a TypeScript para que el editor valide las claves y avise de
 * las que ya no existen. `bundledWebRuntime` desapareció en Capacitor 4 y
 * `cordova` ya no hace falta: la app usa plugins nativos de Capacitor.
 */
const config: CapacitorConfig = {
  appId: 'io.lozoya.respet',
  appName: 'Respet',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  server: {
    // `androidScheme: 'https'` es obligatorio desde Capacitor 4 para que el
    // WebView considere seguro el origen y permita cosas como la cámara.
    androidScheme: 'https',
  },
};

export default config;
