import { Global, Module } from '@nestjs/common';

import { MediaService } from './media.service.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class MediaModule {}
