import { Module } from '@nestjs/common';

import { BulletinsResolver } from './bulletins.resolver.js';
import { BulletinsService } from './bulletins.service.js';

@Module({
  providers: [BulletinsResolver, BulletinsService],
})
export class BulletinsModule {}
