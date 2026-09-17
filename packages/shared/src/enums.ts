/**
 * Enumeraciones del dominio.
 *
 * Se declaran como objetos `const` + tipo derivado en lugar de `enum` de
 * TypeScript para que sean seguras de usar tanto en la API como en la app,
 * sin arrastrar código en tiempo de ejecución que el tree shaking no pueda
 * eliminar.
 */

export const UserRole = {
  Visitor: 'visitor',
  User: 'user',
  Roundsman: 'roundsman',
  Supervisor: 'supervisor',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Orden jerárquico de los roles: un rol cubre los permisos de los anteriores. */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  UserRole.Visitor,
  UserRole.User,
  UserRole.Roundsman,
  UserRole.Supervisor,
  UserRole.Admin,
];

export const AuthProvider = {
  Password: 'password',
  Google: 'google',
  Facebook: 'facebook',
  Apple: 'apple',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const Gender = {
  Male: 'male',
  Female: 'female',
  /**
   * Quien prefiere no decirlo.
   *
   * Se llamaba `other`, que obligaba a reconocerse en un cajón de sastre; lo
   * que la aplicación ofrece —y lo que esto guarda— es la decisión de no
   * declararlo.
   */
  Unspecified: 'unspecified',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/** Quién puede abrir una conversación con alguien, o contestar a sus historias. */
export const MessagePolicy = {
  /** Cualquiera con cuenta. */
  Everyone: 'everyone',
  /** Sólo aquellos a quienes uno sigue: hace falta el gesto previo. */
  Following: 'following',
  /** Nadie. Las conversaciones que ya existen siguen abiertas. */
  Nobody: 'nobody',
} as const;
export type MessagePolicy = (typeof MessagePolicy)[keyof typeof MessagePolicy];

/**
 * En qué punto está el seguimiento, visto por quien mira.
 *
 * Con el perfil privado seguir deja de ser inmediato, así que «sí o no» ya no
 * alcanza: entre medias está lo pedido y aún sin responder.
 */
export const FollowState = {
  None: 'none',
  Requested: 'requested',
  Following: 'following',
} as const;
export type FollowState = (typeof FollowState)[keyof typeof FollowState];

export const MediaType = {
  Image: 'image',
  Video: 'video',
  Audio: 'audio',
  Link: 'link',
  File: 'file',
  Other: 'other',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

/**
 * Intención de una publicación.
 *
 * Sustituye al antiguo `PostState` —perdido, encontrado, en adopción—, que daba
 * por hecho que lo publicado era un animal. `Offer` y `Request` recogen esos
 * casos sin nombrarlos: se ofrece algo o se pide ayuda, sea lo que sea.
 */
export const PostKind = {
  General: 'general',
  Question: 'question',
  Event: 'event',
  Offer: 'offer',
  Request: 'request',
} as const;
export type PostKind = (typeof PostKind)[keyof typeof PostKind];

/** Quién puede ver lo publicado. */
export const Audience = {
  Public: 'public',
  Followers: 'followers',
  OnlyMe: 'only_me',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

/** Las reacciones de una publicación, como en Facebook. */
export const ReactionType = {
  Like: 'like',
  Love: 'love',
  Care: 'care',
  Haha: 'haha',
  Wow: 'wow',
  Sad: 'sad',
  Angry: 'angry',
} as const;
export type ReactionType = (typeof ReactionType)[keyof typeof ReactionType];

/** El emoji con que se pinta cada reacción. */
export const REACTION_EMOJI: Readonly<Record<ReactionType, string>> = {
  like: '👍',
  love: '❤️',
  care: '🤗',
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

export const ReportTarget = {
  Post: 'post',
  Comment: 'comment',
  User: 'user',
  Story: 'story',
  Message: 'message',
  Live: 'live',
} as const;
export type ReportTarget = (typeof ReportTarget)[keyof typeof ReportTarget];

export const ReportStatus = {
  Pending: 'pending',
  Reviewed: 'reviewed',
  Dismissed: 'dismissed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const OrderState = {
  OnCreate: 'on_create',
  Stored: 'stored',
  OnTransit: 'on_transit',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
} as const;
export type OrderState = (typeof OrderState)[keyof typeof OrderState];

export const PaymentProvider = {
  PayPal: 'paypal',
  Stripe: 'stripe',
  Cash: 'cash',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  Pending: 'pending',
  Completed: 'completed',
  Failed: 'failed',
  Refunded: 'refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const SupportedLanguage = {
  Spanish: 'es',
  English: 'en',
} as const;
export type SupportedLanguage = (typeof SupportedLanguage)[keyof typeof SupportedLanguage];

export const StoryKind = {
  Image: 'image',
  Video: 'video',
  Text: 'text',
} as const;
export type StoryKind = (typeof StoryKind)[keyof typeof StoryKind];

/** Fondos disponibles para una historia de texto. */
export const STORY_BACKGROUNDS = [
  'sunset',
  'ocean',
  'forest',
  'berry',
  'night',
  'sand',
  'coral',
  'mint',
] as const;
export type StoryBackground = (typeof STORY_BACKGROUNDS)[number];

export const STORY_FONTS = ['classic', 'modern', 'typewriter', 'bold'] as const;
export type StoryFont = (typeof STORY_FONTS)[number];

export const LiveStatus = {
  Live: 'live',
  Ended: 'ended',
} as const;
export type LiveStatus = (typeof LiveStatus)[keyof typeof LiveStatus];

export const NotificationType = {
  Reaction: 'reaction',
  Comment: 'comment',
  Reply: 'reply',
  CommentLike: 'comment_like',
  Mention: 'mention',
  Follow: 'follow',
  FollowRequest: 'follow_request',
  FollowAccepted: 'follow_accepted',
  StoryReaction: 'story_reaction',
  LiveStarted: 'live_started',
  PostShared: 'post_shared',
  SecurityAlert: 'security_alert',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const SessionEndReason = {
  Logout: 'logout',
  RevokedByUser: 'revoked_by_user',
  PasswordChanged: 'password_changed',
  ReuseDetected: 'reuse_detected',
  MfaChanged: 'mfa_changed',
  AccountDeleted: 'account_deleted',
  Admin: 'admin',
  Expired: 'expired',
} as const;
export type SessionEndReason = (typeof SessionEndReason)[keyof typeof SessionEndReason];

export const AuthMethod = {
  Password: 'password',
  Google: 'google',
  Facebook: 'facebook',
  Apple: 'apple',
  Totp: 'totp',
  RecoveryCode: 'recovery_code',
  TrustedDevice: 'trusted_device',
  Registration: 'registration',
} as const;
export type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod];

export const MfaMethod = {
  Totp: 'totp',
  RecoveryCode: 'recovery_code',
} as const;
export type MfaMethod = (typeof MfaMethod)[keyof typeof MfaMethod];

export const SecurityEventType = {
  Login: 'login',
  LoginFailed: 'login_failed',
  MfaFailed: 'mfa_failed',
  Logout: 'logout',
  SessionRevoked: 'session_revoked',
  RefreshReuseDetected: 'refresh_reuse_detected',
  PasswordChanged: 'password_changed',
  PasswordReset: 'password_reset',
  EmailChanged: 'email_changed',
  MfaEnabled: 'mfa_enabled',
  MfaDisabled: 'mfa_disabled',
  RecoveryCodesRegenerated: 'recovery_codes_regenerated',
  RecoveryCodeUsed: 'recovery_code_used',
  TrustedDeviceRevoked: 'trusted_device_revoked',
  AppAuthorized: 'app_authorized',
  AppRevoked: 'app_revoked',
} as const;
export type SecurityEventType = (typeof SecurityEventType)[keyof typeof SecurityEventType];

export const DeviceType = {
  Desktop: 'desktop',
  Mobile: 'mobile',
  Tablet: 'tablet',
  Unknown: 'unknown',
} as const;
export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];

/** Resultado del primer paso del inicio de sesión. */
export const LoginStatus = {
  /** Sesión abierta. */
  Authenticated: 'authenticated',
  /** Falta el código del segundo factor. */
  MfaRequired: 'mfa_required',
} as const;
export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];

export const OAuthClientType = {
  Confidential: 'confidential',
  Public: 'public',
} as const;
export type OAuthClientType = (typeof OAuthClientType)[keyof typeof OAuthClientType];

export const OAuthAppStatus = {
  Development: 'development',
  Live: 'live',
  Suspended: 'suspended',
} as const;
export type OAuthAppStatus = (typeof OAuthAppStatus)[keyof typeof OAuthAppStatus];

export const WebhookDeliveryStatus = {
  Pending: 'pending',
  Delivered: 'delivered',
  Failed: 'failed',
} as const;
export type WebhookDeliveryStatus =
  (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

/**
 * Permisos que puede pedir una aplicación de terceros.
 *
 * Con los nombres de la Graph API de Facebook, que es lo que conoce quien
 * integra redes sociales. `public_profile` se concede siempre.
 */
export const OAuthScope = {
  PublicProfile: 'public_profile',
  Email: 'email',
  UserPosts: 'user_posts',
  PublishPosts: 'publish_posts',
  UserFollows: 'user_follows',
  ManageFollows: 'manage_follows',
  UserStories: 'user_stories',
  PublishStories: 'publish_stories',
  ReadMessages: 'read_messages',
  SendMessages: 'send_messages',
  LiveVideos: 'live_videos',
  Notifications: 'notifications',
} as const;
export type OAuthScope = (typeof OAuthScope)[keyof typeof OAuthScope];

export const ALL_OAUTH_SCOPES: readonly OAuthScope[] = Object.values(OAuthScope);

/** Eventos a los que puede suscribirse el webhook de una aplicación. */
export const WEBHOOK_EVENTS = [
  'post.created',
  'post.deleted',
  'comment.created',
  'reaction.added',
  'follow.created',
  'story.created',
  'live.started',
  'live.ended',
  'message.created',
  'user.updated',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
