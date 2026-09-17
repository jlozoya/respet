import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import {
  AuthMethod,
  AuthProvider,
  DeviceType,
  Gender,
  MessagePolicy,
  SecurityEventType,
  SessionEndReason,
  UserRole,
} from './enums.js';

/**
 * Cuentas y todo lo que cuelga de ellas.
 *
 * Al dejar SQL, los documentos guardan sus campos en `camelCase` en lugar del
 * `snake_case` que venía de las columnas: en Mongo el documento se lee tal cual
 * desde JavaScript, y traducir nombres en cada consulta sólo añadía ruido.
 *
 * Las relaciones son referencias por `ObjectId`, no documentos incrustados. Un
 * usuario aparece en sus publicaciones, en sus comentarios y en sus mensajes;
 * incrustarlo obligaría a reescribir media base cada vez que alguien cambia su
 * avatar.
 */
@Schema({ collection: 'users', timestamps: true })
export class User {
  /** Nombre de usuario, apto para una dirección web. Va en la URL del perfil. */
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  /** Hash Argon2id. Nulo en cuentas creadas con un proveedor social. */
  @Prop({ type: String, default: null })
  passwordHash!: string | null;

  @Prop({ type: String, enum: Object.values(Gender), default: null })
  gender!: Gender | null;

  @Prop({ type: String, default: null })
  phone!: string | null;

  @Prop({ type: Date, default: null })
  birthday!: Date | null;

  @Prop({ default: 'es' })
  lang!: string;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.User, index: true })
  role!: UserRole;

  @Prop({ type: String, enum: Object.values(AuthProvider), default: AuthProvider.Password })
  provider!: AuthProvider;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  avatarId!: Types.ObjectId | null;

  /** Foto de portada del perfil, la franja ancha de arriba. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  coverId!: Types.ObjectId | null;

  /** Presentación breve que se lee bajo el nombre. */
  @Prop({ type: String, default: null })
  bio!: string | null;

  @Prop({ type: String, default: null })
  website!: string | null;

  /** Insignia de cuenta verificada. Sólo la concede la administración. */
  @Prop({ default: false })
  verified!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  locationId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  /** Cuándo cerró la última conexión en vivo. */
  @Prop({ type: Date, default: null })
  lastSeenAt!: Date | null;

  /**
   * Copia de si tiene un segundo factor activo.
   *
   * La verdad está en `mfa_factors`; esto sólo ahorra una consulta en cada
   * inicio de sesión, que es donde hay que decidirlo.
   */
  @Prop({ default: false })
  mfaEnabled!: boolean;

  /* Lo escribe `timestamps`; se declara para poder leerlo con tipos. */
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ name: 1 });
UserSchema.index({ createdAt: -1 });
// Buscador de personas: por nombre de usuario y por nombre visible.
UserSchema.index({ name: 'text', firstName: 'text', lastName: 'text' });

/**
 * Avatar, ubicación, privacidad y datos de contacto de una cuenta.
 *
 * Los virtuales no se guardan: describen por dónde buscar. `toJSON` y
 * `toObject` los incluyen para que los mapeadores vean el documento completo.
 */
UserSchema.virtual('avatar', {
  ref: 'Media',
  localField: 'avatarId',
  foreignField: '_id',
  justOne: true,
});

UserSchema.virtual('cover', {
  ref: 'Media',
  localField: 'coverId',
  foreignField: '_id',
  justOne: true,
});

UserSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true,
});

UserSchema.virtual('permissions', {
  ref: 'UserPermissions',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

UserSchema.virtual('emails', {
  ref: 'UserEmail',
  localField: '_id',
  foreignField: 'userId',
});

UserSchema.virtual('phones', {
  ref: 'UserPhone',
  localField: '_id',
  foreignField: 'userId',
});

UserSchema.virtual('socialLinks', {
  ref: 'SocialLink',
  localField: '_id',
  foreignField: 'userId',
});

UserSchema.set('toObject', { virtuals: true });
UserSchema.set('toJSON', { virtuals: true });

/** Preferencias de la cuenta: qué ve el resto y quién puede acercarse. */
@Schema({ collection: 'user_permissions', timestamps: true })
export class UserPermissions {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ default: true })
  showMainEmail!: boolean;

  @Prop({ default: true })
  showAlternativeEmails!: boolean;

  @Prop({ default: true })
  showMainPhone!: boolean;

  @Prop({ default: true })
  showAlternativePhones!: boolean;

  @Prop({ default: true })
  showLocation!: boolean;

  @Prop({ default: true })
  receiveMailAds!: boolean;

  @Prop({ type: String, enum: Object.values(MessagePolicy), default: MessagePolicy.Everyone })
  messagePolicy!: MessagePolicy;

  /*
    Con el perfil privado, seguir pasa por solicitud. Por defecto no: cambiar
    el comportamiento de las cuentas que ya existen no es cosa de un despliegue.
  */
  @Prop({ default: false })
  privateProfile!: boolean;

  /** Si los demás ven cuándo está conectada. Quien lo apaga tampoco ve el de nadie. */
  @Prop({ default: true })
  showOnlineStatus!: boolean;

  /** Quién puede contestar a sus historias. */
  @Prop({ type: String, enum: Object.values(MessagePolicy), default: MessagePolicy.Everyone })
  storyReplyPolicy!: MessagePolicy;

  /** Correo de aviso cuando se entra en la cuenta desde un dispositivo nuevo. */
  @Prop({ default: true })
  loginAlerts!: boolean;
}

