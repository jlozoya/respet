import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import { AuthResolver } from './auth.resolver.js';
import { AuthService } from './auth.service.js';
import { CryptoService } from './crypto.service.js';
import { MfaService } from './mfa/mfa.service.js';
import { PasswordService } from './password.service.js';
import { ReauthService } from './reauth.service.js';
import { SecurityResolver } from './security.resolver.js';
import { LoginThrottleService } from './security/login-throttle.service.js';
import { SecurityAlertsService } from './security/security-alerts.service.js';
import { SecurityEventsService } from './security/security-events.service.js';
import { SessionService } from './session/session.service.js';
import { SocialVerifierService } from './social/social-verifier.service.js';
import { TokenService } from './token.service.js';

/**
 * Identidad: alta, acceso, sesiones, segundo factor y registro de seguridad.
 *
 * Es global porque el guard de autenticación —que se registra en la raíz— y
 * la conexión de las suscripciones necesitan verificar tokens, y lo mismo el
 * módulo de desarrolladores para emitir los de las aplicaciones de terceros.
 */
@Global()
@Module({
  imports: [
    // Los secretos y las caducidades se pasan en cada firma, no aquí.
    JwtModule.register({}),
  ],
  providers: [
    AuthResolver,
    SecurityResolver,
    AuthService,
    PasswordService,
    TokenService,
    CryptoService,
    SessionService,
    MfaService,
    ReauthService,
    LoginThrottleService,
    SecurityEventsService,
    SecurityAlertsService,
    SocialVerifierService,
    AccessTokenVerifierService,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    CryptoService,
    SessionService,
    MfaService,
    ReauthService,
    SecurityEventsService,
    SecurityAlertsService,
    AccessTokenVerifierService,
  ],
})
export class AuthModule {}
