import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatResolver } from './chat.resolver.js';
import { ChatService } from './chat.service.js';

@Module({
  // El gateway verifica el mismo access token que el resto de la API, así que
  // necesita el servicio de JWT; los secretos se pasan en cada verificación.
  imports: [JwtModule.register({})],
  controllers: [ChatController],
  providers: [ChatResolver, ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
