import { Module } from '@nestjs/common';

import { SupportResolver } from './support.resolver.js';
import { SupportService } from './support.service.js';

@Module({
  providers: [SupportResolver, SupportService],
})
export class SupportModule {}
