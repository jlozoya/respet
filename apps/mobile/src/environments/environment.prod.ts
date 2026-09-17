import { runtimeEnvironment, type Environment } from './environment.model';

/**
 * Configuración de producción.
 *
 * Los valores de aquí son los de partida; `env.js`, que escribe el contenedor
 * de la web al arrancar, puede sustituir las direcciones y las claves públicas
 * sin volver a compilar. En la app nativa no hay contenedor y valen éstos.
 */
export const environment: Environment = {
  production: true,
  mainUrl: '/',
  apiUrl: 'https://api.respet.app',
  graphqlUrl: 'https://api.respet.app/graphql',
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
