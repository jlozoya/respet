import { Injectable, inject } from '@angular/core';
import type {
  BlockedUser,
  Hashtag,
  OnlineContact,
  PresencePayload,
  ReportTarget,
  SearchResults,
  UserSuggestion,
} from '@social-network/shared';
import type { Observable } from 'rxjs';

import { RealtimeService } from '../realtime/realtime.service';
import {
  POST_FRAGMENTS,
  PUBLIC_PROFILE_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const SEARCH = gql(
  `query Search($term: String!, $limit: Int) {
    search(term: $term, limit: $limit) {
      users { ...PublicProfileFields }
      hashtags { tag postCount }
      posts { ...PostFields }
    }
  }`,
  ...PUBLIC_PROFILE_FRAGMENTS,
  ...POST_FRAGMENTS,
);

/** Lo que sale mientras se escribe en el buscador: sin publicaciones, que pesan. */
const QUICK_SEARCH = gql(
  `query QuickSearch($term: String!, $limit: Int) {
    search(term: $term, limit: $limit) {
      users { ...PublicProfileFields }
      hashtags { tag postCount }
    }
  }`,
  ...PUBLIC_PROFILE_FRAGMENTS,
);

const TRENDING_HASHTAGS = `
query TrendingHashtags($limit: Int) { trendingHashtags(limit: $limit) { tag postCount } }`;

const SUGGESTED_USERS = gql(
  `query SuggestedUsers($limit: Int) {
    suggestedUsers(limit: $limit) {
      mutualCount
      user { ...UserSummaryFields }
      mutuals { ...UserSummaryFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
);

const ONLINE_CONTACTS = gql(
  `query OnlineContacts { onlineContacts { online lastSeenAt user { ...UserSummaryFields } } }`,
  ...USER_SUMMARY_FRAGMENTS,
);

const BLOCKED_USERS = gql(
  `query BlockedUsers { blockedUsers { blockedAt user { ...UserSummaryFields } } }`,
  ...USER_SUMMARY_FRAGMENTS,
);

const BLOCK_USER = `mutation BlockUser($id: ID!) { blockUser(id: $id) }`;
const UNBLOCK_USER = `mutation UnblockUser($id: ID!) { unblockUser(id: $id) }`;

const REPORT_CONTENT = `
mutation ReportContent($input: ReportContentInput!) { reportContent(input: $input) }`;

const PRESENCE_CHANGED = `
subscription PresenceChanged($userIds: [ID!]!) {
  presenceChanged(userIds: $userIds) { userId online lastSeenAt }
}`;

/**
 * Lo que rodea a las publicaciones: buscar, descubrir gente, bloquear y
 * denunciar, y saber quién está conectado.
 */
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly gql = inject(GraphqlClientService);
  private readonly realtime = inject(RealtimeService);

  search(term: string, limit = 10): Promise<SearchResults> {
    return this.gql.field(SEARCH, { term, limit });
  }

  quickSearch(term: string, limit = 8): Promise<Pick<SearchResults, 'users' | 'hashtags'>> {
    return this.gql.field(QUICK_SEARCH, { term, limit });
  }

  trendingHashtags(limit = 10): Promise<Hashtag[]> {
    return this.gql.field(TRENDING_HASHTAGS, { limit });
  }

  suggestedUsers(limit = 10): Promise<UserSuggestion[]> {
    return this.gql.field(SUGGESTED_USERS, { limit });
  }

  onlineContacts(): Promise<OnlineContact[]> {
    return this.gql.field(ONLINE_CONTACTS);
  }

  blockedUsers(): Promise<BlockedUser[]> {
    return this.gql.field(BLOCKED_USERS);
  }

  async block(userId: string): Promise<void> {
    await this.gql.request(BLOCK_USER, { id: userId });
  }

  async unblock(userId: string): Promise<void> {
    await this.gql.request(UNBLOCK_USER, { id: userId });
  }

  async report(targetType: ReportTarget, targetId: string, reason: string): Promise<void> {
    await this.gql.request(REPORT_CONTENT, { input: { targetType, targetId, reason } });
  }

  /** Quién se conecta y se desconecta de entre estas personas. */
  presence(userIds: string[]): Observable<{ presenceChanged: PresencePayload }> {
    return this.realtime.subscribe(PRESENCE_CHANGED, { userIds });
  }
}
