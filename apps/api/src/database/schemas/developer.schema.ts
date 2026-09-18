import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { OAuthAppStatus, OAuthClientType, WebhookDeliveryStatus } from './enums.js';

/** Suscripción de una aplicación a los eventos de la plataforma. */
@Schema({ _id: false })
export class WebhookSettings {
  @Prop({ type: String, default: null })
  url!: string | null;

  /** Eventos a los que se suscribe: `post.created`, `comment.created`… */
  @Prop({ type: [String], default: [] })
  events!: string[];

  /**
   * Secreto con el que se firma cada entrega, cifrado.
   *
   * La aplicación lo usa para comprobar que el aviso viene de verdad de
   * la API; hay que poder recuperarlo para firmar, así que no basta un hash.
   */
  @Prop({ type: String, default: null })
  secretCiphertext!: string | null;

  @Prop({ default: false })
  active!: boolean;

  /** Cuándo respondió bien al reto de verificación de la dirección. */
  @Prop({ type: Date, default: null })
  verifiedAt!: Date | null;
}

export const WebhookSettingsSchema = SchemaFactory.createForClass(WebhookSettings);

/**
 * Una aplicación de terceros registrada en el portal para desarrolladores.
 *
 * Es el equivalente de una app de Facebook: tiene su identificador público y
 * su secreto, las direcciones a las que se permite volver tras autorizarla,
 * los permisos que puede pedir y, opcionalmente, un webhook.
 */
@Schema({ collection: 'oauth_apps', timestamps: true })
export class OAuthApp {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, default: null })
  websiteUrl!: string | null;

  @Prop({ type: String, default: null })
  privacyPolicyUrl!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  iconId!: Types.ObjectId | null;

  /** Identificador público: viaja en las URL de autorización. */
  @Prop({ required: true, unique: true })
  clientId!: string;

  /** Hash del secreto. El secreto en claro sólo se enseña al crearlo o rotarlo. */
  @Prop({ type: String, default: null })
  clientSecretHash!: string | null;

  /** Los últimos caracteres del secreto, para reconocerlo en el panel. */
  @Prop({ type: String, default: null })
  clientSecretHint!: string | null;

  @Prop({ type: String, enum: Object.values(OAuthClientType), default: OAuthClientType.Confidential })
  clientType!: OAuthClientType;

  @Prop({ type: String, enum: Object.values(OAuthAppStatus), default: OAuthAppStatus.Development })
  status!: OAuthAppStatus;

  @Prop({ type: [String], default: [] })
  redirectUris!: string[];

  /** Permisos que la aplicación puede llegar a pedir. */
  @Prop({ type: [String], default: [] })
  allowedScopes!: string[];

  /** Personas que pueden autorizarla mientras está en desarrollo, además del dueño. */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
  testerIds!: Types.ObjectId[];

  @Prop({ type: WebhookSettingsSchema, default: () => ({}) })
  webhook!: WebhookSettings;

  /** Tope propio de peticiones por hora y persona; nulo usa el general. */
  @Prop({ type: Number, default: null })
  rateLimitPerHour!: number | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type OAuthAppDocument = HydratedDocument<OAuthApp>;
export const OAuthAppSchema = SchemaFactory.createForClass(OAuthApp);

OAuthAppSchema.virtual('icon', {
  ref: 'Media',
  localField: 'iconId',
  foreignField: '_id',
  justOne: true,
});

OAuthAppSchema.virtual('owner', {
  ref: 'User',
  localField: 'ownerId',
  foreignField: '_id',
  justOne: true,
});

OAuthAppSchema.set('toObject', { virtuals: true });
OAuthAppSchema.set('toJSON', { virtuals: true });

/** Código de autorización de un solo uso, a medio camino del intercambio por tokens. */
@Schema({ collection: 'oauth_codes', timestamps: { createdAt: true, updatedAt: false } })
export class OAuthAuthorizationCode {
  @Prop({ required: true, unique: true })
  codeHash!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'OAuthApp', required: true })
  appId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  redirectUri!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  /** PKCE: el reto que tendrá que resolver quien canjee el código. */
  @Prop({ type: String, default: null })
  codeChallenge!: string | null;

  @Prop({ type: String, default: null })
  codeChallengeMethod!: 'S256' | 'plain' | null;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;
}

