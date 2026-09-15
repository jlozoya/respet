import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  mainUrl: '/',
  apiUrl: 'https://lozoya.biz/respet_back/api',
  graphqlUrl: 'https://lozoya.biz/respet_back/graphql',
  googleMapsApiKey: '',
  googleClientId: '',
  facebookAppId: '',
  facebookPageLink: 'https://www.facebook.com/respet/',
  instagramPageLink: 'https://www.instagram.com/respet/',
  publicMail: 'jlozoya1995@gmail.com',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
};
