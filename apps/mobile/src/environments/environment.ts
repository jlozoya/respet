import { runtimeEnvironment, type Environment } from './environment.model';

/**
 * Configuración de desarrollo.
 *
 * `environment.prod.ts` la sustituye al compilar para producción, según el
 * `fileReplacements` de `angular.json`.
 *
 * La aplicación no guarda ningún secreto: la autenticación va con tokens que
 * emite la API al iniciar sesión.
 */
export const environment: Environment = {
  production: false,
  mainUrl: '/',
  apiUrl: 'http://localhost:3000',
  graphqlUrl: 'http://localhost:3000/graphql',
  googleMapsApiKey: '',
  googleClientId: '',
  facebookAppId: '',
  facebookPageLink: 'https://www.facebook.com/respet/',
  instagramPageLink: 'https://www.instagram.com/respet/',
  publicMail: 'jlozoya1995@gmail.com',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
  ...runtimeEnvironment(),
};
