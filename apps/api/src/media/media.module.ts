import { Global, Module } from '@nestjs/common';

import { MediaService } from './media.service.js';
import { StorageService } from './storage.service.js';
import { VideoProcessorService } from './video-processor.service.js';

@Global()
@Module({
  providers: [StorageService, MediaService, VideoProcessorService],
  exports: [StorageService, MediaService],
})
export class MediaModule {}
