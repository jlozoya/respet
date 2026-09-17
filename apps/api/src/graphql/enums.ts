import { registerEnumType } from '@nestjs/graphql';

import * as dominio from '../database/schemas/enums.js';

/**
 * Los enumerados del dominio, tal y como los ve el esquema.
 *
 * Hay un paso intermedio y no es capricho. En el dominio se declaran con
 * nombres legibles —`PostKind.General`— y valores en minúscula, que son los
 * que guarda Mongo y los que espera la aplicación. GraphQL, en cambio, toma
 * como valor del enumerado la *clave* del objeto que se le registra: registrar
 * el del dominio tal cual haría que una publicación viajara como `General` y
 * la app, que compara con `'general'`, dejaría de reconocerla.
 *
 * `esquema` le da la vuelta al objeto para que clave y valor coincidan. El
 * tipo de TypeScript sigue siendo la misma unión de cadenas, así que los
 * servicios no se enteran de nada.
 *
 * Este archivo se importa por su efecto: basta cargarlo una vez —lo hace
 * `GraphqlApiModule`— para que todos queden registrados.
 */
type Invertido<T extends Record<string, string>> = { [K in T[keyof T]]: K };

function esquema<T extends Record<string, string>>(origen: T): Invertido<T> {
  return Object.fromEntries(
    Object.values(origen).map((valor) => [valor, valor]),
  ) as Invertido<T>;
}

export const UserRole = esquema(dominio.UserRole);
export type UserRole = dominio.UserRole;

export const AuthProvider = esquema(dominio.AuthProvider);
export type AuthProvider = dominio.AuthProvider;

export const Gender = esquema(dominio.Gender);
export type Gender = dominio.Gender;

export const MediaType = esquema(dominio.MediaType);
export type MediaType = dominio.MediaType;

export const PostKind = esquema(dominio.PostKind);
export type PostKind = dominio.PostKind;

export const Audience = esquema(dominio.Audience);
export type Audience = dominio.Audience;

export const ReactionType = esquema(dominio.ReactionType);
export type ReactionType = dominio.ReactionType;

export const ReportTarget = esquema(dominio.ReportTarget);
export type ReportTarget = dominio.ReportTarget;

export const ReportStatus = esquema(dominio.ReportStatus);
export type ReportStatus = dominio.ReportStatus;

export const OrderState = esquema(dominio.OrderState);
export type OrderState = dominio.OrderState;

export const PaymentProvider = esquema(dominio.PaymentProvider);
export type PaymentProvider = dominio.PaymentProvider;

export const PaymentStatus = esquema(dominio.PaymentStatus);
export type PaymentStatus = dominio.PaymentStatus;

export const MessageKind = esquema(dominio.MessageKind);
export type MessageKind = dominio.MessageKind;

export const MessagePolicy = esquema(dominio.MessagePolicy);
export type MessagePolicy = dominio.MessagePolicy;

export const MessageStatus = esquema(dominio.MessageStatus);
export type MessageStatus = dominio.MessageStatus;

export const FollowState = esquema(dominio.FollowState);
export type FollowState = dominio.FollowState;

export const ConversationType = esquema(dominio.ConversationType);
export type ConversationType = dominio.ConversationType;

export const ConversationRole = esquema(dominio.ConversationRole);
export type ConversationRole = dominio.ConversationRole;

export const SystemMessageAction = esquema(dominio.SystemMessageAction);
export type SystemMessageAction = dominio.SystemMessageAction;

export const ChatEventType = esquema(dominio.ChatEventType);
export type ChatEventType = dominio.ChatEventType;

export const StoryKind = esquema(dominio.StoryKind);
export type StoryKind = dominio.StoryKind;

export const LiveStatus = esquema(dominio.LiveStatus);
export type LiveStatus = dominio.LiveStatus;

export const LiveEventType = esquema(dominio.LiveEventType);
export type LiveEventType = dominio.LiveEventType;

export const NotificationType = esquema(dominio.NotificationType);
export type NotificationType = dominio.NotificationType;

export const NotificationEventType = esquema(dominio.NotificationEventType);
export type NotificationEventType = dominio.NotificationEventType;

export const SessionEndReason = esquema(dominio.SessionEndReason);
export type SessionEndReason = dominio.SessionEndReason;

export const AuthMethod = esquema(dominio.AuthMethod);
export type AuthMethod = dominio.AuthMethod;

export const MfaMethod = esquema(dominio.MfaMethod);
export type MfaMethod = dominio.MfaMethod;

