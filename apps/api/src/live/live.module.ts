import { Module } from '@nestjs/common';

import { LiveResolver } from './live.resolver.js';
import { LiveService } from './live.service.js';
import { LiveKitService } from './livekit.service.js';

@Module({
  providers: [LiveResolver, LiveService, LiveKitService],
})
export class LiveModule {}
