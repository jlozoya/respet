import { Module } from '@nestjs/common';

import { PostsResolver } from './posts.resolver.js';
import { PostsService } from './posts.service.js';

@Module({
  providers: [PostsResolver, PostsService],
  exports: [PostsService],
})
export class PostsModule {}
