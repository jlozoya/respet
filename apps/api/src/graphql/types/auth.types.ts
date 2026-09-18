import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  AuthSession,
  AuthTokens,
  DeviceInfo,
  DeviceSession,
  LoginResult,
  MfaChallenge,
  MfaLoginResult,
  MfaStatus,
  RecoveryCodes,
  SecurityEvent,
  TotpSetup,
  TrustedDeviceInfo,
} from '@social-network/shared';

import {
  AuthMethod,
  DeviceType,
  LoginStatus,
  MfaMethod,
  SecurityEventType,
  SessionEndReason,
} from '../enums.js';
import { Paginated } from './common.types.js';
import { UserType } from './user.types.js';

@ObjectType('AuthTokens', { description: 'Par de tokens emitido al autenticarse o renovar.' })
export class AuthTokensType implements AuthTokens {
  @Field()
  accessToken!: string;

  @Field({ description: 'Token opaco de renovación. Rota en cada uso.' })
  refreshToken!: string;

  @Field()
  tokenType!: 'Bearer';

  @Field(() => Int, { description: 'Vida del `accessToken`, en segundos.' })
  expiresIn!: number;

  @Field(() => ID, { description: 'La sesión a la que pertenecen.' })
  sessionId!: string;
}

@ObjectType('AuthSession', { description: 'Los tokens y la persona a la que pertenecen.' })
export class AuthSessionType extends AuthTokensType implements AuthSession {
  @Field(() => UserType)
  user!: UserType;
}

@ObjectType('MfaChallenge', { description: 'El segundo paso pendiente de un inicio de sesión.' })
export class MfaChallengeType implements MfaChallenge {
  @Field()
  token!: string;

  @Field(() => [MfaMethod])
  methods!: MfaMethod[];

  @Field()
  expiresAt!: string;
}

@ObjectType('LoginResult', {
  description: 'O la sesión abierta, o el reto del segundo factor; nunca las dos cosas.',
})
export class LoginResultType implements LoginResult {
  @Field(() => LoginStatus)
  status!: LoginStatus;

  @Field(() => AuthSessionType, { nullable: true })
  session!: AuthSessionType | null;

  @Field(() => MfaChallengeType, { nullable: true })
  challenge!: MfaChallengeType | null;
}

@ObjectType('MfaLoginResult')
export class MfaLoginResultType extends AuthSessionType implements MfaLoginResult {
  @Field(() => String, {
    nullable: true,
    description: 'Presente si se pidió confiar en el dispositivo: hay que enviarlo en los próximos inicios.',
  })
  trustedDeviceToken!: string | null;
}

@ObjectType('DeviceInfo')
export class DeviceInfoType implements DeviceInfo {
  @Field(() => DeviceType)
  type!: DeviceType;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  browser!: string | null;

  @Field(() => String, { nullable: true })
  os!: string | null;
}

@ObjectType('DeviceSession', { description: 'Una sesión abierta en un dispositivo.' })
export class DeviceSessionType implements DeviceSession {
  @Field(() => ID)
  id!: string;

  @Field(() => DeviceInfoType)
  device!: DeviceInfoType;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field(() => [AuthMethod])
  authMethods!: AuthMethod[];

  @Field({ description: 'Cierto en la sesión desde la que se consulta.' })
  current!: boolean;

  @Field()
  createdAt!: string;

  @Field()
  lastUsedAt!: string;

  @Field()
  expiresAt!: string;

  @Field(() => String, { nullable: true })
  revokedAt!: string | null;

  @Field(() => SessionEndReason, { nullable: true })
  revokedReason!: SessionEndReason | null;
}

@ObjectType('SecurityEvent')
export class SecurityEventObject implements SecurityEvent {
  @Field(() => ID)
  id!: string;

  @Field(() => SecurityEventType)
  type!: SecurityEventType;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field(() => DeviceInfoType, { nullable: true })
  device!: DeviceInfoType | null;

  @Field(() => String, { nullable: true })
  detail!: string | null;

  @Field()
  createdAt!: string;
}

@ObjectType('TrustedDevice')
export class TrustedDeviceType implements TrustedDeviceInfo {
  @Field(() => ID)
  id!: string;

  @Field(() => DeviceInfoType)
  device!: DeviceInfoType;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field(() => String, { nullable: true })
  lastUsedAt!: string | null;

  @Field()
  expiresAt!: string;

  @Field()
  createdAt!: string;
}

@ObjectType('MfaStatus', { description: 'Estado de la verificación en dos pasos.' })
export class MfaStatusType implements MfaStatus {
  @Field()
  enabled!: boolean;

  @Field(() => [MfaMethod])
  methods!: MfaMethod[];

  @Field(() => String, { nullable: true })
  enabledAt!: string | null;

  @Field(() => Int)
  recoveryCodesRemaining!: number;

  @Field(() => [TrustedDeviceType])
  trustedDevices!: TrustedDeviceType[];
}

@ObjectType('TotpSetup', { description: 'Lo necesario para dar de alta la app de autenticación.' })
export class TotpSetupType implements TotpSetup {
  @Field({ description: 'Secreto en base32, para teclearlo si no se puede leer el QR.' })
  secret!: string;

  @Field()
  otpauthUrl!: string;

  @Field({ description: 'El código QR como imagen `data:`.' })
  qrCodeDataUrl!: string;
}

@ObjectType('RecoveryCodes', { description: 'Códigos de recuperación. Sólo se enseñan una vez.' })
export class RecoveryCodesType implements RecoveryCodes {
  @Field(() => [String])
  codes!: string[];
}

export const SecurityEventPage = Paginated(SecurityEventObject, 'SecurityEvent');
