import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BulletinsModule } from './bulletins/bulletins.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ScopesGuard } from './common/guards/scopes.guard.js';
import { buildConfig } from './config/configuration.js';
import { DatabaseModule } from './database/database.module.js';
import { AppRateLimitGuard } from './developers/app-rate-limit.guard.js';
import { DevelopersModule } from './developers/developers.module.js';
import { GraphqlApiModule } from './graphql/graphql.module.js';
import { HealthController } from './health.controller.js';
import { LiveModule } from './live/live.module.js';
import { MailModule } from './mail/mail.module.js';
import { MediaModule } from './media/media.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PostsModule } from './posts/posts.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SocialModule } from './social/social.module.js';
import { StoreModule } from './store/store.module.js';
import { StoriesModule } from './stories/stories.module.js';
import { SupportModule } from './support/support.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      // `buildConfig` valida el entorno completo y devuelve el objeto tipado,
      // así que un despliegue mal configurado falla al arrancar y no a mitad
      // de la primera petición que toque esa variable.
      load: [buildConfig],
    }),
    DatabaseModule,
    RealtimeModule,
    MailModule,
    MediaModule,
    AuthModule,
    GraphqlApiModule,
    NotificationsModule,
    SocialModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    StoriesModule,
    LiveModule,
    ChatModule,
    DevelopersModule,
    ModerationModule,
    BulletinsModule,
    SupportModule,
    AnalyticsModule,
    StoreModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // El orden importa: primero el límite por IP, después quién es, luego qué
    // puede hacer una aplicación de terceros y cuánto, y por último el rol.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ScopesGuard },
    { provide: APP_GUARD, useClass: AppRateLimitGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
