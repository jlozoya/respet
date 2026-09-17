import { Module } from '@nestjs/common';

import { PostsModule } from '../posts/posts.module.js';
import { CommentsResolver } from './comments.resolver.js';
import { CommentsService } from './comments.service.js';

@Module({
  // Los comentarios heredan la visibilidad de su publicación: se pregunta al
  // servicio de publicaciones en lugar de repetir las reglas.
  imports: [PostsModule],
  providers: [CommentsResolver, CommentsService],
})
export class CommentsModule {}
