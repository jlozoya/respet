import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHmac } from 'node:crypto';

import { AppException, ErrorCode } from '../../common/errors.js';
import { AuthProvider } from '../../database/schemas/enums.js';

/** Identidad ya comprobada contra el proveedor externo. */
export interface VerifiedIdentity {
  provider: AuthProvider;
  externalId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Verificación de identidades de proveedores externos.
 *
 * El backend anterior se fiaba de los datos de perfil que enviaba la app —
 * incluido el correo—, de modo que cualquiera con el `client_secret`, que
 * además viajaba dentro del binario, podía suplantar a otro usuario. Aquí la
 * app sólo manda el token del proveedor y es el servidor quien lo valida y
 * decide de quién es la cuenta.
 */
@Injectable()
export class SocialVerifierService {
  private readonly logger = new Logger(SocialVerifierService.name);
  private googleClient?: OAuth2Client;

  constructor(private readonly config: ConfigService) {}

  async verify(
    provider: 'google' | 'facebook' | 'apple',
    token: string,
  ): Promise<VerifiedIdentity> {
    switch (provider) {
      case 'google':
        return this.verifyGoogle(token);
      case 'facebook':
        return this.verifyFacebook(token);
      case 'apple':
        throw new AppException(
          ErrorCode.WrongToken,
          501,
          'Apple sign-in is not configured on this server yet',
        );
    }
  }

  private async verifyGoogle(idToken: string): Promise<VerifiedIdentity> {
    const clientId = this.config.get<string>('social.googleClientId');

    if (!clientId) {
      throw new AppException(ErrorCode.WrongToken, 501, 'GOOGLE_CLIENT_ID is not configured');
    }

    this.googleClient ??= new OAuth2Client(clientId);

    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw AppException.badToken('Google token does not include an email address');
      }

      const { firstName, lastName } = splitName(
        payload.given_name,
        payload.family_name,
        payload.name ?? payload.email,
      );

      return {
        provider: AuthProvider.Google,
        externalId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        firstName,
        lastName,
        name: payload.name ?? firstName,
        avatarUrl: payload.picture,
      };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      this.logger.warn(`Google token rejected: ${describe(error)}`);
      throw AppException.badToken('Google token could not be verified');
    }
  }

  private async verifyFacebook(accessToken: string): Promise<VerifiedIdentity> {
    const appId = this.config.get<string>('social.facebookAppId');
    const appSecret = this.config.get<string>('social.facebookAppSecret');

    if (!appId || !appSecret) {
      throw new AppException(
        ErrorCode.WrongToken,
        501,
        'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are not configured',
      );
    }

    // Facebook exige que el token venga acompañado de su HMAC con el secreto
    // de la aplicación, para que no sirva un token emitido a otra app.
    const proof = createHmac('sha256', appSecret).update(accessToken).digest('hex');

    const debug = await this.fetchJson<FacebookDebugResponse>(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
        `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
    );

    if (!debug.data?.is_valid || debug.data.app_id !== appId) {
      throw AppException.badToken('Facebook token is not valid for this application');
    }

    const profile = await this.fetchJson<FacebookProfileResponse>(
      'https://graph.facebook.com/v21.0/me' +
        '?fields=id,name,first_name,last_name,email,picture.type(large)' +
        `&access_token=${encodeURIComponent(accessToken)}&appsecret_proof=${proof}`,
    );

    if (!profile.id) {
      throw AppException.badToken('Facebook profile could not be read');
    }

    if (!profile.email) {
      // Ocurre cuando el usuario no concede el permiso `email`, o cuando su
      // cuenta se creó sólo con número de teléfono.
      throw new AppException(
        ErrorCode.EmailNotFound,
        400,
        'The Facebook account did not share an email address',
      );
    }

    const { firstName, lastName } = splitName(
      profile.first_name,
      profile.last_name,
      profile.name ?? profile.email,
    );

    return {
      provider: AuthProvider.Facebook,
      externalId: profile.id,
      email: profile.email.toLowerCase(),
      // Facebook sólo devuelve correos ya confirmados por su parte.
      emailVerified: true,
      firstName,
      lastName,
      name: profile.name ?? firstName,
      avatarUrl: profile.picture?.data?.url,
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      this.logger.warn(`Facebook Graph responded ${response.status} for ${redact(url)}`);
      throw AppException.badToken('Facebook token could not be verified');
    }

    return (await response.json()) as T;
  }
}

interface FacebookDebugResponse {
  data?: { is_valid?: boolean; app_id?: string; user_id?: string };
}

interface FacebookProfileResponse {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

/**
 * Reparte el nombre en dos campos.
 *
 * No todos los proveedores devuelven nombre y apellidos por separado, así que
 * cuando faltan se parte el nombre completo por el primer espacio.
 */
function splitName(
  given: string | undefined,
  family: string | undefined,
  fallback: string,
): { firstName: string; lastName: string } {
  if (given) {
    return { firstName: given.slice(0, 60), lastName: (family ?? '').slice(0, 60) };
  }

  const parts = fallback.trim().split(/\s+/);

  return {
    firstName: (parts[0] ?? fallback).slice(0, 60),
    lastName: parts.slice(1).join(' ').slice(0, 60),
  };
}

/** Oculta los tokens de la URL antes de escribirla en el registro. */
function redact(url: string): string {
  return url.replace(/(access_token|input_token|appsecret_proof)=[^&]*/g, '$1=***');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
