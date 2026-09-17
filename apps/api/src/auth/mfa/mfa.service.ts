import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type {
  MfaChallenge as MfaChallengeDto,
  MfaStatus,
  RecoveryCodes,
  TotpSetup,
  TrustedDeviceInfo,
} from '@respet/shared';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';

import type { ClientInfo } from '../../common/decorators/index.js';
import { AppException, ErrorCode } from '../../common/errors.js';
import { toIso } from '../../common/mappers.js';
import { isValidObjectId, type Model } from '../../database/mongoose.js';
import {
  AuthMethod,
  MfaMethod,
  SecurityEventType,
} from '../../database/schemas/enums.js';
import {
  MfaChallenge,
  MfaFactor,
  TrustedDevice,
  User,
} from '../../database/schemas/user.schema.js';
import { CryptoService } from '../crypto.service.js';
import { LoginThrottleService } from '../security/login-throttle.service.js';
import { SecurityEventsService } from '../security/security-events.service.js';
import { parseUserAgent } from '../session/device.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
/** Sin 0/O ni 1/I/L, que se confunden al copiarlos a mano. */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Lo que devuelve un reto superado: con qué se superó y el dispositivo de confianza, si se pidió. */
export interface CompletedChallenge {
  userId: string;
  firstFactor: AuthMethod;
  secondFactor: AuthMethod;
}

/**
 * El segundo factor: app de autenticación, códigos de recuperación y
 * dispositivos de confianza.
 *
 * Es opcional. Quien lo activa, al iniciar sesión con contraseña o con Google
 * o Facebook, recibe un reto en lugar de la sesión y tiene que completarlo con
 * el código de seis cifras de su app —o con uno de sus códigos de recuperación
 * si ha perdido el móvil—.
 */
@Injectable()
export class MfaService {
  constructor(
    @InjectModel(MfaFactor.name) private readonly factors: Model<MfaFactor>,
    @InjectModel(MfaChallenge.name) private readonly challenges: Model<MfaChallenge>,
    @InjectModel(TrustedDevice.name) private readonly trustedDevices: Model<TrustedDevice>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly crypto: CryptoService,
    private readonly throttle: LoginThrottleService,
    private readonly events: SecurityEventsService,
    private readonly config: ConfigService,
  ) {}

  async status(userId: string): Promise<MfaStatus> {
    const [factor, devices] = await Promise.all([
      this.factors.findOne({ userId, confirmedAt: { $ne: null } }).lean(),
      this.listTrustedDevices(userId),
    ]);

    return {
      enabled: factor !== null,
      methods: factor ? [MfaMethod.Totp, MfaMethod.RecoveryCode] : [],
      enabledAt: toIso(factor?.confirmedAt ?? null),
      recoveryCodesRemaining: factor?.recoveryCodes.filter((code) => !code.usedAt).length ?? 0,
      trustedDevices: devices,
    };
  }

