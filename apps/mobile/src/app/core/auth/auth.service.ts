import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  AuthSession,
  AuthTokens,
  ChangePasswordRequest,
  CompleteMfaLoginRequest,
  LoginRequest,
  LoginResult,
  MfaChallenge,
  MfaLoginResult,
  RegisterRequest,
  SocialLoginRequest,
  User,
  UserRole,
} from '@social-network/shared';
import { ROLE_HIERARCHY } from '@social-network/shared';

import { ApiError } from '../api/api-error';
import { USER_FRAGMENTS, gql } from '../api/fragments';
import { GraphqlClientService } from '../api/graphql-client.service';
import { StorageKey, StorageService } from '../storage/storage.service';

const SESSION_FIELDS = `accessToken refreshToken tokenType expiresIn sessionId user { ...UserFields }`;

const LOGIN_RESULT_FIELDS = `
  status
  session { ${SESSION_FIELDS} }
  challenge { token methods expiresAt }
`;

export const ME = gql(`query Me { me { ...UserFields } }`, ...USER_FRAGMENTS);

const LOGIN = gql(
  `mutation Login($input: LoginInput!) {
    login(input: $input) { ${LOGIN_RESULT_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

const SOCIAL_LOGIN = gql(
  `mutation SocialLogin($input: SocialLoginInput!) {
    socialLogin(input: $input) { ${LOGIN_RESULT_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

const COMPLETE_MFA_LOGIN = gql(
  `mutation CompleteMfaLogin($input: CompleteMfaLoginInput!) {
    completeMfaLogin(input: $input) { ${SESSION_FIELDS} trustedDeviceToken }
  }`,
  ...USER_FRAGMENTS,
);

const REGISTER = gql(
  `mutation Register($input: RegisterInput!) {
    register(input: $input) { ${SESSION_FIELDS} }
  }`,
  ...USER_FRAGMENTS,
);

const REFRESH_TOKENS = `
mutation RefreshTokens($refreshToken: String!) {
  refreshTokens(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    tokenType
    expiresIn
    sessionId
  }
}`;

const LOGOUT = `mutation Logout($everywhere: Boolean) { logout(everywhere: $everywhere) }`;

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

const VERIFY_EMAIL = `mutation VerifyEmail($token: String!) { verifyEmail(token: $token) }`;

const RESEND_VERIFICATION = `mutation ResendVerification { resendVerification }`;

/**
 * Las operaciones que no dependen de la sesión.
 *
 * `authInterceptor` las mira por su nombre para no intentar renovar el token
 * cuando fallan: entrar con una contraseña equivocada o canjear un refresh
 * token ya usado fallan por lo que fallan, y reintentarlas con un token nuevo
 * no arreglaría nada.
 */
export const PUBLIC_OPERATIONS = [
  'Login',
  'Register',
  'SocialLogin',
  'CompleteMfaLogin',
  'RefreshTokens',
  'ForgotPassword',
  'ResetPassword',
  'VerifyEmail',
  'Logout',
];

/** Lo que devuelve el primer paso de un inicio de sesión. */
export type LoginOutcome =
  | { status: 'authenticated'; user: User }
  | { status: 'mfa_required'; challenge: MfaChallenge; email: string | null };

/** Margen con el que se renueva un token antes de que caduque. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Estado de la sesión.
 *
 * Se expone con señales, así que las plantillas leen `auth.user()` y se
 * actualizan solas.
 *
 * Cada dispositivo es una sesión en el servidor, con su propio refresh token
 * que rota en cada uso. Lo que se guarda aquí es el par vigente y el id de la
 * sesión, que sirve para marcar «este dispositivo» en la lista de sesiones.
 *
 * Con la verificación en dos pasos el inicio de sesión tiene dos tiempos: la
 * contraseña devuelve un reto, y el código lo canjea por la sesión. Si se pide
 * confiar en el dispositivo, el servidor da un token que se guarda por cuenta
 * y se presenta en los siguientes inicios para saltarse el segundo paso.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gql = inject(GraphqlClientService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<User | null>(null);
  private readonly readySignal = signal(false);
  private readonly sessionIdSignal = signal<string | null>(null);

  /** Usuario autenticado, o `null` si no hay sesión. */
  readonly user = this.userSignal.asReadonly();
  /** Cierto una vez leída la sesión guardada; hasta entonces conviene esperar. */
  readonly ready = this.readySignal.asReadonly();
  /** La sesión de este dispositivo en el servidor. */
  readonly sessionId = this.sessionIdSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly role = computed<UserRole>(() => this.userSignal()?.role ?? 'visitor');
  readonly isAdmin = computed(() => this.hasRole('admin'));
  readonly isStaff = computed(() => this.hasRole('roundsman'));

  /**
   * Renovación en curso.
   *
   * Si varias llamadas reciben un error de sesión a la vez, todas esperan a la
   * misma renovación: lanzar una cada una gastaría el refresh token en la
   * primera y haría que el servidor viera reutilizado el de las demás.
   */
  private refreshInFlight: Promise<string | null> | null = null;

  /** Restaura la sesión guardada. La llama `provideAppInitializer`. */
  async restore(): Promise<void> {
    try {
      const [token, user, sessionId] = await Promise.all([
        this.storage.get<string>(StorageKey.AccessToken),
        this.storage.get<User>(StorageKey.User),
        this.storage.get<string>(StorageKey.SessionId),
      ]);

      if (!token) {
        return;
      }

      // Se muestra enseguida el usuario guardado para no dejar la interfaz en
      // blanco, y a la vez se comprueba contra el servidor por si el rol o el
      // perfil cambiaron desde la última vez.
      this.userSignal.set(user);
      this.sessionIdSignal.set(sessionId);

      await this.setUser(await this.fetchMe());
    } catch (error) {
      // Sin red se sigue con lo guardado: la aplicación debe abrir en el metro.
      // Un token caducado o revocado, en cambio, deja la sesión cerrada.
      if (!(error instanceof ApiError && error.isNetworkError)) {
        await this.clearSession();
      }
    } finally {
      this.readySignal.set(true);
    }
  }

  /**
   * Primer paso del inicio de sesión.
   *
   * Presenta, si lo hay, el token de dispositivo de confianza de esa cuenta:
   * con él el servidor abre la sesión sin pedir el código.
   */
  async login(credentials: LoginRequest): Promise<LoginOutcome> {
    const trustedDeviceToken = await this.trustedDeviceTokenFor(credentials.email);
    const { login } = await this.gql.request<{ login: LoginResult }>(LOGIN, {
      input: { ...credentials, trustedDeviceToken },
    });

    return this.acceptLoginResult(login, credentials.email);
  }

  async loginWithProvider(request: SocialLoginRequest): Promise<LoginOutcome> {
    const trustedDeviceToken = await this.trustedDeviceTokenFor(null);
    const { socialLogin } = await this.gql.request<{ socialLogin: LoginResult }>(SOCIAL_LOGIN, {
      input: { ...request, trustedDeviceToken },
    });

    return this.acceptLoginResult(socialLogin, null);
  }

  /** Segundo paso: canjea el código por la sesión. */
  async completeMfaLogin(request: CompleteMfaLoginRequest): Promise<User> {
    const { completeMfaLogin } = await this.gql.request<{ completeMfaLogin: MfaLoginResult }>(
      COMPLETE_MFA_LOGIN,
      { input: { ...request, code: request.code.replace(/\s+/g, '') } },
    );

    if (completeMfaLogin.trustedDeviceToken) {
      await this.rememberTrustedDevice(
        completeMfaLogin.user.email,
        completeMfaLogin.trustedDeviceToken,
      );
    }

    return this.acceptSession(completeMfaLogin);
  }

  async register(request: RegisterRequest): Promise<User> {
    const { register } = await this.gql.request<{ register: AuthSession }>(REGISTER, {
      input: request,
    });

    return this.acceptSession(register);
  }

  /**
   * Cierra la sesión de este dispositivo, o de todos con `everywhere`.
   *
   * La sesión local se olvida aunque el servidor no conteste: quien pulsa
   * «Salir» espera salir, haya red o no.
   */
  async logout(options: { everywhere?: boolean; redirect?: boolean } = {}): Promise<void> {
    try {
      await this.gql.request(LOGOUT, { everywhere: options.everywhere ?? false });
    } catch {
      // Sin red, o con la sesión ya cerrada en el servidor: da igual.
    }

    await this.clearSession();

    if (options.redirect !== false) {
      await this.router.navigateByUrl('/login');
    }
  }

  /**
   * Cambia la contraseña.
   *
   * Por defecto el servidor cierra el resto de sesiones pero no ésta, así que
   * se sigue dentro.
   */
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await this.gql.request(CHANGE_PASSWORD, { input: request });
  }

  async forgotPassword(email: string, lang?: string): Promise<void> {
    await this.gql.request(FORGOT_PASSWORD, { input: { email, lang } });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.gql.request(RESET_PASSWORD, { input: { token, password } });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.gql.request(VERIFY_EMAIL, { token });

    if (this.userSignal()) {
      await this.refreshUser().catch(() => undefined);
    }
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

  /** Cambia sólo unos campos del usuario, sin volver a pedirlo. */
  async patchUser(changes: Partial<User>): Promise<void> {
    const current = this.userSignal();

    if (current) {
      await this.setUser({ ...current, ...changes });
    }
  }

  async accessToken(): Promise<string | null> {
    return this.storage.get<string>(StorageKey.AccessToken);
  }

  /**
   * Un token de acceso que aún tenga vida por delante.
   *
   * Lo usa la conexión de tiempo real, que presenta el token una sola vez al
   * conectarse: mejor renovarlo antes que ver cómo el servidor la rechaza.
   */
  async freshAccessToken(): Promise<string | null> {
    const token = await this.accessToken();

    if (!token) {
      return null;
    }

    const expiresAt = expiryOf(token);

    if (expiresAt !== null && expiresAt - Date.now() < EXPIRY_MARGIN_MS) {
      return this.refreshAccessToken();
    }

    return token;
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

  /**
   * Olvida la sesión local sin hablar con el servidor.
   *
   * Para cuando el servidor ya la ha cerrado por su cuenta —desde otro
   * dispositivo, por cambio de contraseña—: no hay nada que avisarle.
   */
  async forgetSession(options: { redirect?: boolean } = {}): Promise<void> {
    await this.clearSession();

    if (options.redirect !== false) {
      await this.router.navigateByUrl('/login');
    }
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
        {
          refreshToken,
        },
      );
      await this.storeTokens(refreshTokens);

      return refreshTokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.is('SERVER.REFRESH_RACE')) {
        // Otra pestaña acaba de renovar con el mismo token. El par nuevo ya
        // estará guardado —el almacén es común— o lo estará en un instante.
        return this.adoptTokensFromOtherTab(refreshToken);
      }

      if (error instanceof ApiError && error.isNetworkError) {
        // Sin red no se sabe nada de la sesión: no hay motivo para cerrarla.
        return null;
      }

      await this.clearSession();

      return null;
    }
  }

  private async adoptTokensFromOtherTab(usedRefreshToken: string): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await this.storage.get<string>(StorageKey.RefreshToken);

      if (stored && stored !== usedRefreshToken) {
        return this.accessToken();
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return null;
  }

  private async acceptLoginResult(
    result: LoginResult,
    email: string | null,
  ): Promise<LoginOutcome> {
    if (result.status === 'mfa_required' && result.challenge) {
      return { status: 'mfa_required', challenge: result.challenge, email };
    }

    if (!result.session) {
      throw new ApiError(500, 'SERVER.ERROR', 'Login returned neither a session nor a challenge');
    }

    return { status: 'authenticated', user: await this.acceptSession(result.session) };
  }

  private async acceptSession(session: AuthSession): Promise<User> {
    await this.storeTokens(session);
    await this.setUser(session.user);
    this.readySignal.set(true);

    return session.user;
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    this.sessionIdSignal.set(tokens.sessionId);

    await Promise.all([
      this.storage.set(StorageKey.AccessToken, tokens.accessToken),
      this.storage.set(StorageKey.RefreshToken, tokens.refreshToken),
      this.storage.set(StorageKey.SessionId, tokens.sessionId),
    ]);
  }

  private async clearSession(): Promise<void> {
    this.userSignal.set(null);
    this.sessionIdSignal.set(null);
    await this.storage.clearSession();
  }

  /**
   * El token de confianza de una cuenta.
   *
   * Sin correo —al entrar con Google o Facebook no se sabe de antemano con qué
   * cuenta— se presenta el último que se guardó: si no es de esa cuenta, el
   * servidor lo ignora y pide el código como siempre.
   */
  private async trustedDeviceTokenFor(email: string | null): Promise<string | undefined> {
    const devices = (await this.storage.get<TrustedDeviceTokens>(StorageKey.TrustedDevices)) ?? {};

    if (email) {
      return devices[email.trim().toLowerCase()]?.token;
    }

    return Object.values(devices).sort((a, b) => b.savedAt - a.savedAt)[0]?.token;
  }

  private async rememberTrustedDevice(email: string, token: string): Promise<void> {
    const devices = (await this.storage.get<TrustedDeviceTokens>(StorageKey.TrustedDevices)) ?? {};
    devices[email.trim().toLowerCase()] = { token, savedAt: Date.now() };
    await this.storage.set(StorageKey.TrustedDevices, devices);
  }
}

type TrustedDeviceTokens = Record<string, { token: string; savedAt: number }>;

/** Cuándo caduca un JWT, leyendo su `exp` sin verificar la firma. */
function expiryOf(token: string): number | null {
  try {
    const payload = token.split('.')[1];

    if (!payload) {
      return null;
    }

    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };

    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
