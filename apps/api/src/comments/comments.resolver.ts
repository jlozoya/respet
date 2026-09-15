import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Comment, Paginated } from '@respet/shared';

import { CurrentUser, Public, type AuthenticatedUser } from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CommentPage, CommentType } from '../graphql/types/content.types.js';
import { CommentsService } from './comments.service.js';
import { CommentListQueryDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

/**
 * Comentarios de una publicación.
 *
 * Con REST el hilo colgaba de su publicación (`/posts/:id/comments`) y el
 * comentario suelto vivía en otra ruta. Aquí las dos cosas son operaciones con
 * nombre propio, y el `postId` es un argumento más.
 */
@Resolver(() => CommentType)
export class CommentsResolver {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Query(() => CommentPage, { name: 'comments', description: 'Hilo de una publicación.' })
  async list(
    @Args('postId', { type: () => ID }, ParseObjectIdPipe) postId: string,
    @Args('query', { type: () => CommentListQueryDto, nullable: true })
    query: CommentListQueryDto = {},
  ): Promise<Paginated<Comment>> {
    return this.comments.list(postId, query);
  }

  @Mutation(() => CommentType)
  async createComment(
    @Args('postId', { type: () => ID }, ParseObjectIdPipe) postId: string,
    @Args('input') input: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ): Promise<Comment> {
    return this.comments.create(postId, userId, input);
  }

  @Mutation(() => CommentType)
  async updateComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Comment> {
    return this.comments.update(id, input, actor);
  }

  @Mutation(() => Boolean, { description: 'Retira un comentario propio.' })
  async deleteComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.comments.remove(id, actor);

    return true;
  }
}
