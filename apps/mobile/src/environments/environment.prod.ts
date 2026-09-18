import { DEFAULT_BRANDING } from '@social-network/shared';

import { withRuntime, type Environment } from './environment.model';

/**
 * Configuración de producción.
 *
 * Los valores de aquí son los de partida; `env.js`, que escribe el contenedor
 * de la web al arrancar, puede sustituir las direcciones, las claves públicas
 * y la marca sin volver a compilar. En la app nativa no hay contenedor y valen
 * éstos —hasta que responde la API, que manda sobre la marca—.
 */
export const environment: Environment = withRuntime({
  production: true,
  mainUrl: '/',
  apiUrl: 'https://api.example.com',
  graphqlUrl: 'https://api.example.com/graphql',
  googleMapsApiKey: '',
  googleClientId: '',
  facebookAppId: '',
  branding: DEFAULT_BRANDING,
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
});