export type UserPermissionsDocument = HydratedDocument<UserPermissions>;
export const UserPermissionsSchema = SchemaFactory.createForClass(UserPermissions);

@Schema({ collection: 'user_emails', timestamps: { createdAt: true, updatedAt: false } })
export class UserEmail {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  email!: string;
}

export type UserEmailDocument = HydratedDocument<UserEmail>;
export const UserEmailSchema = SchemaFactory.createForClass(UserEmail);

UserEmailSchema.index({ userId: 1, email: 1 }, { unique: true });

@Schema({ collection: 'user_phones', timestamps: { createdAt: true, updatedAt: false } })
export class UserPhone {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  phone!: string;
}

export type UserPhoneDocument = HydratedDocument<UserPhone>;
export const UserPhoneSchema = SchemaFactory.createForClass(UserPhone);

UserPhoneSchema.index({ userId: 1, phone: 1 }, { unique: true });

@Schema({ collection: 'social_links', timestamps: { createdAt: true, updatedAt: false } })
export class SocialLink {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AuthProvider), required: true })
  provider!: AuthProvider;

  @Prop({ required: true })
  externalId!: string;
}

export type SocialLinkDocument = HydratedDocument<SocialLink>;
export const SocialLinkSchema = SchemaFactory.createForClass(SocialLink);

SocialLinkSchema.index({ provider: 1, externalId: 1 }, { unique: true });

/** Con qué se ha abierto una sesión, tal y como se lee del agente de usuario. */
@Schema({ _id: false })
export class DeviceInfo {
  @Prop({ type: String, enum: Object.values(DeviceType), default: DeviceType.Unknown })
  type!: DeviceType;

  /** «Chrome en Windows», «App de Respet en Android»… */
  @Prop({ default: 'Unknown device' })
  name!: string;

  @Prop({ type: String, default: null })
  browser!: string | null;

  @Prop({ type: String, default: null })
  os!: string | null;
}

export const DeviceInfoSchema = SchemaFactory.createForClass(DeviceInfo);

/**
 * Una sesión abierta en un dispositivo.
 *
 * Sustituye a la colección de refresh tokens sueltos. Antes cada renovación
 * dejaba un documento nuevo y no había forma de responder a «¿en qué
 * dispositivos tengo la cuenta abierta?»; ahora una sesión es una fila con su
 * dispositivo, su última actividad y el hash del refresh token vigente, que
 * rota en cada uso.
 *
 * Los tokens que ya se han usado se guardan —sólo el hash— en
 * `retiredTokenHashes`: si alguno vuelve a aparecer es que se ha copiado, y se
 * cierra esta sesión en concreto en lugar de todas las de la persona.
 */
@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  refreshTokenHash!: string;

  /** Los últimos hashes ya canjeados, para detectar su reutilización. */
  @Prop({ type: [String], default: [] })
  retiredTokenHashes!: string[];

  @Prop({ type: Date, default: null })
  rotatedAt!: Date | null;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;

  /** Caduca si no se usa antes de esta fecha. Cada renovación la retrasa. */
  @Prop({ type: Date, required: true })
  idleExpiresAt!: Date;

  /** Caducidad absoluta: por mucho que se use, aquí termina. */
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, enum: Object.values(SessionEndReason), default: null })
  revokedReason!: SessionEndReason | null;

  @Prop({ type: [String], enum: Object.values(AuthMethod), default: [] })
  authMethods!: AuthMethod[];

  @Prop({ type: DeviceInfoSchema, default: () => ({}) })
  device!: DeviceInfo;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ip!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ userId: 1, revokedAt: 1, lastUsedAt: -1 });
// Las sesiones se conservan un mes después de caducar, para el historial de
// dispositivos; luego las borra Mongo solo.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/** Un código de recuperación, del que sólo se guarda el hash. */
@Schema({ _id: false })
export class RecoveryCode {
  @Prop({ required: true })
  hash!: string;

  @Prop({ type: Date, default: null })
  usedAt!: Date | null;
}

export const RecoveryCodeSchema = SchemaFactory.createForClass(RecoveryCode);

/**
 * Segundo factor de una cuenta: una app de autenticación (TOTP).
 *
 * El secreto se guarda cifrado con `MFA_ENCRYPTION_KEY`, no en claro ni con
 * un hash: hay que poder recuperarlo para calcular el código esperado. Una
 * copia de la base sin la clave no sirve para generar códigos.
 */
@Schema({ collection: 'mfa_factors', timestamps: true })
export class MfaFactor {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  secretCiphertext!: string;

  /** Nulo mientras se configura: no cuenta hasta que se confirma con un código. */
  @Prop({ type: Date, default: null })
  confirmedAt!: Date | null;

