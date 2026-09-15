import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  AuthSession,
  AuthTokens,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  SocialLoginRequest,
  User,
  UserRole,
} from '@respet/shared';
import { ROLE_HIERARCHY } from '@respet/shared';

import { USER_FRAGMENTS, gql } from '../api/fragments';
import { GraphqlClientService } from '../api/graphql-client.service';
import { ME } from '../api/users.service';
import { StorageKey, StorageService } from '../storage/storage.service';

const SESSION_FIELDS = `accessToken refreshToken tokenType expiresIn user { ...UserFields }`;

const LOGIN = gql(
  `mutation Login($input: LoginInput!) {
    login(input: $input) { ${SESSION_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

const REGISTER = gql(
  `mutation Register($input: RegisterInput!) {
    register(input: $input) { ${SESSION_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

const SOCIAL_LOGIN = gql(
  `mutation SocialLogin($input: SocialLoginInput!) {
    socialLogin(input: $input) { ${SESSION_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

/**
 * Las operaciones que no deben reintentarse tras un error de sesión.
 *
 * `authInterceptor` las mira por su nombre. Con REST bastaba con la ruta, pero
 * ahora todas las operaciones comparten dirección: lo que las distingue es el
 * nombre que viaja en el cuerpo.
 */
export const PUBLIC_OPERATIONS = ['Login', 'Register', 'SocialLogin', 'RefreshTokens'];

const REFRESH_TOKENS = `
mutation RefreshTokens($refreshToken: String!) {
  refreshTokens(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    tokenType
    expiresIn
  }
}`;

const LOGOUT = `
mutation Logout($refreshToken: String, $everywhere: Boolean) {
  logout(refreshToken: $refreshToken, everywhere: $everywhere)
}`;

const CHANGE_PASSWORD = `
mutation ChangePassword($input: ChangePasswordInput!) {
  changePassword(input: $input)
}`;

const FORGOT_PASSWORD = `
mutation ForgotPassword($input: ForgotPasswordInput!) {
  forgotPassword(input: $input)
}`;

const RESET_PASSWORD = `
mutation ResetPassword($input: ResetPasswordInput!) {
  resetPassword(input: $input)
}`;

const RESEND_VERIFICATION = `mutation ResendVerification { resendVerification }`;

/**
 * Estado de la sesión.
 *
 * Se expone con señales, así que las plantillas leen `auth.user()` y se
 * actualizan solas. En el proyecto anterior el estado vivía repartido entre
 * `StorageService` y un bus de eventos propio, y cada pantalla tenía que
 * suscribirse a mano para enterarse de un cambio de sesión.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gql = inject(GraphqlClientService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<User | null>(null);
  private readonly readySignal = signal(false);

  /** Usuario autenticado, o `null` si no hay sesión. */
  readonly user = this.userSignal.asReadonly();
  /** Cierto una vez leída la sesión guardada; hasta entonces conviene esperar. */
  readonly ready = this.readySignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly role = computed<UserRole>(() => this.userSignal()?.role ?? 'visitor');
  readonly isAdmin = computed(() => this.hasRole('admin'));
  readonly isStaff = computed(() => this.hasRole('roundsman'));

  /**
   * Petición de renovación en curso.
   *
   * Si varias llamadas reciben un error de sesión a la vez, todas esperan a la
   * misma renovación en lugar de lanzar una cada una, lo que gastaría refresh
   * tokens y dispararía la detección de reutilización del servidor.
   */
  private refreshInFlight: Promise<string | null> | null = null;

  /** Restaura la sesión guardada. La llama `APP_INITIALIZER` al arrancar. */
  async restore(): Promise<void> {
    try {
      const [token, user] = await Promise.all([
        this.storage.get<string>(StorageKey.AccessToken),
        this.storage.get<User>(StorageKey.User),
      ]);

      if (!token) {
        return;
      }

      // Se muestra enseguida el usuario guardado para no dejar la interfaz en
      // blanco, y a la vez se comprueba contra el servidor por si el rol o el
      // perfil cambiaron desde la última vez.
      this.userSignal.set(user);

      await this.setUser(await this.fetchMe());
    } catch {
      // Un token caducado o revocado deja la sesión cerrada, sin más ruido.
      await this.clearSession();
    } finally {
      this.readySignal.set(true);
    }
  }

  async login(credentials: LoginRequest): Promise<User> {
    const { login } = await this.gql.request<{ login: AuthSession }>(LOGIN, { input: credentials });

    return this.acceptSession(login);
  }

  async register(request: RegisterRequest): Promise<User> {
    const { register } = await this.gql.request<{ register: AuthSession }>(REGISTER, {
      input: request,
    });

    return this.acceptSession(register);
  }

  async loginWithProvider(request: SocialLoginRequest): Promise<User> {
    const { socialLogin } = await this.gql.request<{ socialLogin: AuthSession }>(SOCIAL_LOGIN, {
      input: request,
    });

    return this.acceptSession(socialLogin);
  }

  async logout(options: { everywhere?: boolean; redirect?: boolean } = {}): Promise<void> {
    const refreshToken = await this.storage.get<string>(StorageKey.RefreshToken);

    try {
      await this.gql.request(LOGOUT, {
        refreshToken,
        everywhere: options.everywhere ?? false,
      });
    } catch {
      // Aunque el servidor no conteste, la sesión local debe cerrarse igual.
    }

    await this.clearSession();

    if (options.redirect !== false) {
      await this.router.navigateByUrl('/login');
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await this.gql.request(CHANGE_PASSWORD, { input: request });
    // El servidor revoca todas las sesiones al cambiar la contraseña.
    await this.clearSession();
  }

  async forgotPassword(email: string, lang?: string): Promise<void> {
    await this.gql.request(FORGOT_PASSWORD, { input: { email, lang } });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.gql.request(RESET_PASSWORD, { input: { token, password } });
  }

  async resendVerification(): Promise<void> {
    await this.gql.request(RESEND_VERIFICATION);
  }

  /** Vuelve a leer el perfil del servidor y actualiza el estado local. */
  async refreshUser(): Promise<User> {
    const user = await this.fetchMe();
    await this.setUser(user);

    return user;
  }

  /** Reemplaza el usuario en memoria y en disco tras editar el perfil. */
  async setUser(user: User): Promise<void> {
    this.userSignal.set(user);
    await this.storage.set(StorageKey.User, user);
  }

  async accessToken(): Promise<string | null> {
    return this.storage.get<string>(StorageKey.AccessToken);
  }

  /**
   * Renueva el token de acceso.
   *
   * Devuelve el token nuevo, o `null` si la sesión ya no es válida, en cuyo
   * caso queda cerrada.
   */
  async refreshAccessToken(): Promise<string | null> {
    this.refreshInFlight ??= this.performRefresh().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  /** Comprueba el rol contra la jerarquía: `admin` cumple cualquier exigencia. */
  hasRole(minimum: UserRole): boolean {
    const current = this.userSignal()?.role;

    if (!current) {
      return false;
    }

    return ROLE_HIERARCHY.indexOf(current) >= ROLE_HIERARCHY.indexOf(minimum);
  }

  private async fetchMe(): Promise<User> {
    const { me } = await this.gql.request<{ me: User }>(ME);

    return me;
  }

  private async performRefresh(): Promise<string | null> {
    const refreshToken = await this.storage.get<string>(StorageKey.RefreshToken);

    if (!refreshToken) {
      await this.clearSession();

      return null;
    }

    try {
      const { refreshTokens } = await this.gql.request<{ refreshTokens: AuthTokens }>(
        REFRESH_TOKENS,
        { refreshToken },
      );
      await this.storeTokens(refreshTokens);

      return refreshTokens.accessToken;
    } catch {
      await this.clearSession();

      return null;
    }
  }

  private async acceptSession(session: AuthSession): Promise<User> {
    await this.storeTokens(session);
    await this.setUser(session.user);
    this.readySignal.set(true);

    return session.user;
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      this.storage.set(StorageKey.AccessToken, tokens.accessToken),
      this.storage.set(StorageKey.RefreshToken, tokens.refreshToken),
    ]);
  }

  private async clearSession(): Promise<void> {
    this.userSignal.set(null);
    await this.storage.clearSession();
  }
}
