import { Module } from '@nestjs/common';

import { BulletinsController } from './bulletins.controller.js';
import { BulletinsResolver } from './bulletins.resolver.js';
import { BulletinsService } from './bulletins.service.js';

@Module({
  controllers: [BulletinsController],
  providers: [BulletinsResolver, BulletinsService],
})
export class BulletinsModule {}
