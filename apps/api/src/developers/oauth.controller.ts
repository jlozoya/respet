import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_OAUTH_SCOPES } from '@social-network/shared';
import type { Response } from 'express';

import { Public, RateLimit } from '../common/decorators/index.js';
import { OAuthError, OAuthService } from './oauth.service.js';

interface TokenRequestBody {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  token?: string;
}

/**
 * Los extremos de OAuth que dicta el estándar.
 *
 * Son HTTP y no GraphQL por la misma razón que el aviso de PayPal: quien los
 * llama no es la aplicación oficial sino bibliotecas de terceros —AppAuth,
 * Passport, oauth2-client…— que esperan `POST /oauth/token` con un formulario
 * y una respuesta con la forma exacta de RFC 6749. Lo mismo está disponible
 * por el esquema (`exchangeOAuthCode`, `refreshOAuthToken`) para quien prefiera
 * GraphQL.
 *
 * La pantalla de autorización no está aquí: es una página de la aplicación
 * web, que habla con la API por GraphQL como el resto.
 */
@Controller()
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Post('oauth/token')
  @HttpCode(HttpStatus.OK)
  async token(
    @Body() body: TokenRequestBody,
    @Headers('authorization') authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    // Las respuestas con tokens no deben quedarse en ninguna caché (RFC 6749 §5.1).
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');

    try {
      const client = clientCredentials(body, authorization);

      if (body.grant_type === 'authorization_code') {
        if (!body.code || !body.redirect_uri) {
          throw new OAuthError('invalid_request', 'code and redirect_uri are required');
        }

        response.json(
          await this.oauth.exchangeCode({
            ...client,
            code: body.code,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
          }),
        );

        return;
      }

      if (body.grant_type === 'refresh_token') {
        if (!body.refresh_token) {
          throw new OAuthError('invalid_request', 'refresh_token is required');
        }

        response.json(await this.oauth.refresh({ ...client, refreshToken: body.refresh_token }));

        return;
      }

      throw new OAuthError(
        'unsupported_grant_type',
        'Supported grant types: authorization_code, refresh_token',
      );
    } catch (error) {
      sendOAuthError(response, error);
    }
  }

  @Public()
  @RateLimit({ limit: 60, windowSeconds: 60 })
  @Post('oauth/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Body() body: TokenRequestBody,
    @Headers('authorization') authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    try {
      if (body.token) {
        await this.oauth.revokeToken({
          ...clientCredentials(body, authorization),
          token: body.token,
        });
      }

      response.status(HttpStatus.OK).json({});
    } catch (error) {
      sendOAuthError(response, error);
    }
  }

  /** RFC 8414: dónde está cada cosa, para que las bibliotecas se configuren solas. */
  @Public()
  @Get('.well-known/oauth-authorization-server')
  metadata(): Record<string, unknown> {
    const api = this.config.getOrThrow<string>('appUrl');
    const client = this.config.getOrThrow<string>('clientUrl');

    return {
      issuer: api,
      authorization_endpoint: `${client}/oauth/authorize`,
      token_endpoint: `${api}/oauth/token`,
      revocation_endpoint: `${api}/oauth/revoke`,
      scopes_supported: ALL_OAUTH_SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
      service_documentation: `${client}/developers/docs`,
    };
  }
}

/** Las credenciales del cliente, en el cuerpo o con autenticación básica (RFC 6749 §2.3.1). */
function clientCredentials(
  body: TokenRequestBody,
  authorization: string | undefined,
): { clientId: string; clientSecret?: string } {
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');

    if (separator > 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    }
  }

  if (!body.client_id) {
    throw new OAuthError('invalid_client', 'client_id is required', HttpStatus.UNAUTHORIZED);
  }

  return { clientId: body.client_id, clientSecret: body.client_secret };
}

function sendOAuthError(response: Response, error: unknown): void {
  if (error instanceof OAuthError) {
    const payload = error.getResponse() as { message: string };

    response
      .status(error.getStatus())
      .json({ error: error.oauthCode, error_description: payload.message });

    return;
  }

  response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'server_error' });
}
