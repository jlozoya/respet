import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module.js';
import { StoriesResolver } from './stories.resolver.js';
import { StoriesService } from './stories.service.js';

@Module({
  // Las respuestas y reacciones a una historia llegan por privado.
  imports: [ChatModule],
  providers: [StoriesResolver, StoriesService],
})
export class StoriesModule {}