export const SecurityEventType = esquema(dominio.SecurityEventType);
export type SecurityEventType = dominio.SecurityEventType;

export const DeviceType = esquema(dominio.DeviceType);
export type DeviceType = dominio.DeviceType;

export const LoginStatus = esquema(dominio.LoginStatus);
export type LoginStatus = dominio.LoginStatus;

export const OAuthClientType = esquema(dominio.OAuthClientType);
export type OAuthClientType = dominio.OAuthClientType;

export const OAuthAppStatus = esquema(dominio.OAuthAppStatus);
export type OAuthAppStatus = dominio.OAuthAppStatus;

export const WebhookDeliveryStatus = esquema(dominio.WebhookDeliveryStatus);
export type WebhookDeliveryStatus = dominio.WebhookDeliveryStatus;

/** De qué muro se trata. */
export const PostFeed = { home: 'home', discover: 'discover', following: 'following' } as const;
export type PostFeed = (typeof PostFeed)[keyof typeof PostFeed];

/** Agrupación temporal del histórico de altas. */
export const RegistrationInterval = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
} as const;
export type RegistrationInterval =
  (typeof RegistrationInterval)[keyof typeof RegistrationInterval];

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'Rol de una cuenta. Son jerárquicos: `admin` cubre a los demás.',
});
registerEnumType(AuthProvider, { name: 'AuthProvider', description: 'Con qué se autentica la cuenta.' });
registerEnumType(Gender, { name: 'Gender' });
registerEnumType(MediaType, { name: 'MediaType' });
registerEnumType(PostKind, {
  name: 'PostKind',
  description: 'Intención de una publicación: se cuenta algo, se ofrece o se pide.',
});
registerEnumType(Audience, { name: 'Audience', description: 'Quién puede ver lo publicado.' });
registerEnumType(ReactionType, { name: 'ReactionType', description: 'Las reacciones de una publicación.' });
registerEnumType(ReportTarget, { name: 'ReportTarget' });
registerEnumType(ReportStatus, { name: 'ReportStatus' });
registerEnumType(OrderState, { name: 'OrderState' });
registerEnumType(PaymentProvider, { name: 'PaymentProvider' });
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });
registerEnumType(MessageKind, { name: 'MessageKind' });
registerEnumType(MessagePolicy, {
  name: 'MessagePolicy',
  description: 'Quién puede abrir una conversación: cualquiera, a quienes sigo, o nadie.',
});
registerEnumType(MessageStatus, {
  name: 'MessageStatus',
  description: 'Hasta dónde ha llegado un mensaje propio: enviado, entregado o leído.',
});
registerEnumType(FollowState, {
  name: 'FollowState',
  description: 'En qué punto está el seguimiento. `requested` espera respuesta.',
});
registerEnumType(ConversationType, { name: 'ConversationType' });
registerEnumType(ConversationRole, { name: 'ConversationRole' });
registerEnumType(SystemMessageAction, { name: 'SystemMessageAction' });
registerEnumType(ChatEventType, { name: 'ChatEventType' });
registerEnumType(StoryKind, { name: 'StoryKind' });
registerEnumType(LiveStatus, { name: 'LiveStatus' });
registerEnumType(LiveEventType, { name: 'LiveEventType' });
registerEnumType(NotificationType, { name: 'NotificationType' });
registerEnumType(NotificationEventType, { name: 'NotificationEventType' });
registerEnumType(SessionEndReason, { name: 'SessionEndReason' });
registerEnumType(AuthMethod, { name: 'AuthMethod' });
registerEnumType(MfaMethod, { name: 'MfaMethod' });
registerEnumType(SecurityEventType, { name: 'SecurityEventType' });
registerEnumType(DeviceType, { name: 'DeviceType' });
registerEnumType(LoginStatus, {
  name: 'LoginStatus',
  description: '`mfa_required` pide completar el inicio de sesión con el segundo factor.',
});
registerEnumType(OAuthClientType, { name: 'OAuthClientType' });
registerEnumType(OAuthAppStatus, { name: 'OAuthAppStatus' });
registerEnumType(WebhookDeliveryStatus, { name: 'WebhookDeliveryStatus' });
registerEnumType(PostFeed, {
  name: 'PostFeed',
  description:
    '`home` mezcla lo de quienes sigues con lo destacado; `following` sólo lo de quienes sigues; `discover`, todo.',
});
registerEnumType(RegistrationInterval, { name: 'RegistrationInterval' });
