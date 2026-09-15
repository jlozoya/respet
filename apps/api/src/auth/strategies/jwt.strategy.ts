import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AccessTokenPayload } from '@respet/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId } from '../../database/mongoose.js';
import type { Model } from '../../database/mongoose.js';

import type { AuthenticatedUser } from '../../common/decorators/index.js';
import { AppException } from '../../common/errors.js';
import { User } from '../../database/schemas/user.schema.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /**
   * Se ejecuta con la firma ya comprobada.
   *
   * Se vuelve a consultar el usuario en vez de confiar en el contenido del
   * token: así una cuenta borrada o un cambio de rol surten efecto de inmediato
   * y no cuando caduque el token.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = isValidObjectId(payload.sub)
      ? await this.users.findById(payload.sub).select('email role').lean()
      : null;

    if (!user) {
      throw AppException.unauthorized('The account linked to this token no longer exists');
    }

    return { id: String(user._id), email: user.email, role: user.role };
  }
}
