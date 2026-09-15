import type { AuthProvider, Gender } from '../enums.js';
import type { User } from '../models.js';

/** Inicio de sesión con correo y contraseña. */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Inicio de sesión (o alta automática) con un proveedor externo.
 *
 * A diferencia del backend anterior, la app no envía datos de perfil en los que
 * el servidor confíe: sólo el token del proveedor. La API lo verifica contra
 * Google/Facebook y toma de ahí el correo y el nombre.
 */
export interface SocialLoginRequest {
  provider: Extract<AuthProvider, 'google' | 'facebook' | 'apple'>;
  /** `idToken` en Google/Apple, `accessToken` en Facebook. */
  token: string;
  lang?: string;
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
  refreshToken: string;
  tokenType: 'Bearer';
  /** Vida del `accessToken` en segundos. */
  expiresIn: number;
}

export interface AuthSession extends AuthTokens {
  user: User;
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
}

/** Contenido del JWT de acceso. */
export interface AccessTokenPayload {
  /** Id del usuario. */
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
