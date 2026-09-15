import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { Public } from '../common/decorators/index.js';
import { AuthService } from './auth.service.js';
import { VerifyEmailQueryDto } from './dto/auth.dto.js';

/**
 * El enlace de confirmación del correo, que no puede ser una consulta.
 *
 * Quien lo abre es una persona en un navegador, no la aplicación: hay que
 * responder con una redirección a una pantalla, no con un JSON. Todo lo demás
 * de la autenticación vive en `AuthResolver`.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query() query: VerifyEmailQueryDto, @Res() response: Response): Promise<void> {
    const clientUrl = this.config.getOrThrow<string>('clientUrl');

    try {
      await this.auth.verifyEmail(query.token);
      response.redirect(`${clientUrl}/login?verified=1`);
    } catch {
      // Más vale llevar a una pantalla con explicación que devolver un error
      // en crudo a alguien que sólo ha pulsado un enlace de su correo.
      response.redirect(`${clientUrl}/login?verified=0`);
    }
  }
}
