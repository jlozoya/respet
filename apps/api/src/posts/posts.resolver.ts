import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Media, Paginated, Post, PostReactor, ReactionResult } from '@social-network/shared';

import {
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { ReactionType } from '../graphql/enums.js';
import { MediaType } from '../graphql/types/common.types.js';
import {
  PostPage,
  PostReactorPage,
  PostType,
  ReactionResultType,
} from '../graphql/types/social.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import {
  CreatePostDto,
  PostListQueryDto,
  ReactorListQueryDto,
  ReportPostDto,
  UpdatePostDto,
} from './dto/post.dto.js';
import { PostsService } from './posts.service.js';

@Resolver(() => PostType)
export class PostsResolver {
  constructor(private readonly posts: PostsService) {}

  /**
   * El muro.
   *
   * Se puede leer sin sesión —lo público—; con sesión, cada publicación trae
   * además la reacción propia y si se ha guardado.
   */
  @Public()
  @Scopes('user_posts')
  @Query(() => PostPage, { name: 'posts' })
  async list(
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => PostListQueryDto, nullable: true }) query: PostListQueryDto = {},
  ): Promise<Paginated<Post>> {
    return this.posts.list(query, viewer?.id ?? null);
  }

  @Public()
  @Scopes('user_posts')
  @Query(() => PostType, { name: 'post' })
  async findOne(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<Post> {
    return this.posts.findById(id, viewer?.id ?? null);
  }

  @Public()
  @Query(() => PostPage, { name: 'explore', description: 'Lo más destacado del último mes, con foto o vídeo.' })
  async explore(
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 30 }) perPage = 30,
  ): Promise<Paginated<Post>> {
    return this.posts.explore(viewer?.id ?? null, page, Math.min(perPage, 60));
  }

  @Query(() => PostPage, { name: 'savedPosts', description: 'Lo que has guardado, de lo último a lo primero.' })
  async savedPosts(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 20 }) perPage = 20,
  ): Promise<Paginated<Post>> {
    return this.posts.savedPosts(userId, page, Math.min(perPage, 60));
  }

  @Public()
  @Query(() => PostReactorPage, { name: 'postReactors', description: 'Quién reaccionó y con qué.' })
  async reactors(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => ReactorListQueryDto, nullable: true }) query: ReactorListQueryDto = {},
  ): Promise<Paginated<PostReactor>> {
    return this.posts.reactors(id, query, viewer?.id ?? null);
  }

  /**
   * Publica, con sus fotos y vídeos en la misma operación.
   *
   * Los archivos viajan con la especificación multipart de GraphQL: la
   * variable `files` es una lista de `Upload`.
   */
  @Scopes('publish_posts')
  @RateLimit({ limit: 60, windowSeconds: 3600 })
  @Mutation(() => PostType)
  async createPost(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input') input: CreatePostDto,
    @Args({ name: 'files', type: () => [GraphQLUpload], nullable: true }) files?: PendingUpload[],
  ): Promise<Post> {
    return this.posts.create(actor, input, files ?? []);
  }

  @Scopes('publish_posts')
  @Mutation(() => PostType)
  async updatePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdatePostDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Post> {
    return this.posts.update(id, input, actor);
  }

  @Scopes('publish_posts')
  @Mutation(() => Boolean)
  async deletePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.posts.remove(id, actor);

    return true;
  }

  @Scopes('publish_posts')
  @Mutation(() => MediaType, { description: 'Añade una foto o un vídeo a una publicación ya creada.' })
  async addPostMedia(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Media> {
    return this.posts.addMedia(id, file, actor);
  }

  @Scopes('publish_posts')
  @Mutation(() => Boolean)
  async removePostMedia(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('mediaId', { type: () => ID }, ParseObjectIdPipe) mediaId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.posts.removeMedia(id, mediaId, actor);

    return true;
  }

  /**
   * Reacciona. Elegir otra reacción sustituye a la anterior.
   *
   * Devuelve las cuentas ya hechas en lugar de un simple «vale»: si cada
   * cliente sumara uno por su cuenta, dos sesiones abiertas acabarían
   * enseñando cifras distintas.
   */
  @RateLimit({ limit: 600, windowSeconds: 3600 })
  @Mutation(() => ReactionResultType)
  async reactToPost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('type', { type: () => ReactionType }) type: ReactionType,
    @CurrentUser('id') userId: string,
  ): Promise<ReactionResult> {
    return this.posts.react(id, userId, type);
  }

  @Mutation(() => ReactionResultType, { description: 'Retira la reacción propia.' })
  async removePostReaction(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ReactionResult> {
    return this.posts.unreact(id, userId);
  }

  @Mutation(() => Boolean, { description: 'Guarda una publicación. Devuelve si queda guardada.' })
  async savePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    return this.posts.save(id, userId);
  }

  @Mutation(() => Boolean, { description: 'Deja de guardarla. Devuelve si queda guardada.' })
  async unsavePost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    return this.posts.unsave(id, userId);
  }

  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Mutation(() => Boolean, { description: 'Denuncia una publicación para que la revisen.' })
  async reportPost(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: ReportPostDto,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.posts.report(id, input, userId);

    return true;
  }
}
