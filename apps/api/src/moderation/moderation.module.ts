import { Global, Module } from '@nestjs/common';

import { ModerationResolver } from './moderation.resolver.js';
import { ModerationService } from './moderation.service.js';

@Global()
@Module({
  providers: [ModerationService, ModerationResolver],
  exports: [ModerationService],
})
export class ModerationModule {}
