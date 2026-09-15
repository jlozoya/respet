import { Module } from '@nestjs/common';

import { PostsController } from './posts.controller.js';
import { PostsResolver } from './posts.resolver.js';
import { PostsService } from './posts.service.js';

@Module({
  controllers: [PostsController],
  providers: [PostsResolver, PostsService],
})
export class PostsModule {}
