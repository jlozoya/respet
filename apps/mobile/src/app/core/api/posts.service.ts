import { Injectable, inject } from '@angular/core';
import type {
  Comment,
  CommentLikeResult,
  CommentListQuery,
  CreateCommentRequest,
  CreatePostRequest,
  Media,
  Paginated,
  Post,
  PostListQuery,
  PostReactor,
  ReactionResult,
  ReactionType,
  UpdateCommentRequest,
  UpdatePostRequest,
} from '@social-network/shared';
import { Subject } from 'rxjs';

import {
  COMMENT_FRAGMENTS,
  MEDIA_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  POST_FRAGMENTS,
  POST_GRID_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const POSTS = gql(
  `query Posts($query: PostListQueryInput) {
    posts(query: $query) {
      data { ...PostFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...POST_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const POST_GRID = gql(
  `query PostGrid($query: PostListQueryInput) {
    posts(query: $query) {
      data { ...PostGridFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...POST_GRID_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const EXPLORE = gql(
  `query Explore($page: Int, $perPage: Int) {
    explore(page: $page, perPage: $perPage) {
      data { ...PostGridFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...POST_GRID_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const SAVED_POSTS = gql(
  `query SavedPosts($page: Int, $perPage: Int) {
    savedPosts(page: $page, perPage: $perPage) {
      data { ...PostGridFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...POST_GRID_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const POST = gql(`query PostById($id: ID!) { post(id: $id) { ...PostFields } }`, ...POST_FRAGMENTS);

const CREATE_POST = gql(
  `mutation CreatePost($input: CreatePostInput!, $files: [Upload!]) {
    createPost(input: $input, files: $files) { ...PostFields }
  }`,
  ...POST_FRAGMENTS,
);

const UPDATE_POST = gql(
  `mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
    updatePost(id: $id, input: $input) { ...PostFields }
  }`,
  ...POST_FRAGMENTS,
);

const DELETE_POST = `mutation DeletePost($id: ID!) { deletePost(id: $id) }`;

const ADD_POST_MEDIA = gql(
  `mutation AddPostMedia($id: ID!, $file: Upload!) { addPostMedia(id: $id, file: $file) { ...MediaFields } }`,
  ...MEDIA_FRAGMENTS,
);

const REMOVE_POST_MEDIA = `
mutation RemovePostMedia($id: ID!, $mediaId: ID!) { removePostMedia(id: $id, mediaId: $mediaId) }`;

const REACTION_FIELDS = `reactionCount reactionSummary { type count } myReaction`;

const REACT_TO_POST = `
mutation ReactToPost($id: ID!, $type: ReactionType!) {
  reactToPost(id: $id, type: $type) { ${REACTION_FIELDS} }
}`;

const REMOVE_POST_REACTION = `
mutation RemovePostReaction($id: ID!) { removePostReaction(id: $id) { ${REACTION_FIELDS} } }`;

const POST_REACTORS = gql(
  `query PostReactors($id: ID!, $query: ReactorListQueryInput) {
    postReactors(id: $id, query: $query) {
      data { type followState user { ...UserSummaryFields } }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const SAVE_POST = `mutation SavePost($id: ID!) { savePost(id: $id) }`;
const UNSAVE_POST = `mutation UnsavePost($id: ID!) { unsavePost(id: $id) }`;

const REPORT_POST = `
mutation ReportPost($id: ID!, $input: ReportPostInput!) { reportPost(id: $id, input: $input) }`;

const COMMENTS = gql(
  `query Comments($postId: ID!, $query: CommentListQueryInput) {
    comments(postId: $postId, query: $query) {
      data { ...CommentFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...COMMENT_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const CREATE_COMMENT = gql(
  `mutation CreateComment($postId: ID!, $input: CreateCommentInput!) {
    createComment(postId: $postId, input: $input) { ...CommentFields }
  }`,
  ...COMMENT_FRAGMENTS,
);

const UPDATE_COMMENT = gql(
  `mutation UpdateComment($id: ID!, $input: UpdateCommentInput!) {
    updateComment(id: $id, input: $input) { ...CommentFields }
  }`,
  ...COMMENT_FRAGMENTS,
);

const DELETE_COMMENT = `mutation DeleteComment($id: ID!) { deleteComment(id: $id) }`;
const LIKE_COMMENT = `mutation LikeComment($id: ID!) { likeComment(id: $id) { likeCount likedByMe } }`;
const UNLIKE_COMMENT = `mutation UnlikeComment($id: ID!) { unlikeComment(id: $id) { likeCount likedByMe } }`;

/** Una casilla de la cuadrícula: la publicación con lo justo para pintarla. */
export type PostGridItem = Pick<
  Post,
  'id' | 'description' | 'media' | 'reactionCount' | 'commentCount'
>;

/** Un cambio en una publicación, para que lo vean todas las pantallas que la enseñan. */
export type PostChange =
  | { type: 'updated'; id: string; changes: Partial<Post> }
  | { type: 'deleted'; id: string }
  | { type: 'created'; post: Post };

/**
 * Publicaciones, reacciones y comentarios.
 *
 * La misma publicación puede estar a la vez en el muro, en su detalle y en el
 * perfil de su autor. `changes` avisa de lo que cambia —una reacción, un
 * comentario más, un borrado— para que cada pantalla actualice su copia sin
 * volver a pedirla.
 */
@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly gql = inject(GraphqlClientService);
  private readonly changesSubject = new Subject<PostChange>();

  readonly changes = this.changesSubject.asObservable();

  list(query: PostListQuery = {}): Promise<Paginated<Post>> {
    return this.gql.field(POSTS, { query });
  }

  /** Las mismas publicaciones que `list`, con lo justo para una cuadrícula. */
  grid(query: PostListQuery = {}): Promise<Paginated<PostGridItem>> {
    return this.gql.field(POST_GRID, { query });
  }

  explore(page = 1, perPage = 30): Promise<Paginated<PostGridItem>> {
    return this.gql.field(EXPLORE, { page, perPage });
  }

  saved(page = 1, perPage = 30): Promise<Paginated<PostGridItem>> {
    return this.gql.field(SAVED_POSTS, { page, perPage });
  }

  findById(id: string): Promise<Post> {
    return this.gql.field(POST, { id });
  }

  /** Publica, con las fotos y vídeos en la misma operación. */
  async create(request: CreatePostRequest, files: Blob[] = []): Promise<Post> {
    const post = await this.gql.field<Post>(CREATE_POST, {
      input: request,
      files: files.length ? files : null,
    });

    this.changesSubject.next({ type: 'created', post });

    if (request.sharedPostId) {
      this.emitUpdate(request.sharedPostId, {});
    }

    return post;
  }

  async update(id: string, request: UpdatePostRequest): Promise<Post> {
    const post = await this.gql.field<Post>(UPDATE_POST, { id, input: request });
    this.emitUpdate(id, post);

    return post;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_POST, { id });
    this.changesSubject.next({ type: 'deleted', id });
  }

  addMedia(id: string, file: Blob): Promise<Media> {
    return this.gql.field(ADD_POST_MEDIA, { id, file });
  }

  async removeMedia(id: string, mediaId: string): Promise<void> {
    await this.gql.request(REMOVE_POST_MEDIA, { id, mediaId });
  }

  async react(id: string, type: ReactionType): Promise<ReactionResult> {
    const result = await this.gql.field<ReactionResult>(REACT_TO_POST, { id, type });
    this.emitUpdate(id, result);

    return result;
  }

  async unreact(id: string): Promise<ReactionResult> {
    const result = await this.gql.field<ReactionResult>(REMOVE_POST_REACTION, { id });
    this.emitUpdate(id, result);

    return result;
  }

  reactors(
    id: string,
    query: { page?: number; perPage?: number; type?: ReactionType } = {},
  ): Promise<Paginated<PostReactor>> {
    return this.gql.field(POST_REACTORS, { id, query });
  }

  async save(id: string): Promise<boolean> {
    const saved = await this.gql.field<boolean>(SAVE_POST, { id });
    this.emitUpdate(id, { saved });

    return saved;
  }

  async unsave(id: string): Promise<boolean> {
    const saved = await this.gql.field<boolean>(UNSAVE_POST, { id });
    this.emitUpdate(id, { saved });

    return saved;
  }

  async report(id: string, reason: string): Promise<void> {
    await this.gql.request(REPORT_POST, { id, input: { reason } });
  }

  /** Anuncia un cambio hecho desde fuera de este servicio, como un comentario nuevo. */
  emitUpdate(id: string, changes: Partial<Post>): void {
    this.changesSubject.next({ type: 'updated', id, changes });
  }

  // --- Comentarios ----------------------------------------------------------

  comments(postId: string, query: CommentListQuery = {}): Promise<Paginated<Comment>> {
    return this.gql.field(COMMENTS, { postId, query });
  }

  createComment(postId: string, request: CreateCommentRequest): Promise<Comment> {
    return this.gql.field(CREATE_COMMENT, { postId, input: request });
  }

  updateComment(id: string, request: UpdateCommentRequest): Promise<Comment> {
    return this.gql.field(UPDATE_COMMENT, { id, input: request });
  }

  async removeComment(id: string): Promise<void> {
    await this.gql.request(DELETE_COMMENT, { id });
  }

  likeComment(id: string): Promise<CommentLikeResult> {
    return this.gql.field(LIKE_COMMENT, { id });
  }

  unlikeComment(id: string): Promise<CommentLikeResult> {
    return this.gql.field(UNLIKE_COMMENT, { id });
  }
}

/**
 * Aplica un cambio a una lista de publicaciones.
 *
 * Mira también dentro de las compartidas: si reaccionas a la original desde su
 * detalle, la tarjeta que la comparte en el muro debe enterarse.
 */
export function applyPostChange<T extends Pick<Post, 'id'>>(posts: T[], change: PostChange): T[] {
  if (change.type === 'deleted') {
    return posts.filter((post) => post.id !== change.id);
  }

  if (change.type === 'created') {
    return posts;
  }

  return posts.map((post) => (post.id === change.id ? { ...post, ...change.changes } : post));
}
