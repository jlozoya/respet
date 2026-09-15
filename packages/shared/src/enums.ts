/**
 * Enumeraciones del dominio.
 *
 * Se declaran como objetos `const` + tipo derivado en lugar de `enum` de
 * TypeScript para que sean seguras de usar tanto en la API (donde Prisma
 * genera sus propias constantes) como en la app, sin arrastrar código en
 * tiempo de ejecución que el tree shaking no pueda eliminar.
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

export const MediaType = {
  Image: 'image',
  Video: 'video',
  Link: 'link',
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

/** Sentido de un voto sobre una publicación. */
export const VoteValue = {
  Up: 'up',
  Down: 'down',
} as const;
export type VoteValue = (typeof VoteValue)[keyof typeof VoteValue];

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
