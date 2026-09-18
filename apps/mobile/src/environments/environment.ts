import { DEFAULT_BRANDING } from '@social-network/shared';

import { withRuntime, type Environment } from './environment.model';

/**
 * Configuración de desarrollo.
 *
 * `environment.prod.ts` la sustituye al compilar para producción, según el
 * `fileReplacements` de `angular.json`.
 *
 * La aplicación no guarda ningún secreto: la autenticación va con tokens que
 * emite la API al iniciar sesión.
 */
export const environment: Environment = withRuntime({
  production: false,
  mainUrl: '/',
  apiUrl: 'http://localhost:3000',
  graphqlUrl: 'http://localhost:3000/graphql',
  googleMapsApiKey: '',
  googleClientId: '',
  facebookAppId: '',
  branding: DEFAULT_BRANDING,
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
});
