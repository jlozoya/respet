import { OAuthScope, type OAuthScopeInfo } from '@social-network/shared';

/**
 * Los permisos que puede pedir una aplicación, con lo que se enseña en la
 * pantalla de «¿Autorizar esta aplicación?».
 *
 * `public_profile` va siempre incluido: sin saber quién ha autorizado, una
 * aplicación no puede hacer nada útil, y es lo mismo que ve cualquiera.
 */
export const SCOPE_CATALOG: readonly OAuthScopeInfo[] = [
  {
    scope: OAuthScope.PublicProfile,
    title: 'Perfil público',
    description: 'Tu nombre, nombre de usuario, foto de perfil y cifras públicas.',
    sensitive: false,
  },
  {
    scope: OAuthScope.Email,
    title: 'Correo electrónico',
    description: 'La dirección de correo de tu cuenta.',
    sensitive: true,
  },
  {
    scope: OAuthScope.UserPosts,
    title: 'Publicaciones',
    description: 'Leer las publicaciones y comentarios que tú puedes ver.',
    sensitive: false,
  },
  {
    scope: OAuthScope.PublishPosts,
    title: 'Publicar',
    description: 'Crear, editar y borrar publicaciones y comentarios en tu nombre.',
    sensitive: true,
  },
  {
    scope: OAuthScope.UserFollows,
    title: 'Seguidores',
    description: 'Ver a quién sigues, quién te sigue y personas sugeridas.',
    sensitive: false,
  },
  {
    scope: OAuthScope.ManageFollows,
    title: 'Seguir personas',
    description: 'Seguir y dejar de seguir a personas en tu nombre.',
    sensitive: true,
  },
  {
    scope: OAuthScope.UserStories,
    title: 'Historias',
    description: 'Ver las historias que tú puedes ver.',
    sensitive: false,
  },
  {
    scope: OAuthScope.PublishStories,
    title: 'Publicar historias',
    description: 'Publicar y borrar historias en tu nombre.',
    sensitive: true,
  },
  {
    scope: OAuthScope.ReadMessages,
    title: 'Leer mensajes',
    description: 'Leer tus conversaciones y mensajes privados.',
    sensitive: true,
  },
  {
    scope: OAuthScope.SendMessages,
    title: 'Enviar mensajes',
    description: 'Enviar mensajes privados en tu nombre.',
    sensitive: true,
  },
  {
    scope: OAuthScope.LiveVideos,
    title: 'Directos',
    description: 'Ver los directos en curso y conectarse a ellos.',
    sensitive: false,
  },
  {
    scope: OAuthScope.Notifications,
    title: 'Notificaciones',
    description: 'Leer tus notificaciones.',
    sensitive: false,
  },
];

const BY_SCOPE = new Map(SCOPE_CATALOG.map((info) => [info.scope, info]));

export function isKnownScope(scope: string): boolean {
  return BY_SCOPE.has(scope);
}

export function describeScopes(scopes: readonly string[]): OAuthScopeInfo[] {
  return scopes.map((scope) => BY_SCOPE.get(scope)).filter((info): info is OAuthScopeInfo => info !== undefined);
}

/** Permisos separados por espacios o comas, sin repetir y siempre con el perfil público. */
export function parseScopes(raw: string | undefined | null): string[] {
  const list = (raw ?? '')
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return [...new Set([OAuthScope.PublicProfile, ...list])];
}
