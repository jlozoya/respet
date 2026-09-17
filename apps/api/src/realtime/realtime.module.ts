import { Global, Module } from '@nestjs/common';

import { EventBusService } from './event-bus.service.js';
import { PresenceService } from './presence.service.js';

/**
 * El tiempo real: bus de eventos y presencia.
 *
 * Es global porque publica casi todo el mundo —el muro, el chat, las
 * historias, los directos— y obligar a cada módulo a importarlo sólo añadía
 * líneas.
 */
@Global()
@Module({
  providers: [EventBusService, PresenceService],
  exports: [EventBusService, PresenceService],
})
export class RealtimeModule {}