  /**
   * Empieza a configurar la app de autenticación.
   *
   * El secreto queda guardado sin confirmar: no cuenta para nada hasta que se
   * demuestra, con un código, que la app lo ha leído bien. Empezar otra vez
   * sustituye al pendiente.
   */
  async beginTotpSetup(userId: string): Promise<TotpSetup> {
    const user = await this.users.findById(userId).select('email mfaEnabled').lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (user.mfaEnabled) {
      throw AppException.conflict(ErrorCode.MfaAlreadyEnabled, 'Two-factor authentication is already on');
    }

    const secret = generateTotpSecret();

    await this.factors.updateOne(
      { userId },
      {
        $set: {
          secretCiphertext: this.crypto.encrypt(secret),
          confirmedAt: null,
          lastUsedStep: null,
          recoveryCodes: [],
        },
      },
      { upsert: true },
    );

    const url = otpauthUrl({
      issuer: this.config.getOrThrow<string>('mfa.issuer'),
      account: user.email,
      secret,
    });

    return {
      secret,
      otpauthUrl: url,
      qrCodeDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240 }),
    };
  }

  /** Confirma la app con un código y activa el segundo factor. Devuelve los códigos de recuperación. */
  async confirmTotpSetup(userId: string, code: string, client: ClientInfo): Promise<RecoveryCodes> {
    const factor = await this.factors.findOne({ userId }).lean();

    if (!factor) {
      throw AppException.badRequest(ErrorCode.MfaNotEnabled, 'Start the setup first');
    }

    if (factor.confirmedAt) {
      throw AppException.conflict(ErrorCode.MfaAlreadyEnabled, 'Two-factor authentication is already on');
    }

    const step = verifyTotp(this.crypto.decrypt(factor.secretCiphertext), code, null);

    if (step === null) {
      throw invalidCode();
    }

    const codes = this.generateRecoveryCodes();

    await this.factors.updateOne(
      { _id: factor._id },
      {
        $set: {
          confirmedAt: new Date(),
          lastUsedStep: step,
          recoveryCodes: codes.map((plain) => ({ hash: this.hashRecoveryCode(plain), usedAt: null })),
        },
      },
    );
    await this.users.updateOne({ _id: userId }, { $set: { mfaEnabled: true } });
    await this.events.record(userId, SecurityEventType.MfaEnabled, client);

    return { codes };
  }

  /** Desactiva el segundo factor. Quien llama ya ha confirmado la identidad. */
  async disable(userId: string, client: ClientInfo): Promise<void> {
    const deleted = await this.factors.deleteOne({ userId });

    await this.users.updateOne({ _id: userId }, { $set: { mfaEnabled: false } });
    await this.trustedDevices.deleteMany({ userId });

    if (deleted.deletedCount > 0) {
      await this.events.record(userId, SecurityEventType.MfaDisabled, client);
    }
  }

  async regenerateRecoveryCodes(userId: string, client: ClientInfo): Promise<RecoveryCodes> {
    const factor = await this.factors.findOne({ userId, confirmedAt: { $ne: null } }).select('_id').lean();

    if (!factor) {
      throw AppException.badRequest(ErrorCode.MfaNotEnabled, 'Two-factor authentication is off');
    }

    const codes = this.generateRecoveryCodes();

    await this.factors.updateOne(
      { _id: factor._id },
      { $set: { recoveryCodes: codes.map((plain) => ({ hash: this.hashRecoveryCode(plain), usedAt: null })) } },
    );
    await this.events.record(userId, SecurityEventType.RecoveryCodesRegenerated, client);

    return { codes };
  }

  /**
   * Comprueba un código del segundo factor fuera de un inicio de sesión: para
   * confirmar la identidad antes de una operación delicada.
   */
  async verifyCode(userId: string, code: string, client: ClientInfo): Promise<AuthMethod> {
    const key = `mfa:${userId}`;

    await this.throttle.assertNotLocked(key);

    const method = await this.checkCode(userId, code, client);

    if (!method) {
      await this.throttle.registerFailure(key);
      await this.events.record(userId, SecurityEventType.MfaFailed, client);
      throw invalidCode();
    }

    await this.throttle.reset(key);

    return method;
  }

  /** Crea el reto pendiente tras superar el primer factor. */
  async createChallenge(userId: string, firstFactor: AuthMethod): Promise<MfaChallengeDto> {
    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await this.challenges.create({
      tokenHash: this.crypto.hashToken(token),
      userId,
      firstFactor,
      expiresAt,
    });

    return { token, methods: [MfaMethod.Totp, MfaMethod.RecoveryCode], expiresAt: expiresAt.toISOString() };
  }

  /**
   * Completa un reto con un código.
   *
   * Cada intento fallido cuenta contra el reto —que muere a los cinco— y
   * contra la cuenta, que se bloquea igual que con las contraseñas.
   */
  async completeChallenge(
    challengeToken: string,
    method: MfaMethod,
    code: string,
    client: ClientInfo,
  ): Promise<CompletedChallenge> {
    const challenge = await this.challenges
      .findOne({ tokenHash: this.crypto.hashToken(challengeToken) })
      .lean();

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attempts >= MAX_CHALLENGE_ATTEMPTS
    ) {
      throw AppException.badToken('The sign-in attempt expired; start again');
    }

    const userId = String(challenge.userId);
    const key = `mfa:${userId}`;

    await this.throttle.assertNotLocked(key);

    const verified =
      method === MfaMethod.RecoveryCode
        ? await this.consumeRecoveryCode(userId, code, client)
        : await this.checkTotp(userId, code);

    if (!verified) {
      await this.challenges.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
      await this.throttle.registerFailure(key);
      await this.events.record(userId, SecurityEventType.MfaFailed, client);
      throw invalidCode();
    }

    // Se marca como gastado de forma atómica: el mismo reto no abre dos sesiones.
    const consumed = await this.challenges.updateOne(
      { _id: challenge._id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );

    if (consumed.modifiedCount === 0) {
      throw AppException.badToken('The sign-in attempt was already completed');
    }

    await this.throttle.reset(key);

    return {
      userId,
      firstFactor: challenge.firstFactor,
      secondFactor: method === MfaMethod.RecoveryCode ? AuthMethod.RecoveryCode : AuthMethod.Totp,
    };
  }

  /** Apunta este dispositivo como de confianza y devuelve el token que debe guardar. */
  async trustDevice(userId: string, client: ClientInfo): Promise<string> {
    const token = this.crypto.randomToken(32);
    const days = this.config.getOrThrow<number>('mfa.trustedDeviceTtlDays');

    await this.trustedDevices.create({
      userId,
      tokenHash: this.crypto.hashToken(token),
      device: parseUserAgent(client.userAgent),
      ip: client.ip,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    });

    return token;
  }

  /** Cierto si el token corresponde a un dispositivo de confianza vigente de esa cuenta. */
  async isTrustedDevice(userId: string, token: string | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }

    const device = await this.trustedDevices.findOneAndUpdate(
      { userId, tokenHash: this.crypto.hashToken(token), expiresAt: { $gt: new Date() } },
      { $set: { lastUsedAt: new Date() } },
    );

    return device !== null;
  }

  async listTrustedDevices(userId: string): Promise<TrustedDeviceInfo[]> {
    const docs = await this.trustedDevices
      .find({ userId, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 })
      .lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      device: doc.device ?? parseUserAgent(null),
      ip: doc.ip,
      lastUsedAt: toIso(doc.lastUsedAt),
      expiresAt: toIso(doc.expiresAt),
      createdAt: toIso(doc.createdAt),
    }));
  }

  async revokeTrustedDevice(userId: string, deviceId: string | null, client: ClientInfo): Promise<void> {
    if (deviceId !== null && !isValidObjectId(deviceId)) {
      throw AppException.notFound('Trusted device');
    }

    await this.trustedDevices.deleteMany({ userId, ...(deviceId ? { _id: deviceId } : {}) });
    await this.events.record(userId, SecurityEventType.TrustedDeviceRevoked, client);
  }

  /** Olvida todos los dispositivos de confianza, por ejemplo al cambiar la contraseña. */
  async forgetTrustedDevices(userId: string): Promise<void> {
    await this.trustedDevices.deleteMany({ userId });
  }

  private async checkCode(userId: string, code: string, client: ClientInfo): Promise<AuthMethod | null> {
    if (await this.checkTotp(userId, code)) {
      return AuthMethod.Totp;
    }

    if (await this.consumeRecoveryCode(userId, code, client)) {
      return AuthMethod.RecoveryCode;
    }

    return null;
  }

  private async checkTotp(userId: string, code: string): Promise<boolean> {
    const factor = await this.factors.findOne({ userId, confirmedAt: { $ne: null } }).lean();

    if (!factor) {
      return false;
    }

    const step = verifyTotp(this.crypto.decrypt(factor.secretCiphertext), code, factor.lastUsedStep);

    if (step === null) {
      return false;
    }

    // Condicionado al paso anterior: dos peticiones simultáneas con el mismo
    // código no pueden ganar las dos.
    const updated = await this.factors.updateOne(
      { _id: factor._id, lastUsedStep: factor.lastUsedStep },
      { $set: { lastUsedStep: step } },
    );

    return updated.modifiedCount === 1;
  }

  private async consumeRecoveryCode(userId: string, code: string, client: ClientInfo): Promise<boolean> {
    const hash = this.hashRecoveryCode(code);

    const updated = await this.factors.updateOne(
      {
        userId,
        confirmedAt: { $ne: null },
        recoveryCodes: { $elemMatch: { hash, usedAt: null } },
      },
      { $set: { 'recoveryCodes.$.usedAt': new Date() } },
    );

    if (updated.modifiedCount === 0) {
      return false;
    }

    await this.events.record(userId, SecurityEventType.RecoveryCodeUsed, client);

    return true;
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]);

      return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
    });
  }

  /** Los códigos se comparan sin guiones, espacios ni mayúsculas: se copian a mano. */
  private hashRecoveryCode(code: string): string {
    return this.crypto.hashToken(`recovery:${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  }
}

function invalidCode(): AppException {
  return new AppException(ErrorCode.InvalidMfaCode, HttpStatus.BAD_REQUEST, 'The code is not valid');
}
