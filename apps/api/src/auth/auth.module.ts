import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SocialVerifierService } from './social/social-verifier.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    // Los secretos y las caducidades se pasan en cada firma, no aquí: el
    // access token y el refresh token usan claves distintas.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthResolver,
    AuthService,
    PasswordService,
    TokenService,
    SocialVerifierService,
    JwtStrategy,
  ],
  exports: [AuthService, PasswordService, TokenService],
})
export class AuthModule {}
