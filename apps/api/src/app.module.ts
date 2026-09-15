import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BulletinsModule } from './bulletins/bulletins.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { buildConfig } from './config/configuration.js';
import { GraphqlApiModule } from './graphql/graphql.module.js';
import { HealthController } from './health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { MediaModule } from './media/media.module.js';
import { PostsModule } from './posts/posts.module.js';
import { DatabaseModule } from './database/database.module.js';
import { StoreModule } from './store/store.module.js';
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
    GraphqlApiModule,
    MailModule,
    MediaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    BulletinsModule,
    SupportModule,
    AnalyticsModule,
    ChatModule,
    StoreModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // El orden importa: primero el límite de peticiones, después la
    // autenticación y por último el rol, que necesita saber quién es el usuario.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