export type OAuthAuthorizationCodeDocument = HydratedDocument<OAuthAuthorizationCode>;
export const OAuthAuthorizationCodeSchema = SchemaFactory.createForClass(OAuthAuthorizationCode);

OAuthAuthorizationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

/**
 * El consentimiento de una persona a una aplicación.
 *
 * Mientras exista sin revocar, la aplicación actúa en su nombre con esos
 * permisos, y volver a pasar por la pantalla de autorización no pregunta lo
 * que ya se concedió. Retirarlo desde «Apps y sitios web» invalida en el acto
 * todos los tokens que cuelgan de él.
 */
@Schema({ collection: 'oauth_grants', timestamps: true })
export class OAuthGrant {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'OAuthApp', required: true })
  appId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type OAuthGrantDocument = HydratedDocument<OAuthGrant>;
export const OAuthGrantSchema = SchemaFactory.createForClass(OAuthGrant);

OAuthGrantSchema.index({ appId: 1, userId: 1 }, { unique: true });

OAuthGrantSchema.virtual('app', {
  ref: 'OAuthApp',
  localField: 'appId',
  foreignField: '_id',
  justOne: true,
});

OAuthGrantSchema.set('toObject', { virtuals: true });
OAuthGrantSchema.set('toJSON', { virtuals: true });

/** Refresh token de una aplicación de terceros. Rota en cada uso, como los propios. */
@Schema({ collection: 'oauth_refresh_tokens', timestamps: true })
export class OAuthRefreshToken {
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'OAuthGrant', required: true, index: true })
  grantId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  rotatedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export type OAuthRefreshTokenDocument = HydratedDocument<OAuthRefreshToken>;
export const OAuthRefreshTokenSchema = SchemaFactory.createForClass(OAuthRefreshToken);

OAuthRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

/** Una entrega de webhook, con sus reintentos. */
@Schema({ collection: 'webhook_deliveries', timestamps: true })
export class WebhookDelivery {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'OAuthApp', required: true })
  appId!: Types.ObjectId;

  @Prop({ required: true })
  event!: string;

  /**
   * Huella del hecho que se entrega.
   *
   * Con varias instancias detrás de Redis, cada una recibe el mismo evento del
   * bus y trataría de encolarlo; el índice único sobre la huella y la
   * aplicación hace que sólo cuente la primera.
   */
  @Prop({ required: true })
  dedupeKey!: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({
    type: String,
    enum: Object.values(WebhookDeliveryStatus),
    default: WebhookDeliveryStatus.Pending,
  })
  status!: WebhookDeliveryStatus;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true })
  nextAttemptAt!: Date;

  @Prop({ type: Number, default: null })
  responseStatus!: number | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  @Prop({ type: Date, default: null })
  deliveredAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WebhookDeliveryDocument = HydratedDocument<WebhookDelivery>;
export const WebhookDeliverySchema = SchemaFactory.createForClass(WebhookDelivery);

WebhookDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
WebhookDeliverySchema.index({ appId: 1, dedupeKey: 1 }, { unique: true });
WebhookDeliverySchema.index({ appId: 1, createdAt: -1 });
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/** Peticiones de una aplicación por hora, para el límite y para su panel. */
@Schema({ collection: 'api_usage', timestamps: false })
export class ApiUsage {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'OAuthApp', required: true })
  appId!: Types.ObjectId;

  /** Inicio de la hora, en UTC. */
  @Prop({ type: Date, required: true })
  hour!: Date;

  @Prop({ default: 0 })
  requests!: number;

  /* `errors` a secas es un nombre reservado por Mongoose. */
  @Prop({ default: 0 })
  errorCount!: number;
}

export type ApiUsageDocument = HydratedDocument<ApiUsage>;
export const ApiUsageSchema = SchemaFactory.createForClass(ApiUsage);

ApiUsageSchema.index({ appId: 1, hour: -1 }, { unique: true });
ApiUsageSchema.index({ hour: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
