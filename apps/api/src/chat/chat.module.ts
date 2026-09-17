import { Module } from '@nestjs/common';

import { ChatPresenterService } from './chat-presenter.service.js';
import { ChatResolver } from './chat.resolver.js';
import { ChatService } from './chat.service.js';

@Module({
  providers: [ChatResolver, ChatService, ChatPresenterService],
  exports: [ChatService],
})
export class ChatModule {}
