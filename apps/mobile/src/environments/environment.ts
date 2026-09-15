import type { Environment } from './environment.model';

/**
 * Configuración de desarrollo.
 *
 * `environment.prod.ts` la sustituye al compilar para producción, según el
 * `fileReplacements` de `angular.json`.
 *
 * Ya no hay `OAUTH_CLIENT_ID` ni `OAUTH_CLIENT_SECRET`: el backend anterior
 * exigía un secreto de cliente que viajaba dentro del binario de la app, de
 * modo que cualquiera podía extraerlo. Con la autenticación por JWT el cliente
 * no necesita guardar ningún secreto.
 */
export const environment: Environment = {
  production: false,
  mainUrl: '/',
  apiUrl: 'http://localhost:3000/api',
  graphqlUrl: 'http://localhost:3000/graphql',
  googleMapsApiKey: '',
  googleClientId: '',
  facebookAppId: '',
  facebookPageLink: 'https://www.facebook.com/respet/',
  instagramPageLink: 'https://www.instagram.com/respet/',
  publicMail: 'jlozoya1995@gmail.com',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
};
