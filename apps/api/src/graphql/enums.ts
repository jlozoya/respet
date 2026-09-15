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

export const VoteValue = esquema(dominio.VoteValue);
export type VoteValue = dominio.VoteValue;

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

export const FollowState = esquema(dominio.FollowState);
export type FollowState = dominio.FollowState;

/** De qué muro se trata: el de todos o el de a quienes se sigue. */
export const PostFeed = { discover: 'discover', following: 'following' } as const;
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

registerEnumType(AuthProvider, {
  name: 'AuthProvider',
  description: 'Con qué se autentica la cuenta.',
});

registerEnumType(Gender, { name: 'Gender' });

registerEnumType(MediaType, { name: 'MediaType' });

registerEnumType(PostKind, {
  name: 'PostKind',
  description: 'Intención de una publicación: se cuenta algo, se ofrece o se pide.',
});

registerEnumType(VoteValue, { name: 'VoteValue' });

registerEnumType(OrderState, { name: 'OrderState' });

registerEnumType(PaymentProvider, { name: 'PaymentProvider' });

registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

registerEnumType(MessageKind, { name: 'MessageKind' });

registerEnumType(MessagePolicy, {
  name: 'MessagePolicy',
  description: 'Quién puede abrir una conversación: cualquiera, a quienes sigo, o nadie.',
});

registerEnumType(FollowState, {
  name: 'FollowState',
  description: 'En qué punto está el seguimiento. `requested` espera respuesta.',
});

registerEnumType(PostFeed, {
  name: 'PostFeed',
  description: '`following` limita el muro a quienes sigue quien consulta.',
});

registerEnumType(RegistrationInterval, { name: 'RegistrationInterval' });
