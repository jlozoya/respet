import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  AuthSession,
  AuthTokens,
  LoginResult,
  MfaLoginResult,
  User,
} from '@social-network/shared';

import {
  Client,
  CurrentUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
  type ClientInfo,
} from '../common/decorators/index.js';
import {
  AuthSessionType,
  AuthTokensType,
  LoginResultType,
  MfaLoginResultType,
} from '../graphql/types/auth.types.js';
import { UserType } from '../graphql/types/user.types.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  CompleteMfaLoginDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
} from './dto/auth.dto.js';

/**
 * Alta, acceso y salida.
 *
 * Las operaciones que no devuelven nada responden `true`: GraphQL no tiene
 * equivalente al 204 de REST, y un campo que sólo puede valer `true` dice lo
 * mismo —salió bien— sin obligar a inventar un tipo por cada mutación.
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit({ limit: 5, windowSeconds: 900 })
  @Mutation(() => AuthSessionType, { description: 'Da de alta una cuenta y abre sesión.' })
  async register(
    @Args('input') input: RegisterDto,
    @Client() client: ClientInfo,
  ): Promise<AuthSession> {
    return this.auth.register(input, client);
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 300 })
  @Mutation(() => LoginResultType, {
    description:
      'Primer paso del inicio de sesión. Con verificación en dos pasos devuelve un reto.',
  })
  async login(@Args('input') input: LoginDto, @Client() client: ClientInfo): Promise<LoginResult> {
    return this.auth.login(input, client);
  }

  /**
   * Entra con Google, Facebook o Apple.
   *
   * La app envía únicamente el token del proveedor; el servidor lo verifica y
   * crea o enlaza la cuenta con lo que le diga el proveedor, sin fiarse de
   * ningún dato de perfil que venga del cliente.
   */
  @Public()
  @RateLimit({ limit: 20, windowSeconds: 300 })
  @Mutation(() => LoginResultType)
  async socialLogin(
    @Args('input') input: SocialLoginDto,
    @Client() client: ClientInfo,
  ): Promise<LoginResult> {
    return this.auth.socialLogin(input, client);
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 300 })
  @Mutation(() => MfaLoginResultType, {
    description:
      'Segundo paso: completa el inicio de sesión con el código de la app o uno de recuperación.',
  })
  async completeMfaLogin(
    @Args('input') input: CompleteMfaLoginDto,
    @Client() client: ClientInfo,
  ): Promise<MfaLoginResult> {
    return this.auth.completeMfaLogin(input, client);
  }

  @Public()
  @RateLimit({ limit: 60, windowSeconds: 300 })
  @Mutation(() => AuthTokensType, {
    description: 'Canjea un refresh token por un par nuevo. El usado deja de valer.',
  })
  async refreshTokens(
    @Args('refreshToken') refreshToken: string,
    @Client() client: ClientInfo,
  ): Promise<AuthTokens> {
    return this.auth.refresh(refreshToken, client);
  }

  @Mutation(() => Boolean, {
    description: 'Cierra la sesión de este dispositivo, o todas con `everywhere`.',
  })
  async logout(
    @CurrentUser() actor: AuthenticatedUser,
    @Client() client: ClientInfo,
    @Args('everywhere', { type: () => Boolean, nullable: true, defaultValue: false })
    everywhere?: boolean,
  ): Promise<boolean> {
    await this.auth.logout(actor, everywhere === true, client);

    return true;
  }

  @Scopes('public_profile')
  @Query(() => UserType, { name: 'me', description: 'Perfil de quien consulta.' })
  async me(@CurrentUser('id') userId: string): Promise<User> {
    return this.auth.me(userId);
  }

  /**
   * Envía el enlace para restablecer la contraseña.
   *
   * Responde igual exista o no la cuenta, para no revelar qué correos están
   * registrados.
   */
  @Public()
  @RateLimit({ limit: 5, windowSeconds: 900 })
  @Mutation(() => Boolean)
  async forgotPassword(@Args('input') input: ForgotPasswordDto): Promise<boolean> {
    await this.auth.forgotPassword(input);

    return true;
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 900 })
  @Mutation(() => Boolean, { description: 'Fija una contraseña nueva con el token del correo.' })
  async resetPassword(
    @Args('input') input: ResetPasswordDto,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.auth.resetPassword(input, client);

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Cambia la contraseña. Por defecto cierra el resto de sesiones, no ésta.',
  })
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input') input: ChangePasswordDto,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.auth.changePassword(actor, input, client);

    return true;
  }

  /**
   * Confirma el correo con el token del enlace.
   *
   * Antes era una ruta HTTP que redirigía; ahora el enlace abre la aplicación
   * y es ella quien llama aquí, así que todo pasa por el esquema.
   */
  @Public()
  @RateLimit({ limit: 20, windowSeconds: 900 })
  @Mutation(() => Boolean, {
    description: 'Confirma una dirección de correo con el token del enlace.',
  })
  async verifyEmail(@Args('token') token: string): Promise<boolean> {
    await this.auth.verifyEmail(token);

    return true;
  }

  @RateLimit({ limit: 3, windowSeconds: 900 })
  @Mutation(() => Boolean, { description: 'Reenvía el correo de confirmación.' })
  async resendVerification(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.auth.resendVerification(userId);

    return true;
  }
}
