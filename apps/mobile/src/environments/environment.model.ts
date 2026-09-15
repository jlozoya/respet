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
  /**
   * Raíz de las rutas que siguen siendo HTTP: las subidas de archivos y los
   * enlaces que abre un navegador.
   */
  apiUrl: string;
  /**
   * Dirección del esquema, por donde pasa todo lo demás.
   *
   * Va aparte de `apiUrl` y no colgando de ella porque el esquema no lleva el
   * prefijo `/api`: es una sola dirección, no un árbol de rutas.
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
