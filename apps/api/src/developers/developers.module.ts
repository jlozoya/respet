import { Module } from '@nestjs/common';

import { DeveloperAppsService } from './developer-apps.service.js';
import { DevelopersResolver } from './developers.resolver.js';
import { OAuthController } from './oauth.controller.js';
import { OAuthService } from './oauth.service.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';

/**
 * La API abierta a terceros: aplicaciones, OAuth, webhooks.
 *
 * El guard que limita a cada aplicación, `AppRateLimitGuard`, se registra en
 * la raíz junto al resto de guards globales.
 */
@Module({
  controllers: [OAuthController],
  providers: [DevelopersResolver, DeveloperAppsService, OAuthService, WebhookDispatcherService],
})
export class DevelopersModule {}
