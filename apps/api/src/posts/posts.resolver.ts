import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Paginated, Post, PostVoteResult } from '@respet/shared';

import {
  CurrentUser,
  OptionalUser,
  Public,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { VoteValue } from '../graphql/enums.js';
import { PostPage, PostType, PostVoteResultType } from '../graphql/types/content.types.js';
import { CreatePostDto, PostListQueryDto, ReportPostDto, UpdatePostDto } from './dto/post.dto.js';
import { PostsService } from './posts.service.js';

@Resolver(() => PostType)
export class PostsResolver {
  constructor(private readonly posts: PostsService) {}

  /**
   * El muro.
   *
   * Con `lat` y `lng` el resultado se ordena por cercanía en lugar de por
   * fecha. Se puede leer sin sesión; quien la trae recibe además su propio
   * voto en cada publicación.
   */
  @Public()
  @Query(() => PostPage, { name: 'posts' })
  async list(
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => PostListQueryDto, nullable: true })
    query: PostListQueryDto = {},
  ): Promise<Paginated<Post>> {
    return this.posts.list(query, viewer?.id ?? null);
  }

  @Public()
  @Query(() => PostType, { name: 'post' })
  async findOne(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<Post> {
    return this.posts.findById(id, viewer?.id ?? null);
  }

  @Mutation(() => PostType)
  async createPost(
    @CurrentUser('id') userId: string,
    @Args('input') input: CreatePostDto,
  ): Promise<Post> {
    return this.posts.create(userId, input);
  }

  @Mutation(() => PostType)
  async updatePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdatePostDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Post> {
    return this.posts.update(id, input, actor);
  }

  @Mutation(() => Boolean)
  async deletePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.posts.remove(id, actor);

    return true;
  }

  @Mutation(() => Boolean, { description: 'Denuncia una publicación para que la revisen.' })
  async reportPost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: ReportPostDto,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.posts.report(id, input, userId);

    return true;
  }

  /**
   * Vota a favor o en contra.
   *
   * Votar lo contrario cambia el sentido; nadie tiene dos votos en la misma
   * publicación. Devuelve las cuentas ya hechas en lugar de un simple «vale»:
   * si cada cliente sumara uno por su cuenta, dos sesiones abiertas acabarían
   * enseñando cifras distintas.
   */
  @Mutation(() => PostVoteResultType)
  async votePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('value', { type: () => VoteValue }) value: VoteValue,
    @CurrentUser('id') userId: string,
  ): Promise<PostVoteResult> {
    return this.posts.vote(id, userId, value);
  }

  @Mutation(() => PostVoteResultType, { description: 'Retira el voto propio, sea cual sea.' })
  async unvotePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<PostVoteResult> {
    return this.posts.unvote(id, userId);
  }

  /**
   * Quita una imagen de la publicación.
   *
   * Añadirlas sigue siendo cosa de `POST /posts/:id/media`: el archivo viaja
   * como `multipart/form-data`, que es lo que GraphQL no sabe transportar.
   */
  @Mutation(() => Boolean)
  async removePostMedia(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('mediaId', { type: () => ID }, ParseObjectIdPipe) mediaId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.posts.removeMedia(id, mediaId, actor);

    return true;
  }
}
