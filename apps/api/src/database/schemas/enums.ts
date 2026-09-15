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
  Link: 'link',
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

export const VoteValue = {
  Up: 'up',
  Down: 'down',
} as const;
export type VoteValue = (typeof VoteValue)[keyof typeof VoteValue];

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

export const MessageKind = {
  Text: 'text',
  Image: 'image',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];
