import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Comment, CommentLikeResult, Paginated } from '@social-network/shared';

import {
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CommentLikeResultType, CommentPage, CommentType } from '../graphql/types/social.types.js';
import { CommentsService } from './comments.service.js';
import { CommentListQueryDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

@Resolver(() => CommentType)
export class CommentsResolver {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Scopes('user_posts')
  @Query(() => CommentPage, {
    name: 'comments',
    description: 'Comentarios de primer nivel de una publicación, o las respuestas de uno con `parentId`.',
  })
  async list(
    @Args('postId', { type: () => ID }, ParseObjectIdPipe) postId: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => CommentListQueryDto, nullable: true }) query: CommentListQueryDto = {},
  ): Promise<Paginated<Comment>> {
    return this.comments.list(postId, query, viewer?.id ?? null);
  }

  @Scopes('publish_posts')
  @RateLimit({ limit: 200, windowSeconds: 3600 })
  @Mutation(() => CommentType)
  async createComment(
    @Args('postId', { type: () => ID }, ParseObjectIdPipe) postId: string,
    @Args('input') input: CreateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Comment> {
    return this.comments.create(postId, actor, input);
  }

  @Scopes('publish_posts')
  @Mutation(() => CommentType)
  async updateComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Comment> {
    return this.comments.update(id, input, actor);
  }

  @Scopes('publish_posts')
  @Mutation(() => Boolean, { description: 'Retira un comentario propio, o uno ajeno en una publicación propia.' })
  async deleteComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.comments.remove(id, actor);

    return true;
  }

  @RateLimit({ limit: 600, windowSeconds: 3600 })
  @Mutation(() => CommentLikeResultType)
  async likeComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<CommentLikeResult> {
    return this.comments.like(id, userId);
  }

  @Mutation(() => CommentLikeResultType)
  async unlikeComment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<CommentLikeResult> {
    return this.comments.unlike(id, userId);
  }
}
