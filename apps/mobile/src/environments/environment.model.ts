/**
 * Forma de la configuración de entorno.
 *
 * Vive en su propio archivo porque `angular.json` sustituye `environment.ts`
 * por `environment.prod.ts` al compilar para producción: si el tipo se
 * declarara en el primero, el segundo no tendría de dónde importarlo.
 */
export interface Environment {
  production: boolean;
  /** Ruta a la que se entra tras iniciar sesión. */
  mainUrl: string;
  /** Raíz pública de la API: `/health`, `/uploads` y los extremos de OAuth. */
  apiUrl: string;
  /**
   * Dirección del esquema, por donde pasa toda la API: consultas, mutaciones
   * y archivos. Las suscripciones usan la misma dirección con `ws://` o
   * `wss://`.
   */
  graphqlUrl: string;
  googleMapsApiKey: string;
  /** Id de cliente web de OAuth de Google, el mismo que usa el servidor. */
  googleClientId: string;
  facebookAppId: string;
  facebookPageLink: string;
  instagramPageLink: string;
  publicMail: string;
  defaultLanguage: SupportedLanguage;
  supportedLanguages: readonly SupportedLanguage[];
}

export type SupportedLanguage = 'es' | 'en';

/**
 * Lo que se puede cambiar sin volver a compilar.
 *
 * La imagen de Docker de la web escribe `env.js` al arrancar a partir de sus
 * variables de entorno; así la misma imagen sirve para pruebas y para
 * producción, cada una con sus direcciones.
 */
export type RuntimeEnvironment = Partial<
  Pick<
    Environment,
    'apiUrl' | 'graphqlUrl' | 'googleMapsApiKey' | 'googleClientId' | 'facebookAppId' | 'publicMail'
  >
>;

/** Lee `window.__RESPET_ENV__`, quitando lo que llegue vacío. */
export function runtimeEnvironment(): RuntimeEnvironment {
  const raw = (globalThis as { __RESPET_ENV__?: Record<string, unknown> }).__RESPET_ENV__ ?? {};

  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => typeof value === 'string' && value.length > 0),
  );
}
