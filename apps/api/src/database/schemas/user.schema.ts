import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { AuthProvider, Gender, UserRole } from './enums.js';

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

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  locationId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ name: 1 });
UserSchema.index({ createdAt: -1 });

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

/** Preferencias de privacidad: qué datos de contacto ve el resto. */
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

  @Prop({ type: String, default: null })
  replacedByHash!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ip!: string | null;
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
