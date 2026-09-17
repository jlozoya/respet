import { Injectable, inject } from '@angular/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { SocialLoginRequest } from '@respet/shared';

import { environment } from '../../../environments/environment';
import { AuthService, type LoginOutcome } from './auth.service';

export type SocialProvider = SocialLoginRequest['provider'];

/**
 * Inicio de sesión con proveedores externos.
 *
 * Sustituye a `@codetrix-studio/capacitor-google-auth` y
 * `@capacitor-community/facebook-login`, que se quedaron en Capacitor 6, por
 * un único plugin que cubre Google, Facebook y Apple.
 *
 * La app sólo obtiene el token del proveedor y se lo entrega al servidor: es
 * él quien lo verifica y decide de quién es la cuenta. El backend anterior
 * aceptaba el perfil que le mandara el cliente —correo incluido—, de modo que
 * bastaba con conocer la dirección de alguien para suplantarlo.
 */
@Injectable({ providedIn: 'root' })
export class SocialLoginService {
  private readonly auth = inject(AuthService);

  private initialized?: Promise<void>;

  /**
   * Entra con un proveedor.
   *
   * Como con la contraseña, puede quedar pendiente el segundo paso si la
   * cuenta tiene activa la verificación en dos pasos.
   */
  async signIn(provider: SocialProvider, lang?: string): Promise<LoginOutcome> {
    await this.initialize();

    const token = await this.requestToken(provider);

    return this.auth.loginWithProvider({ provider, token, lang });
  }

  /** Cierra también la sesión del proveedor, no sólo la de Respet. */
  async signOut(provider: SocialProvider): Promise<void> {
    try {
      await this.initialize();
      await SocialLogin.logout({ provider });
    } catch {
      // Que el proveedor no responda no debe impedir cerrar nuestra sesión.
    }
  }

  /** Configura el plugin una sola vez, aunque se llame desde varias pantallas. */
  private async initialize(): Promise<void> {
    this.initialized ??= SocialLogin.initialize({
      ...(environment.googleClientId
        ? { google: { webClientId: environment.googleClientId } }
        : {}),
      ...(environment.facebookAppId ? { facebook: { appId: environment.facebookAppId } } : {}),
    });

    return this.initialized;
  }

  /**
   * Pide el token al proveedor.
   *
   * Cada rama va por separado porque el tipo de `login` es una unión
   * discriminada: las opciones válidas dependen del proveedor y no se pueden
   * pasar desde una variable sin estrechar antes.
   */
  private async requestToken(provider: SocialProvider): Promise<string> {
    if (provider === 'google') {
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['email', 'profile'] },
      });

      return this.requireToken(provider, extractIdToken(result));
    }

    if (provider === 'facebook') {
      const { result } = await SocialLogin.login({
        provider: 'facebook',
        options: { permissions: ['email', 'public_profile'] },
      });

      return this.requireToken(provider, extractAccessToken(result));
    }

    const { result } = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['name', 'email'] },
    });

    return this.requireToken(provider, extractIdToken(result));
  }

  private requireToken(provider: SocialProvider, token: string | null): string {
    if (!token) {
      throw new Error(`El proveedor ${provider} no devolvió ningún token utilizable.`);
    }

    return token;
  }
}

/**
 * Google y Apple emiten un `idToken` firmado, que el servidor verifica sin
 * llamar a nadie.
 */
function extractIdToken(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) {
    return null;
  }

  const { idToken } = result as { idToken?: string };

  return idToken ?? null;
}

/**
 * Facebook no tiene equivalente al `idToken`, así que se manda el
 * `accessToken` y el servidor lo contrasta contra la Graph API.
 */
function extractAccessToken(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) {
    return null;
  }

  const { accessToken } = result as { accessToken?: string | { token?: string } };

  if (typeof accessToken === 'string') {
    return accessToken;
  }

  return accessToken?.token ?? null;
}
