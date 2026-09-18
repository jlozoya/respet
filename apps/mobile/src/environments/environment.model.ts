import { DEFAULT_BRANDING, type Branding } from '@social-network/shared';

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
  /**
   * La marca con la que arranca la aplicación.
   *
   * Es sólo el punto de partida, para no pintar la primera pantalla sin
   * nombre ni color: `BrandingService` pide la de verdad a la API —que la saca
   * de sus variables `APP_*`— y la aplica en cuanto llega.
   */
  branding: Branding;
  defaultLanguage: SupportedLanguage;
  supportedLanguages: readonly SupportedLanguage[];
}

export type SupportedLanguage = 'es' | 'en';

/**
 * Lo que se puede cambiar sin volver a compilar.
 *
 * La imagen de Docker de la web escribe `env.js` al arrancar a partir de sus
 * variables de entorno; así la misma imagen sirve para pruebas y para
 * producción, cada una con sus direcciones y su marca.
 */
export type RuntimeEnvironment = Partial<
  Pick<Environment, 'apiUrl' | 'graphqlUrl' | 'googleMapsApiKey' | 'googleClientId' | 'facebookAppId'>
> & { branding?: Partial<Branding> };

/** Las claves de la marca que pueden llegar en `env.js`, todas de texto. */
const BRANDING_KEYS = Object.keys(DEFAULT_BRANDING) as (keyof Branding)[];

/**
 * Lee `window.__APP_ENV__`, quitando lo que llegue vacío.
 *
 * La marca viaja plana —`appName`, `appLogoUrl`…— porque escribir un objeto
 * anidado desde un script de arranque de Docker sería mucho más frágil.
 */
export function runtimeEnvironment(): RuntimeEnvironment {
  const raw = (globalThis as { __APP_ENV__?: Record<string, unknown> }).__APP_ENV__ ?? {};
  const filled = Object.entries(raw).filter(
    ([, value]) => typeof value === 'string' && value.length > 0,
  ) as [string, string][];

  const runtime: RuntimeEnvironment = {};
  const branding: Partial<Branding> = {};

  for (const [key, value] of filled) {
    const brandingKey = BRANDING_KEYS.find((candidate) => `app${capitalize(candidate)}` === key);

    if (brandingKey) {
      branding[brandingKey] = value;
      continue;
    }

    (runtime as Record<string, string>)[key] = value;
  }

  return Object.keys(branding).length > 0 ? { ...runtime, branding } : runtime;
}

/**
 * Lo compilado, con lo que haya escrito `env.js` encima.
 *
 * La marca se mezcla campo a campo: un despliegue puede cambiar sólo el nombre
 * y quedarse con los colores de partida.
 */
export function withRuntime(base: Environment): Environment {
  const runtime = runtimeEnvironment();

  return {
    ...base,
    ...runtime,
    branding: { ...base.branding, ...runtime.branding },
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
