import { Global, Module } from '@nestjs/common';

import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';

/** Avisos y notificaciones push. Global: los crean casi todos los módulos. */
@Global()
@Module({
  providers: [NotificationsService, PushService, NotificationsResolver],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
