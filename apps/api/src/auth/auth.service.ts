import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthSession, AuthTokens, User as PublicUser } from '@respet/shared';

import { InjectModel } from '@nestjs/mongoose';
import type { Model } from '../database/mongoose.js';

import { AppException, ErrorCode } from '../common/errors.js';
import { POPULATE_USER, toUser } from '../common/mappers.js';
import { Follow, Media } from '../database/schemas/content.schema.js';
import { AuthProvider, MediaType } from '../database/schemas/enums.js';
import {
  EmailVerification,
  PasswordReset,
  SocialLink,
  User,
  UserPermissions,
} from '../database/schemas/user.schema.js';
import { MailService } from '../mail/mail.service.js';
import {
  PasswordService,
  createSingleUseToken,
  hashSingleUseToken,
} from './password.service.js';
import { TokenService, type TokenContext } from './token.service.js';
import { SocialVerifierService, type VerifiedIdentity } from './social/social-verifier.service.js';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
} from './dto/auth.dto.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    @InjectModel(SocialLink.name) private readonly socialLinks: Model<SocialLink>,
    @InjectModel(PasswordReset.name) private readonly resets: Model<PasswordReset>,
    @InjectModel(EmailVerification.name) private readonly verifications: Model<EmailVerification>,
    @InjectModel(Media.name) private readonly media: Model<Media>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly social: SocialVerifierService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, context: TokenContext): Promise<AuthSession> {
    const existing = await this.users.exists({ email: dto.email });

    if (existing) {
      throw AppException.conflict(
        ErrorCode.UserAlreadyExists,
        'That email address is already registered',
      );
    }

    const created = await this.users.create({
      name: dto.name,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      lang: dto.lang ?? 'es',
      gender: dto.gender ?? null,
      birthday: dto.birthday ? new Date(dto.birthday) : null,
      provider: AuthProvider.Password,
      role: 'user',
    });

    // Toda cuenta nueva estrena sus preferencias de privacidad, para que
    // ninguna parte del código tenga que tratar el caso «sin permisos».
    await this.permissions.create({ userId: created._id });

    const userId = String(created._id);

    await this.sendVerificationEmail(userId, created.email, created.name, created.lang);

    return this.buildSession(userId, context);
  }

  async login(dto: LoginDto, context: TokenContext): Promise<AuthSession> {
    const user = await this.users.findOne({ email: dto.email }).lean();

    if (!user?.passwordHash) {
      // Se gasta el mismo tiempo que en una verificación real para que no se
      // pueda deducir qué correos están dados de alta midiendo la respuesta.
      await this.passwords.fakeVerify();
      throw AppException.invalidCredentials();
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      throw AppException.invalidCredentials();
    }

    // Si el hash se generó con parámetros ya desfasados, se actualiza ahora que
    // tenemos la contraseña en claro.
    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.updateOne(
        { _id: user._id },
        { $set: { passwordHash: await this.passwords.hash(dto.password) } },
      );
    }

    return this.completeLogin(String(user._id), context);
  }

  async socialLogin(dto: SocialLoginDto, context: TokenContext): Promise<AuthSession> {
    const identity = await this.social.verify(dto.provider, dto.token);
    const userId = await this.resolveSocialUser(identity, dto.lang);

    return this.completeLogin(userId, context);
  }

  async refresh(refreshToken: string, context: TokenContext): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken, context);
  }

  async logout(refreshToken: string | undefined, userId: string, everywhere: boolean): Promise<void> {
    if (everywhere || !refreshToken) {
      await this.tokens.revokeAllForUser(userId);

      return;
    }

    await this.tokens.revoke(refreshToken);
  }

  /**
   * Inicia la recuperación de contraseña.
   *
   * Responde igual exista o no la cuenta: lo contrario convertiría este
   * formulario en un buscador de correos registrados.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.users
      .findOne({ email: dto.email })
      .select('name email lang passwordHash')
      .lean();

    if (!user?.passwordHash) {
      this.logger.debug(`Password reset requested for an unknown or social account: ${dto.email}`);

      return;
    }

    // Sólo puede haber una solicitud viva a la vez: pedir un enlace nuevo
    // invalida el anterior.
    await this.resets.updateMany(
      { userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } },
    );

    const { token, hash } = createSingleUseToken();

    await this.resets.create({
      userId: user._id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    const url = `${this.config.getOrThrow<string>('clientUrl')}/reset-password?token=${token}`;
    await this.mail.sendPasswordReset(user.email, user.name, url, dto.lang ?? user.lang);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.resets
      .findOne({ tokenHash: hashSingleUseToken(dto.token) })
      .lean();

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw AppException.badToken('The reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    // El enlace se marca como gastado ANTES de tocar la contraseña: si algo
    // falla en medio, el peor caso es un enlace quemado sin efecto, no un
    // enlace todavía válido después de haberse usado.
    await this.resets.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } });
    await this.users.updateOne({ _id: record.userId }, { $set: { passwordHash } });

    // Cambiar la contraseña debe echar de todas las sesiones abiertas: es la
    // única forma de recuperar una cuenta ya comprometida.
    await this.tokens.revokeAllForUser(String(record.userId));
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId).select('passwordHash').lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (!user.passwordHash) {
      throw AppException.badRequest(
        ErrorCode.IncorrectUser,
        'This account signs in with an external provider and has no password',
      );
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw AppException.invalidCredentials();
    }

    await this.users.updateOne(
      { _id: userId },
      { $set: { passwordHash: await this.passwords.hash(dto.newPassword) } },
    );

    await this.tokens.revokeAllForUser(userId);
  }

  /** Confirma una dirección de correo a partir del enlace enviado. */
  async verifyEmail(token: string): Promise<void> {
    const record = await this.verifications
      .findOne({ tokenHash: hashSingleUseToken(token) })
      .lean();

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw AppException.badToken('The confirmation link is invalid or has expired');
    }

    await this.verifications.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } });
    await this.users.updateOne(
      { _id: record.userId },
      { $set: { email: record.email, emailVerified: true } },
    );
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users
      .findById(userId)
      .select('email name lang emailVerified')
      .lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (user.emailVerified) {
      return;
    }

    await this.sendVerificationEmail(userId, user.email, user.name, user.lang);
  }

  async me(userId: string): Promise<PublicUser> {
    return this.findPublicUser(userId);
  }

  /**
   * Crea, si hace falta, el registro de confirmación y envía el correo.
   *
   * Se usa tanto al registrarse como al cambiar de dirección, por eso recibe el
   * correo a confirmar en lugar de leerlo del usuario.
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    name: string,
    lang: string,
  ): Promise<void> {
    await this.verifications.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    );

    const { token, hash } = createSingleUseToken();

    await this.verifications.create({
      userId,
      email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });

    const url = `${this.config.getOrThrow<string>('appUrl')}/${this.config.getOrThrow<string>(
      'apiPrefix',
    )}/auth/verify-email?token=${token}`;

    await this.mail.sendVerifyEmail(email, name, url, lang);
  }

  /**
   * Decide a qué cuenta corresponde una identidad externa.
   *
   * Hay tres casos: el vínculo ya existe, existe un usuario con ese correo al
   * que hay que enlazar la cuenta, o no hay nada y se crea todo desde cero.
   */
  private async resolveSocialUser(identity: VerifiedIdentity, lang?: string): Promise<string> {
    const link = await this.socialLinks
      .findOne({ provider: identity.provider, externalId: identity.externalId })
      .select('userId')
      .lean();

    if (link) {
      return String(link.userId);
    }

    const byEmail = await this.users.findOne({ email: identity.email }).select('_id').lean();

    if (byEmail) {
      // Sólo se enlaza automáticamente si el proveedor garantiza que el correo
      // está verificado; si no, cualquiera podría abrir una cuenta con el
      // correo ajeno en un proveedor laxo y quedarse con la cuenta de Respet.
      if (!identity.emailVerified) {
        throw AppException.conflict(
          ErrorCode.UserSocialAlreadyUsed,
          'That email is already registered; sign in with your password and link the account from your profile',
        );
      }

      await this.socialLinks.create({
        userId: byEmail._id,
        provider: identity.provider,
        externalId: identity.externalId,
      });

      await this.users.updateOne({ _id: byEmail._id }, { $set: { emailVerified: true } });

      return String(byEmail._id);
    }

    // El avatar se crea antes que la cuenta porque la cuenta lo referencia.
    const avatar = identity.avatarUrl
      ? await this.media.create({
          type: MediaType.Image,
          url: identity.avatarUrl,
          alt: identity.name.slice(0, 255),
        })
      : null;

    const created = await this.users.create({
      name: identity.name.slice(0, 60),
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: identity.email,
      emailVerified: identity.emailVerified,
      provider: identity.provider,
      lang: lang ?? 'es',
      role: 'user',
      avatarId: avatar?._id ?? null,
    });

    await Promise.all([
      this.permissions.create({ userId: created._id }),
      this.socialLinks.create({
        userId: created._id,
        provider: identity.provider,
        externalId: identity.externalId,
      }),
    ]);

    return String(created._id);
  }

  private async completeLogin(userId: string, context: TokenContext): Promise<AuthSession> {
    await this.users.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });

    return this.buildSession(userId, context);
  }

  private async buildSession(userId: string, context: TokenContext): Promise<AuthSession> {
    const user = await this.findPublicUser(userId);
    const tokens = await this.tokens.issue(
      { id: user.id, email: user.email, role: user.role },
      context,
    );

    return { ...tokens, user };
  }

  /** La cuenta tal y como sale hacia fuera, con sus relaciones ya pobladas. */
  private async findPublicUser(userId: string): Promise<PublicUser> {
    const [doc, followerCount, followingCount] = await Promise.all([
      this.users.findById(userId).populate(POPULATE_USER).lean(),
      this.follows.countDocuments({ followeeId: userId }),
      this.follows.countDocuments({ followerId: userId }),
    ]);

    if (!doc) {
      throw AppException.notFound('User');
    }

    // Las cifras de seguimiento se cuentan aquí: sin esto la sesión anunciaba
    // cero seguidores a quien tenía varios, porque el valor por defecto del
    // mapeador es cero.
    return toUser(doc as never, { followerCount, followingCount });
  }
}
