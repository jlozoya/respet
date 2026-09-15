import { Module } from '@nestjs/common';

import { CommentsResolver } from './comments.resolver.js';
import { CommentsService } from './comments.service.js';

@Module({
  providers: [CommentsResolver, CommentsService],
})
export class CommentsModule {}
