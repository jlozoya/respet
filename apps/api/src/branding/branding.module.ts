import { Module } from '@nestjs/common';

import { BrandingResolver } from './branding.resolver.js';

@Module({
  providers: [BrandingResolver],
})
export class BrandingModule {}
