/**
 * Los enumerados del dominio, ahora fuera de Prisma.
 *
 * Los generaba el cliente a partir del esquema; sin Prisma hay que declararlos,
 * y el sitio natural es junto a los esquemas de Mongoose, que son los que los
 * usan para validar. Los valores son exactamente los mismos que había en SQL,
 * así que los documentos volcados siguen siendo válidos.
 *
 * Se mantienen alineados con los de `@respet/shared`, que es lo que ve la
 * aplicación; aquí no se importan de allí para que el esquema de la base no
 * dependa del paquete de contratos públicos.
 */
export const UserRole = {
  Visitor: 'visitor',
  User: 'user',
  Roundsman: 'roundsman',
  Supervisor: 'supervisor',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

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

export const MediaType = {
  Image: 'image',
  Video: 'video',
  /** Una nota de voz o cualquier otro sonido. */
  Audio: 'audio',
  Link: 'link',
  /** Un documento adjunto en el chat. */
  File: 'file',
  Other: 'other',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const PostKind = {
  General: 'general',
  Question: 'question',
  Event: 'event',
  Offer: 'offer',
  Request: 'request',
} as const;
export type PostKind = (typeof PostKind)[keyof typeof PostKind];

/** Quién puede ver algo publicado: una publicación, una historia, un directo. */
export const Audience = {
  Public: 'public',
  Followers: 'followers',
  /** Sólo quien lo publicó. */
  OnlyMe: 'only_me',
} as const;
export type Audience = (typeof Audience)[keyof typeof Audience];

/**
 * Sentido de un voto sobre una publicación.
 *
 * Ya no se escribe: las publicaciones reciben reacciones. Se conserva para
 * leer la colección antigua al migrar.
 */
export const VoteValue = {
  Up: 'up',
  Down: 'down',
} as const;
export type VoteValue = (typeof VoteValue)[keyof typeof VoteValue];

/** Las reacciones de Facebook: una por persona en cada cosa. */
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

export const ReportStatus = {
  Pending: 'pending',
  Reviewed: 'reviewed',
  Dismissed: 'dismissed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

/** Qué se denuncia. */
export const ReportTarget = {
  Post: 'post',
  Comment: 'comment',
  User: 'user',
  Story: 'story',
  Message: 'message',
  Live: 'live',
} as const;
export type ReportTarget = (typeof ReportTarget)[keyof typeof ReportTarget];

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

export const MessageKind = {
  Text: 'text',
  /** Una o varias imágenes o vídeos, con texto opcional. */
  Image: 'image',
  Video: 'video',
  /** Nota de voz. */
  Audio: 'audio',
  File: 'file',
  /** Una publicación compartida por privado. */
  PostShare: 'post_share',
  /** Respuesta a una historia: lleva la historia a la que contesta. */
  StoryReply: 'story_reply',
  /** Aviso del propio chat: alguien entró, salió, cambió el nombre… */
  System: 'system',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const MessagePolicy = {
  Everyone: 'everyone',
  Following: 'following',
  Nobody: 'nobody',
} as const;
export type MessagePolicy = (typeof MessagePolicy)[keyof typeof MessagePolicy];

/*
  No se guarda en ningún documento: se deduce de si el vínculo existe y de si
  está pendiente. Vive aquí porque es lo que el esquema publica, y el resto de
  los enumerados que publica están en este archivo.
*/
export const FollowState = {
  None: 'none',
  Requested: 'requested',
  Following: 'following',
} as const;
export type FollowState = (typeof FollowState)[keyof typeof FollowState];

export const ConversationType = {
  Direct: 'direct',
  Group: 'group',
} as const;
export type ConversationType = (typeof ConversationType)[keyof typeof ConversationType];

export const ConversationRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;
export type ConversationRole = (typeof ConversationRole)[keyof typeof ConversationRole];

/** Lo que cuenta un mensaje de sistema. */
export const SystemMessageAction = {
  Created: 'created',
  MembersAdded: 'members_added',
  MemberRemoved: 'member_removed',
  MemberLeft: 'member_left',
  Renamed: 'renamed',
  PhotoChanged: 'photo_changed',
  AdminGranted: 'admin_granted',
} as const;
export type SystemMessageAction = (typeof SystemMessageAction)[keyof typeof SystemMessageAction];

export const StoryKind = {
  Image: 'image',
  Video: 'video',
  /** Texto sobre un fondo de color, sin archivo. */
  Text: 'text',
} as const;
export type StoryKind = (typeof StoryKind)[keyof typeof StoryKind];

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

/** Por qué se cerró una sesión. */
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

/** Con qué se ha demostrado la identidad al abrir una sesión. */
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

/** Cómo guarda sus credenciales una aplicación de terceros. */
export const OAuthClientType = {
  /** Un servidor, capaz de guardar el secreto. */
  Confidential: 'confidential',
  /** Una app móvil o de navegador: no puede guardar secretos y usa PKCE. */
  Public: 'public',
} as const;
export type OAuthClientType = (typeof OAuthClientType)[keyof typeof OAuthClientType];

/**
 * Fase de una aplicación de terceros.
 *
 * Como en Facebook: mientras está en desarrollo sólo la pueden autorizar su
 * dueño y quienes él añada como probadores; al publicarla, cualquiera.
 */
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

/** Resultado del primer paso del inicio de sesión. */
export const LoginStatus = {
  Authenticated: 'authenticated',
  MfaRequired: 'mfa_required',
} as const;
export type LoginStatus = (typeof LoginStatus)[keyof typeof LoginStatus];

export const NotificationEventType = {
  Upserted: 'upserted',
  AllRead: 'all_read',
} as const;
export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export const ChatEventType = {
  MessageCreated: 'message_created',
  MessageUpdated: 'message_updated',
  MessageDeleted: 'message_deleted',
  ReactionsChanged: 'reactions_changed',
  Read: 'read',
  Delivered: 'delivered',
  Typing: 'typing',
  ConversationUpdated: 'conversation_updated',
  ConversationRemoved: 'conversation_removed',
} as const;
export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType];

export const MessageStatus = {
  Sending: 'sending',
  Failed: 'failed',
  Sent: 'sent',
  Delivered: 'delivered',
  Read: 'read',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const LiveEventType = {
  Comment: 'comment',
  Reaction: 'reaction',
  ViewerCount: 'viewer_count',
  Ended: 'ended',
} as const;
export type LiveEventType = (typeof LiveEventType)[keyof typeof LiveEventType];
