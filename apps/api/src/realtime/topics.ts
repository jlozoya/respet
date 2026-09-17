/**
 * Los temas del bus de eventos.
 *
 * Se escriben en un solo sitio porque quien publica y quien escucha viven en
 * módulos distintos: un nombre tecleado a mano en cada lado es un evento que
 * un día se publica en un tema que nadie escucha, sin que nada lo avise.
 */
export const Topic = {
  /**
   * Todo lo dirigido a una persona: mensajes, lecturas, notificaciones,
   * cambios en sus conversaciones. Cada conexión de esa persona escucha el
   * suyo, de modo que lo recibe en todos sus dispositivos a la vez.
   */
  user: (userId: string): string => `user:${userId}`,

  /** Quién se conecta y quién se va. Se filtra por interesado al entregarlo. */
  presence: 'presence',

  /** Comentarios, reacciones y audiencia de un directo. */
  live: (streamId: string): string => `live:${streamId}`,

  /** Una sesión cerrada: sus conexiones abiertas deben caer en todas las instancias. */
  sessionRevoked: 'auth:session-revoked',

  /** Una aplicación de terceros a la que alguien ha retirado el acceso. */
  grantRevoked: 'auth:grant-revoked',

  /**
   * Hechos del dominio que interesan fuera de su módulo: los webhooks de las
   * aplicaciones de terceros y las notificaciones escuchan aquí.
   */
  domain: (event: DomainEventName): string => `domain:${event}`,
} as const;

/** Hechos del dominio que se anuncian por el bus. */
export const DomainEvent = {
  PostCreated: 'post.created',
  PostDeleted: 'post.deleted',
  CommentCreated: 'comment.created',
  ReactionAdded: 'reaction.added',
  FollowCreated: 'follow.created',
  StoryCreated: 'story.created',
  LiveStarted: 'live.started',
  LiveEnded: 'live.ended',
  MessageCreated: 'message.created',
  UserUpdated: 'user.updated',
} as const;

export type DomainEventName = (typeof DomainEvent)[keyof typeof DomainEvent];
