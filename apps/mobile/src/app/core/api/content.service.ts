import { Injectable, inject } from '@angular/core';
import type {
  Analytics,
  AnalyticsQuery,
  Bulletin,
  Comment,
  CommentListQuery,
  CreateBulletinRequest,
  CreateCommentRequest,
  CreatePostRequest,
  CreateSupportRequest,
  Media,
  Paginated,
  Post,
  PostListQuery,
  PostVoteResult,
  ReportPostRequest,
  SupportTicket,
  UpdateBulletinRequest,
  UpdateCommentRequest,
  UpdatePostRequest,
  UsersRegistrationPoint,
  VoteValue,
} from '@respet/shared';

import { ApiClientService } from './api-client.service';
import {
  BULLETIN_FRAGMENTS,
  COMMENT_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  POST_FRAGMENTS,
  SUPPORT_TICKET_FRAGMENTS,
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

const POST = gql(
  `query PostById($id: ID!) {
    post(id: $id) { ...PostFields }
  }`,
  ...POST_FRAGMENTS,
);

const CREATE_POST = gql(
  `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) { ...PostFields }
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

const REPORT_POST = `
mutation ReportPost($id: ID!, $input: ReportPostInput!) {
  reportPost(id: $id, input: $input)
}`;

const REMOVE_POST_MEDIA = `
mutation RemovePostMedia($id: ID!, $mediaId: ID!) {
  removePostMedia(id: $id, mediaId: $mediaId)
}`;

const VOTE_POST = `
mutation VotePost($id: ID!, $value: VoteValue!) {
  votePost(id: $id, value: $value) { likeCount dislikeCount myVote }
}`;

const UNVOTE_POST = `
mutation UnvotePost($id: ID!) {
  unvotePost(id: $id) { likeCount dislikeCount myVote }
}`;

/** Publicaciones del muro. */
@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly gql = inject(GraphqlClientService);
  private readonly api = inject(ApiClientService);

  async list(query: PostListQuery = {}): Promise<Paginated<Post>> {
    const { posts } = await this.gql.request<{ posts: Paginated<Post> }>(POSTS, { query });

    return posts;
  }

  async findById(id: string): Promise<Post> {
    const { post } = await this.gql.request<{ post: Post }>(POST, { id });

    return post;
  }

  async create(request: CreatePostRequest): Promise<Post> {
    const { createPost } = await this.gql.request<{ createPost: Post }>(CREATE_POST, {
      input: request,
    });

    return createPost;
  }

  async update(id: string, request: UpdatePostRequest): Promise<Post> {
    const { updatePost } = await this.gql.request<{ updatePost: Post }>(UPDATE_POST, {
      id,
      input: request,
    });

    return updatePost;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_POST, { id });
  }

  /** Denuncia una publicación para que la revise la administración. */
  async report(id: string, request: ReportPostRequest): Promise<void> {
    await this.gql.request(REPORT_POST, { id, input: request });
  }

  /** La imagen viaja como formulario: es lo único que no pasa por el esquema. */
  addImage(id: string, file: Blob, filename?: string): Promise<Media> {
    return this.api.upload<Media>(`/posts/${id}/media`, file, filename);
  }

  async removeImage(id: string, mediaId: string): Promise<void> {
    await this.gql.request(REMOVE_POST_MEDIA, { id, mediaId });
  }

  /**
   * Vota una publicación a favor o en contra.
   *
   * El servidor devuelve las cuentas ya hechas en lugar de un simple «vale»: si
   * la aplicación sumara uno por su cuenta, dos pestañas abiertas acabarían
   * enseñando cifras distintas.
   */
  async vote(id: string, value: VoteValue): Promise<PostVoteResult> {
    const { votePost } = await this.gql.request<{ votePost: PostVoteResult }>(VOTE_POST, {
      id,
      value,
    });

    return votePost;
  }

  /** Retira el voto propio, sea cual sea. */
  async unvote(id: string): Promise<PostVoteResult> {
    const { unvotePost } = await this.gql.request<{ unvotePost: PostVoteResult }>(UNVOTE_POST, {
      id,
    });

    return unvotePost;
  }
}

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

/** Comentarios de una publicación. */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly gql = inject(GraphqlClientService);

  async list(postId: string, query: CommentListQuery = {}): Promise<Paginated<Comment>> {
    const { comments } = await this.gql.request<{ comments: Paginated<Comment> }>(COMMENTS, {
      postId,
      query,
    });

    return comments;
  }

  async create(postId: string, request: CreateCommentRequest): Promise<Comment> {
    const { createComment } = await this.gql.request<{ createComment: Comment }>(CREATE_COMMENT, {
      postId,
      input: request,
    });

    return createComment;
  }

  async update(id: string, request: UpdateCommentRequest): Promise<Comment> {
    const { updateComment } = await this.gql.request<{ updateComment: Comment }>(UPDATE_COMMENT, {
      id,
      input: request,
    });

    return updateComment;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_COMMENT, { id });
  }
}

const BULLETINS = gql(
  `query Bulletins($query: BulletinListQueryInput) {
    bulletins(query: $query) {
      data { ...BulletinFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...BULLETIN_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const BULLETIN = gql(
  `query BulletinById($id: ID!) {
    bulletin(id: $id) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const CREATE_BULLETIN = gql(
  `mutation CreateBulletin($input: CreateBulletinInput!) {
    createBulletin(input: $input) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const UPDATE_BULLETIN = gql(
  `mutation UpdateBulletin($id: ID!, $input: UpdateBulletinInput!) {
    updateBulletin(id: $id, input: $input) { ...BulletinFields }
  }`,
  ...BULLETIN_FRAGMENTS,
);

const DELETE_BULLETIN = `mutation DeleteBulletin($id: ID!) { deleteBulletin(id: $id) }`;

/** Avisos publicados por la administración. */
@Injectable({ providedIn: 'root' })
export class BulletinsService {
  private readonly gql = inject(GraphqlClientService);
  private readonly api = inject(ApiClientService);

  async list(
    query: { page?: number; perPage?: number; search?: string } = {},
  ): Promise<Paginated<Bulletin>> {
    const { bulletins } = await this.gql.request<{ bulletins: Paginated<Bulletin> }>(BULLETINS, {
      query,
    });

    return bulletins;
  }

  async findById(id: string): Promise<Bulletin> {
    const { bulletin } = await this.gql.request<{ bulletin: Bulletin }>(BULLETIN, { id });

    return bulletin;
  }

  async create(request: CreateBulletinRequest): Promise<Bulletin> {
    const { createBulletin } = await this.gql.request<{ createBulletin: Bulletin }>(
      CREATE_BULLETIN,
      { input: request },
    );

    return createBulletin;
  }

  async update(id: string, request: UpdateBulletinRequest): Promise<Bulletin> {
    const { updateBulletin } = await this.gql.request<{ updateBulletin: Bulletin }>(
      UPDATE_BULLETIN,
      { id, input: request },
    );

    return updateBulletin;
  }

  setImage(id: string, file: Blob, filename?: string): Promise<Bulletin> {
    return this.api.upload<Bulletin>(`/bulletins/${id}/media`, file, filename, 'PUT');
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_BULLETIN, { id });
  }
}

const CREATE_SUPPORT_TICKET = gql(
  `mutation CreateSupportTicket($input: CreateSupportInput!) {
    createSupportTicket(input: $input) { ...SupportTicketFields }
  }`,
  ...SUPPORT_TICKET_FRAGMENTS,
);

const SUPPORT_TICKETS = gql(
  `query SupportTickets($query: SupportListQueryInput) {
    supportTickets(query: $query) {
      data { ...SupportTicketFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...SUPPORT_TICKET_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

/** Formulario de contacto. */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly gql = inject(GraphqlClientService);

  async send(request: CreateSupportRequest): Promise<SupportTicket> {
    const { createSupportTicket } = await this.gql.request<{ createSupportTicket: SupportTicket }>(
      CREATE_SUPPORT_TICKET,
      { input: request },
    );

    return createSupportTicket;
  }

  async list(
    query: { page?: number; perPage?: number; search?: string } = {},
  ): Promise<Paginated<SupportTicket>> {
    const { supportTickets } = await this.gql.request<{ supportTickets: Paginated<SupportTicket> }>(
      SUPPORT_TICKETS,
      { query },
    );

    return supportTickets;
  }
}

const ANALYTICS = `
query AnalyticsSummary {
  analytics {
    usersTotal
    supportTotal
    postsTotal
    ordersTotal
    gender { male female other unknown }
    ages { children teens youngAdults adults unknown }
    providers { password google facebook apple }
  }
}`;

const USERS_REGISTRATION = `
query UsersRegistration($query: AnalyticsQueryInput) {
  usersRegistration(query: $query) { date users }
}`;

/** Cifras del panel de administración. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly gql = inject(GraphqlClientService);

  async summary(): Promise<Analytics> {
    const { analytics } = await this.gql.request<{ analytics: Analytics }>(ANALYTICS);

    return analytics;
  }

  async usersRegistration(query: AnalyticsQuery = {}): Promise<UsersRegistrationPoint[]> {
    const { usersRegistration } = await this.gql.request<{
      usersRegistration: UsersRegistrationPoint[];
    }>(USERS_REGISTRATION, { query });

    return usersRegistration;
  }
}
