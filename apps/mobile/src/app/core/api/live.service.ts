import { Injectable, inject } from '@angular/core';
import type {
  LiveComment,
  LiveConnection,
  LiveEvent,
  LiveStream,
  StartLiveRequest,
} from '@social-network/shared';
import { map, type Observable } from 'rxjs';

import { RealtimeService } from '../realtime/realtime.service';
import { LIVE_COMMENT_FRAGMENTS, LIVE_STREAM_FRAGMENTS, gql } from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const LIVE_ENABLED = `query LiveStreamingEnabled { liveStreamingEnabled }`;

const LIVE_STREAMS = gql(`query LiveStreams { liveStreams { ...LiveStreamFields } }`, ...LIVE_STREAM_FRAGMENTS);

const LIVE_STREAM = gql(
  `query LiveStreamById($id: ID!) { liveStream(id: $id) { ...LiveStreamFields } }`,
  ...LIVE_STREAM_FRAGMENTS,
);

const LIVE_COMMENTS = gql(
  `query LiveComments($id: ID!, $before: ID, $limit: Int) {
    liveComments(id: $id, before: $before, limit: $limit) {
      data { ...LiveCommentFields }
      nextCursor
    }
  }`,
  ...LIVE_COMMENT_FRAGMENTS,
);

const CONNECTION_FIELDS = `serverUrl token stream { ...LiveStreamFields }`;

const START_LIVE = gql(
  `mutation StartLiveStream($input: StartLiveInput) { startLiveStream(input: $input) { ${CONNECTION_FIELDS} } }`,
  ...LIVE_STREAM_FRAGMENTS,
);

const JOIN_LIVE = gql(
  `mutation JoinLiveStream($id: ID!) { joinLiveStream(id: $id) { ${CONNECTION_FIELDS} } }`,
  ...LIVE_STREAM_FRAGMENTS,
);

const HEARTBEAT = `mutation LiveStreamHeartbeat($id: ID!) { liveStreamHeartbeat(id: $id) { id viewerCount status } }`;

const END_LIVE = gql(
  `mutation EndLiveStream($id: ID!) { endLiveStream(id: $id) { ...LiveStreamFields } }`,
  ...LIVE_STREAM_FRAGMENTS,
);

const COMMENT_ON_LIVE = gql(
  `mutation CommentOnLiveStream($id: ID!, $body: String!) {
    commentOnLiveStream(id: $id, body: $body) { ...LiveCommentFields }
  }`,
  ...LIVE_COMMENT_FRAGMENTS,
);

const REACT_TO_LIVE = `mutation ReactToLiveStream($id: ID!, $emoji: String!) { reactToLiveStream(id: $id, emoji: $emoji) }`;

const LIVE_EVENTS = gql(
  `subscription LiveStreamEvents($id: ID!) {
    liveStreamEvents(id: $id) {
      type
      streamId
      reaction
      viewerCount
      user { ...UserSummaryFields }
      comment { ...LiveCommentFields }
    }
  }`,
  ...LIVE_COMMENT_FRAGMENTS,
);

/**
 * Directos.
 *
 * El vídeo no pasa por nuestra API: va por LiveKit, que es quien sabe mover
 * audio y vídeo en tiempo real. La API sólo reparte los pases —un token con
 * permiso de emitir para quien retransmite y de mirar para el resto— y lleva
 * lo social: comentarios, reacciones y cuántos están mirando.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly gql = inject(GraphqlClientService);
  private readonly realtime = inject(RealtimeService);

  enabled(): Promise<boolean> {
    return this.gql.field(LIVE_ENABLED);
  }

  list(): Promise<LiveStream[]> {
    return this.gql.field(LIVE_STREAMS);
  }

  findById(id: string): Promise<LiveStream> {
    return this.gql.field(LIVE_STREAM, { id });
  }

  comments(id: string, before?: string, limit = 50): Promise<{ data: LiveComment[]; nextCursor: string | null }> {
    return this.gql.field(LIVE_COMMENTS, { id, before, limit });
  }

  start(request: StartLiveRequest): Promise<LiveConnection> {
    return this.gql.field(START_LIVE, { input: request });
  }

  join(id: string): Promise<LiveConnection> {
    return this.gql.field(JOIN_LIVE, { id });
  }

  /** Señal de vida de quien emite: sin ella el servidor da el directo por caído. */
  heartbeat(id: string): Promise<Pick<LiveStream, 'id' | 'viewerCount' | 'status'>> {
    return this.gql.field(HEARTBEAT, { id });
  }

  end(id: string): Promise<LiveStream> {
    return this.gql.field(END_LIVE, { id });
  }

  comment(id: string, body: string): Promise<LiveComment> {
    return this.gql.field(COMMENT_ON_LIVE, { id, body });
  }

  async react(id: string, emoji: string): Promise<void> {
    await this.gql.request(REACT_TO_LIVE, { id, emoji });
  }

  events(id: string): Observable<LiveEvent> {
    return this.realtime
      .subscribe<{ liveStreamEvents: LiveEvent }>(LIVE_EVENTS, { id })
      .pipe(map((data) => data.liveStreamEvents));
  }
}
