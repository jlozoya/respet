import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthSession, AuthTokens, User } from '@respet/shared';
import type { Request } from 'express';

import { CurrentUser, Public, RateLimit } from '../common/decorators/index.js';
import { AuthSessionType, AuthTokensType, UserType } from '../graphql/types/user.types.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
} from './dto/auth.dto.js';
import type { TokenContext } from './token.service.js';

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
    @Context('req') request: Request,
  ): Promise<AuthSession> {
    return this.auth.register(input, contextOf(request));
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 300 })
  @Mutation(() => AuthSessionType)
  async login(
    @Args('input') input: LoginDto,
    @Context('req') request: Request,
  ): Promise<AuthSession> {
    return this.auth.login(input, contextOf(request));
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
  @Mutation(() => AuthSessionType)
  async socialLogin(
    @Args('input') input: SocialLoginDto,
    @Context('req') request: Request,
  ): Promise<AuthSession> {
    return this.auth.socialLogin(input, contextOf(request));
  }

  @Public()
  @RateLimit({ limit: 60, windowSeconds: 300 })
  @Mutation(() => AuthTokensType, { description: 'Canjea un refresh token por un par nuevo.' })
  async refreshTokens(
    @Args('refreshToken') refreshToken: string,
    @Context('req') request: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(refreshToken, contextOf(request));
  }

  @Mutation(() => Boolean, {
    description: 'Cierra la sesión. Sin `refreshToken`, cierra todas las abiertas.',
  })
  async logout(
    @CurrentUser('id') userId: string,
    @Args('refreshToken', { type: () => String, nullable: true }) refreshToken?: string,
    @Args('everywhere', { type: () => Boolean, nullable: true, defaultValue: false })
    everywhere?: boolean,
  ): Promise<boolean> {
    await this.auth.logout(refreshToken, userId, everywhere === true);

    return true;
  }

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
  async resetPassword(@Args('input') input: ResetPasswordDto): Promise<boolean> {
    await this.auth.resetPassword(input);

    return true;
  }

  @Mutation(() => Boolean)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Args('input') input: ChangePasswordDto,
  ): Promise<boolean> {
    await this.auth.changePassword(userId, input);

    return true;
  }

  @RateLimit({ limit: 3, windowSeconds: 900 })
  @Mutation(() => Boolean, { description: 'Reenvía el correo de confirmación.' })
  async resendVerification(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.auth.resendVerification(userId);

    return true;
  }
}

function contextOf(request: Request): TokenContext {
  return {
    userAgent: request.get('user-agent') ?? undefined,
    ip: request.ip ?? undefined,
  };
}
