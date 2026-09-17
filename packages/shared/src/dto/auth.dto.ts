import type {
  AuthMethod,
  AuthProvider,
  DeviceType,
  Gender,
  LoginStatus,
  MfaMethod,
  SecurityEventType,
  SessionEndReason,
} from '../enums.js';
import type { User } from '../models.js';

/** Inicio de sesión con correo y contraseña. */
export interface LoginRequest {
  email: string;
  password: string;
  /**
   * El token de dispositivo de confianza que se recibió al completar un
   * segundo factor pidiendo no volver a preguntarlo aquí.
   */
  trustedDeviceToken?: string;
}

/**
 * Inicio de sesión (o alta automática) con un proveedor externo.
 *
 * La app no envía datos de perfil en los que el servidor confíe: sólo el token
 * del proveedor. La API lo verifica contra Google/Facebook y toma de ahí el
 * correo y el nombre.
 */
export interface SocialLoginRequest {
  provider: Extract<AuthProvider, 'google' | 'facebook' | 'apple'>;
  /** `idToken` en Google/Apple, `accessToken` en Facebook. */
  token: string;
  lang?: string;
  trustedDeviceToken?: string;
}

export interface RegisterRequest {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  lang?: string;
  gender?: Gender;
  /** Fecha de nacimiento, en formato ISO-8601 (2001-04-17). */
  birthday?: string;
}

/** Par de tokens emitido tras autenticarse correctamente. */
export interface AuthTokens {
  accessToken: string;
  /**
   * Token opaco con el que se renueva el de acceso. Rota en cada uso: el
   * anterior deja de valer y, si reaparece, la sesión se cierra.
   */
  refreshToken: string;
  tokenType: 'Bearer';
  /** Vida del `accessToken` en segundos. */
  expiresIn: number;
  /** La sesión a la que pertenecen, para marcarla como «este dispositivo». */
  sessionId: string;
}

export interface AuthSession extends AuthTokens {
  user: User;
}

/** El segundo paso pendiente de un inicio de sesión. */
export interface MfaChallenge {
  /** Token del reto, que vuelve con el código. Caduca en cinco minutos. */
  token: string;
  methods: MfaMethod[];
  expiresAt: string;
}

/**
 * Lo que responde el primer paso del inicio de sesión.
 *
 * O la sesión ya abierta, o el reto del segundo factor; nunca las dos cosas.
 */
export interface LoginResult {
  status: LoginStatus;
  session: AuthSession | null;
  challenge: MfaChallenge | null;
}

/** Segundo paso del inicio de sesión. */
export interface CompleteMfaLoginRequest {
  challengeToken: string;
  method: MfaMethod;
  code: string;
  /** No volver a pedir el código en este dispositivo durante un tiempo. */
  trustDevice?: boolean;
}

export interface MfaLoginResult extends AuthSession {
  /** Presente si se pidió confiar en el dispositivo: hay que guardarlo y enviarlo al entrar. */
  trustedDeviceToken: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
  lang?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  /** Cerrar el resto de sesiones abiertas. Por defecto, sí. */
  signOutOtherSessions?: boolean;
}

/**
 * Confirmación de identidad para una operación delicada.
 *
 * Con contraseña si la cuenta la tiene; si no, con el código del segundo
 * factor. Sin ninguno de los dos, basta con haber iniciado sesión hace poco.
 */
export interface ReauthRequest {
  password?: string;
  code?: string;
}

/** Con qué se ha abierto una sesión, leído del agente de usuario. */
export interface DeviceInfo {
  type: DeviceType;
  name: string;
  browser: string | null;
  os: string | null;
}

/** Una sesión abierta en un dispositivo, para la lista de «Dónde has iniciado sesión». */
export interface DeviceSession {
  id: string;
  device: DeviceInfo;
  ip: string | null;
  authMethods: AuthMethod[];
  /** Cierto en la sesión desde la que se consulta. */
  current: boolean;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: SessionEndReason | null;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  ip: string | null;
  device: DeviceInfo | null;
  /** Detalle legible propio de cada tipo: el nombre de la app autorizada, etc. */
  detail: string | null;
  createdAt: string;
}

export interface TrustedDeviceInfo {
  id: string;
  device: DeviceInfo;
  ip: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface MfaStatus {
  enabled: boolean;
  methods: MfaMethod[];
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  trustedDevices: TrustedDeviceInfo[];
}

/** Lo necesario para dar de alta la app de autenticación. */
export interface TotpSetup {
  /** El secreto en base32, para teclearlo a mano si no se puede leer el código QR. */
  secret: string;
  otpauthUrl: string;
  /** El código QR como imagen `data:`. */
  qrCodeDataUrl: string;
}

/** Los códigos de recuperación, que sólo se enseñan una vez. */
export interface RecoveryCodes {
  codes: string[];
}

/** Contenido del JWT de acceso de la propia aplicación. */
export interface AccessTokenPayload {
  /** Id del usuario. */
  sub: string;
  /** Id de la sesión. En los tokens de aplicaciones de terceros no va. */
  sid?: string;
  /** Id del consentimiento, en los tokens de aplicaciones de terceros. */
  gid?: string;
  /** `client_id` de la aplicación de terceros. */
  azp?: string;
  /** Permisos concedidos, separados por espacios, en los tokens de terceros. */
  scope?: string;
  role: string;
  iat: number;
  exp: number;
}
