import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type {
  AuthSession,
  AuthTokens,
  LoginResult,
  MfaLoginResult,
  User as PublicUser,
} from '@social-network/shared';

import type { AuthenticatedUser, ClientInfo } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { POPULATE_USER, toUser } from '../common/mappers.js';
import type { Model } from '../database/mongoose.js';
import { Follow, Media } from '../database/schemas/content.schema.js';
import {
  AuthMethod,
  AuthProvider,
  LoginStatus,
  MediaType,
  SecurityEventType,
  SessionEndReason,
} from '../database/schemas/enums.js';
import {
  EmailVerification,
  PasswordReset,
  SocialLink,
  User,
  UserPermissions,
} from '../database/schemas/user.schema.js';
import { MailService } from '../mail/mail.service.js';
import type {
  ChangePasswordDto,
  CompleteMfaLoginDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
} from './dto/auth.dto.js';
import { MfaService } from './mfa/mfa.service.js';
import { PasswordService, createSingleUseToken, hashSingleUseToken } from './password.service.js';
import { LoginThrottleService } from './security/login-throttle.service.js';
import { SecurityAlertsService } from './security/security-alerts.service.js';
import { SecurityEventsService } from './security/security-events.service.js';
import { SessionService } from './session/session.service.js';
import { SocialVerifierService, type VerifiedIdentity } from './social/social-verifier.service.js';
import { TokenService } from './token.service.js';

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
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly throttle: LoginThrottleService,
    private readonly events: SecurityEventsService,
    private readonly alerts: SecurityAlertsService,
    private readonly social: SocialVerifierService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthSession> {
    const [emailTaken, nameTaken] = await Promise.all([
      this.users.exists({ email: dto.email }),
      this.users.exists({ name: dto.name }),
    ]);

    if (emailTaken) {
      throw AppException.conflict(
        ErrorCode.UserAlreadyExists,
        'That email address is already registered',
      );
    }

    if (nameTaken) {
      throw AppException.conflict(ErrorCode.Conflict, 'That username is already taken');
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

    const session = await this.openSession(
      userId,
      [AuthMethod.Registration, AuthMethod.Password],
      client,
    );
    await this.events.record(userId, SecurityEventType.Login, client, { method: 'registration' });

    return session;
  }

  /**
   * Primer paso del inicio de sesión.
   *
   * Si la cuenta tiene segundo factor y este dispositivo no es de confianza,
   * no se abre la sesión: se devuelve un reto que hay que completar con el
   * código.
   */
  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    const throttleKey = `login:${dto.email}`;

    await this.throttle.assertNotLocked(throttleKey);

    const user = await this.users
      .findOne({ email: dto.email })
      .select('passwordHash mfaEnabled')
      .lean();

    if (!user?.passwordHash) {
      // Se gasta el mismo tiempo que en una verificación real para que no se
      // pueda deducir qué correos están dados de alta midiendo la respuesta.
      await this.passwords.fakeVerify();
      await this.throttle.registerFailure(throttleKey);
      throw AppException.invalidCredentials();
    }

    const userId = String(user._id);

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.throttle.registerFailure(throttleKey);
      await this.events.record(userId, SecurityEventType.LoginFailed, client);
      throw AppException.invalidCredentials();
    }

    await this.throttle.reset(throttleKey);

    // Si el hash se generó con parámetros ya desfasados, se actualiza ahora que
    // tenemos la contraseña en claro.
    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.updateOne(
        { _id: user._id },
        { $set: { passwordHash: await this.passwords.hash(dto.password) } },
      );
    }

    return this.afterFirstFactor(
      userId,
      user.mfaEnabled,
      AuthMethod.Password,
      dto.trustedDeviceToken,
      client,
    );
  }

  async socialLogin(dto: SocialLoginDto, client: ClientInfo): Promise<LoginResult> {
    const identity = await this.social.verify(dto.provider, dto.token);
    const userId = await this.resolveSocialUser(identity, dto.lang);
    const user = await this.users.findById(userId).select('mfaEnabled').lean();

    return this.afterFirstFactor(
      userId,
      user?.mfaEnabled ?? false,
      identity.provider,
      dto.trustedDeviceToken,
      client,
    );
  }

  /** Segundo paso: el código de la app o uno de recuperación. */
  async completeMfaLogin(dto: CompleteMfaLoginDto, client: ClientInfo): Promise<MfaLoginResult> {
    const completed = await this.mfa.completeChallenge(
      dto.challengeToken,
      dto.method,
      dto.code,
      client,
    );

    const session = await this.openSession(
      completed.userId,
      [completed.firstFactor, completed.secondFactor],
      client,
    );

    const trustedDeviceToken = dto.trustDevice
      ? await this.mfa.trustDevice(completed.userId, client)
      : null;

    await this.afterLogin(completed.userId, session.sessionId, client, completed.secondFactor);

    return { ...session, trustedDeviceToken };
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthTokens> {
    const rotated = await this.sessions.rotate(refreshToken, client);
    const user = await this.users.findById(rotated.userId).select('role').lean();

    if (!user) {
      await this.sessions.revoke(rotated.sessionId, SessionEndReason.AccountDeleted);
      throw AppException.badToken('Refresh token belongs to an account that no longer exists');
    }

    const access = await this.tokens.signSessionToken(
      { id: rotated.userId, role: user.role },
      rotated.sessionId,
    );

    return {
      accessToken: access.token,
      refreshToken: rotated.refreshToken,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      sessionId: rotated.sessionId,
    };
  }

  /**
   * Cierra la sesión desde la que se llama, o todas.
   *
   * Ya no hace falta mandar el refresh token: el access token dice a qué
   * sesión pertenece.
   */
  async logout(actor: AuthenticatedUser, everywhere: boolean, client: ClientInfo): Promise<void> {
    if (everywhere) {
      await this.sessions.revokeAllForUser(actor.id, SessionEndReason.Logout);
    } else if (actor.sessionId) {
      await this.sessions.revoke(actor.sessionId, SessionEndReason.Logout);
    }

    await this.events.record(actor.id, SecurityEventType.Logout, client, {
      reason: everywhere ? 'everywhere' : 'this_device',
    });
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

    if (!user) {
      this.logger.debug(`Password reset requested for an unknown account: ${dto.email}`);

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

    // Una cuenta creada con Google también puede fijarse una contraseña así:
    // es la forma de dejar de depender del proveedor.
    const url = `${this.config.getOrThrow<string>('clientUrl')}/reset-password?token=${token}`;
    await this.mail.sendPasswordReset(user.email, user.name, url, dto.lang ?? user.lang);
  }

  async resetPassword(dto: ResetPasswordDto, client: ClientInfo): Promise<void> {
    const record = await this.resets.findOne({ tokenHash: hashSingleUseToken(dto.token) }).lean();

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw AppException.badToken('The reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const userId = String(record.userId);

    // El enlace se marca como gastado ANTES de tocar la contraseña: si algo
    // falla en medio, el peor caso es un enlace quemado sin efecto, no un
    // enlace todavía válido después de haberse usado.
    await this.resets.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } });
    await this.users.updateOne({ _id: userId }, { $set: { passwordHash } });

    // Restablecer la contraseña echa de todas las sesiones y olvida los
    // dispositivos de confianza: es la forma de recuperar una cuenta ya
    // comprometida. El segundo factor se mantiene.
    await this.sessions.revokeAllForUser(userId, SessionEndReason.PasswordChanged);
    await this.mfa.forgetTrustedDevices(userId);
    await this.throttle.reset(`login:${(await this.emailOf(userId)) ?? ''}`);
    await this.events.record(userId, SecurityEventType.PasswordReset, client);
    await this.alerts.send(userId, 'password_changed', client);
  }

  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto,
    client: ClientInfo,
  ): Promise<void> {
    const user = await this.users.findById(actor.id).select('passwordHash').lean();

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
      // 403: el token vale, lo que falla es la contraseña actual.
      throw new AppException(
        ErrorCode.IncorrectUser,
        HttpStatus.FORBIDDEN,
        'The current password is not correct',
      );
    }

    await this.users.updateOne(
      { _id: actor.id },
      { $set: { passwordHash: await this.passwords.hash(dto.newPassword) } },
    );

    if (dto.signOutOtherSessions !== false) {
      await this.sessions.revokeAllForUser(
        actor.id,
        SessionEndReason.PasswordChanged,
        actor.sessionId,
      );
    }

    await this.events.record(actor.id, SecurityEventType.PasswordChanged, client);
    await this.alerts.send(actor.id, 'password_changed', client);
  }

  /** Confirma una dirección de correo a partir del token del enlace enviado. */
  async verifyEmail(token: string): Promise<void> {
    const record = await this.verifications
      .findOne({ tokenHash: hashSingleUseToken(token) })
      .lean();

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw AppException.badToken('The confirmation link is invalid or has expired');
    }

    const taken = await this.users.exists({ email: record.email, _id: { $ne: record.userId } });

    if (taken) {
      throw AppException.conflict(
        ErrorCode.UserAlreadyExists,
        'That email address is already registered',
      );
    }

    await this.verifications.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } });
    await this.users.updateOne(
      { _id: record.userId },
      { $set: { email: record.email, emailVerified: true } },
    );
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findById(userId).select('email name lang emailVerified').lean();

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
   * correo a confirmar en lugar de leerlo del usuario. El enlace lleva a la
   * aplicación, que confirma con la mutación `verifyEmail`: ya no hay una ruta
   * HTTP propia para esto.
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    name: string,
    lang: string,
  ): Promise<void> {
    await this.verifications.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });

    const { token, hash } = createSingleUseToken();

    await this.verifications.create({
      userId,
      email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });

    const url = `${this.config.getOrThrow<string>('clientUrl')}/verify-email?token=${token}`;

    await this.mail.sendVerifyEmail(email, name, url, lang);
  }

  private async afterFirstFactor(
    userId: string,
    mfaEnabled: boolean,
    firstFactor: AuthMethod,
    trustedDeviceToken: string | undefined,
    client: ClientInfo,
  ): Promise<LoginResult> {
    const trusted = mfaEnabled && (await this.mfa.isTrustedDevice(userId, trustedDeviceToken));

    if (mfaEnabled && !trusted) {
      return {
        status: LoginStatus.MfaRequired,
        session: null,
        challenge: await this.mfa.createChallenge(userId, firstFactor),
      };
    }

    const methods = trusted ? [firstFactor, AuthMethod.TrustedDevice] : [firstFactor];
    const session = await this.openSession(userId, methods, client);

    await this.afterLogin(userId, session.sessionId, client, firstFactor);

    return { status: LoginStatus.Authenticated, session, challenge: null };
  }

  private async afterLogin(
    userId: string,
    sessionId: string,
    client: ClientInfo,
    method: AuthMethod,
  ): Promise<void> {
    await this.users.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
    await this.events.record(userId, SecurityEventType.Login, client, { method });

    if (!(await this.sessions.isKnownDevice(userId, client.userAgent, sessionId))) {
      await this.alerts.send(userId, 'new_login', client);
    }
  }

  private async openSession(
    userId: string,
    methods: AuthMethod[],
    client: ClientInfo,
  ): Promise<AuthSession> {
    const user = await this.findPublicUser(userId);
    const session = await this.sessions.create(userId, methods, client);
    const access = await this.tokens.signSessionToken(
      { id: user.id, role: user.role },
      session.sessionId,
    );

    return {
      accessToken: access.token,
      refreshToken: session.refreshToken,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      sessionId: session.sessionId,
      user,
    };
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
      // correo ajeno en un proveedor laxo y quedarse con la cuenta de aquí.
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
      name: await this.availableUsername(identity),
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

  /**
   * Un nombre de usuario libre para una cuenta creada desde un proveedor.
   *
   * El proveedor da un nombre visible —«Ana Pérez»—, no uno apto para una
   * dirección web; se deriva de él y se le añaden cifras si ya está cogido.
   */
  private async availableUsername(identity: VerifiedIdentity): Promise<string> {
    const base =
      `${identity.firstName}${identity.lastName}`
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) ||
      identity.email
        .split('@')[0]
        ?.replace(/[^a-z0-9]/g, '')
        .slice(0, 20) ||
      'user';

    let candidate = base.length >= 3 ? base : `${base}user`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!(await this.users.exists({ name: candidate }))) {
        return candidate;
      }

      candidate = `${base}${Math.floor(Math.random() * 10_000)}`;
    }

    return `${base}${Date.now().toString(36)}`;
  }

  private async emailOf(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId).select('email').lean();

    return user?.email ?? null;
  }

  /** La cuenta tal y como sale hacia fuera, con sus relaciones ya pobladas. */
  private async findPublicUser(userId: string): Promise<PublicUser> {
    const [doc, followerCount, followingCount] = await Promise.all([
      this.users.findById(userId).populate(POPULATE_USER).lean(),
      this.follows.countDocuments({ followeeId: userId, pending: { $ne: true } }),
      this.follows.countDocuments({ followerId: userId, pending: { $ne: true } }),
    ]);

    if (!doc) {
      throw AppException.notFound('User');
    }

    return toUser(doc, { followerCount, followingCount });
  }
}