  /**
   * El último intervalo de 30 segundos cuyo código se aceptó.
   *
   * Un código TOTP vale medio minuto; sin esto, quien lo viera por encima del
   * hombro podría usarlo también dentro de esa ventana.
   */
  @Prop({ type: Number, default: null })
  lastUsedStep!: number | null;

  @Prop({ type: [RecoveryCodeSchema], default: [] })
  recoveryCodes!: RecoveryCode[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type MfaFactorDocument = HydratedDocument<MfaFactor>;
export const MfaFactorSchema = SchemaFactory.createForClass(MfaFactor);

/**
 * Un inicio de sesión a medias: la contraseña era buena y falta el código.
 *
 * El token viaja al cliente y vuelve con el código; aquí sólo está su hash.
 * Caduca en cinco minutos y admite pocos intentos.
 */
@Schema({ collection: 'mfa_challenges', timestamps: { createdAt: true, updatedAt: false } })
export class MfaChallenge {
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  /** Con qué se superó el primer paso. */
  @Prop({ type: String, enum: Object.values(AuthMethod), required: true })
  firstFactor!: AuthMethod;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;
}

export type MfaChallengeDocument = HydratedDocument<MfaChallenge>;
export const MfaChallengeSchema = SchemaFactory.createForClass(MfaChallenge);

MfaChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Un dispositivo en el que se pidió no volver a preguntar el código.
 *
 * El cliente guarda un token y lo presenta al iniciar sesión; si coincide con
 * uno vigente de la misma cuenta, se omite el segundo factor.
 */
@Schema({ collection: 'trusted_devices', timestamps: true })
export class TrustedDevice {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: DeviceInfoSchema, default: () => ({}) })
  device!: DeviceInfo;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  createdAt!: Date;
}

export type TrustedDeviceDocument = HydratedDocument<TrustedDevice>;
export const TrustedDeviceSchema = SchemaFactory.createForClass(TrustedDevice);

TrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Intentos fallidos contra una misma clave: un correo, un reto de 2FA.
 *
 * El límite por IP no basta frente a quien reparte los intentos entre muchas
 * direcciones; éste cuenta por cuenta atacada y la bloquea un rato, cada vez
 * más largo. Se aplica igual a correos que no existen, para no delatar cuáles
 * están dados de alta.
 */
@Schema({ collection: 'auth_throttles', timestamps: true })
export class AuthThrottle {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ default: 0 })
  failures!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export type AuthThrottleDocument = HydratedDocument<AuthThrottle>;
export const AuthThrottleSchema = SchemaFactory.createForClass(AuthThrottle);

AuthThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Registro de actividad de seguridad de una cuenta.
 *
 * Es lo que la persona ve en «Actividad de seguridad»: accesos, cambios de
 * contraseña, segundo factor, sesiones cerradas. Se guarda medio año.
 */
@Schema({ collection: 'security_events', timestamps: { createdAt: true, updatedAt: false } })
export class SecurityEvent {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(SecurityEventType), required: true })
  type!: SecurityEventType;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: DeviceInfoSchema, default: null })
  device!: DeviceInfo | null;

  /** Detalles propios de cada tipo: la aplicación autorizada, el método usado… */
  @Prop({ type: SchemaTypes.Mixed, default: null })
  metadata!: Record<string, unknown> | null;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  createdAt!: Date;
}

export type SecurityEventDocument = HydratedDocument<SecurityEvent>;
export const SecurityEventSchema = SchemaFactory.createForClass(SecurityEvent);

SecurityEventSchema.index({ userId: 1, createdAt: -1 });
SecurityEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Bloqueo: `blocker` no quiere saber nada de `blocked`.
 *
 * Mientras exista, ninguno de los dos ve lo del otro, no se pueden seguir ni
 * escribirse. Se guarda en un solo sentido y se consulta en los dos.
 */
@Schema({ collection: 'blocks', timestamps: { createdAt: true, updatedAt: false } })
export class Block {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  blockerId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  blockedId!: Types.ObjectId;

  createdAt!: Date;
}

export type BlockDocument = HydratedDocument<Block>;
export const BlockSchema = SchemaFactory.createForClass(Block);

BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

BlockSchema.virtual('blocked', {
  ref: 'User',
  localField: 'blockedId',
  foreignField: '_id',
  justOne: true,
});

BlockSchema.set('toObject', { virtuals: true });
BlockSchema.set('toJSON', { virtuals: true });

/**
 * Restos del sistema anterior de sesiones.
 *
 * Ya no se escriben. Se conserva el esquema para poder vaciar la colección
 * al migrar, sin que el modelo desaparezca de golpe.
 */
@Schema({ collection: 'refresh_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

@Schema({ collection: 'password_resets', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordReset {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt!: Date | null;
}

export type PasswordResetDocument = HydratedDocument<PasswordReset>;
export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

@Schema({ collection: 'email_verifications', timestamps: { createdAt: true, updatedAt: false } })
export class EmailVerification {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt!: Date | null;
}

export type EmailVerificationDocument = HydratedDocument<EmailVerification>;
export const EmailVerificationSchema = SchemaFactory.createForClass(EmailVerification);
