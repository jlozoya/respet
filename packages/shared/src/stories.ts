import type { Audience, LiveStatus, NotificationType, StoryKind } from './enums.js';
import type { Media, UserSummary } from './models.js';

export interface StoryStyle {
  background: string;
  font: string;
}

export interface Story {
  id: string;
  author: UserSummary;
  kind: StoryKind;
  media: Media | null;
  text: string | null;
  style: StoryStyle;
  durationMs: number;
  audience: Audience;
  /** Cierto si quien mira ya la ha visto. */
  seen: boolean;
  /** La reacción de quien mira, si reaccionó. */
  myReaction: string | null;
  /** Sólo en las propias: cuántos la han visto. */
  viewCount: number | null;
  reactionCount: number | null;
  /** Si quien mira puede contestarla por mensaje. */
  canReply: boolean;
  expiresAt: string;
  createdAt: string;
}

/** Las historias de una persona, como un círculo de la barra de historias. */
export interface StoryGroup {
  user: UserSummary;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}

export interface StoryViewer {
  user: UserSummary;
  reaction: string | null;
  viewedAt: string;
}

export interface StoryHighlight {
  id: string;
  title: string;
  cover: Media | null;
  stories: Story[];
  createdAt: string;
}

export interface CreateStoryRequest {
  /** `text` si no lleva archivo. */
  kind?: StoryKind;
  text?: string;
  background?: string;
  font?: string;
  audience?: Audience;
  /** Duración de un vídeo, en milisegundos, por si el servidor no puede medirla. */
  durationMs?: number;
}

export interface LiveStream {
  id: string;
  host: UserSummary;
  title: string;
  status: LiveStatus;
  audience: Audience;
  viewerCount: number;
  peakViewerCount: number;
  reactionCount: number;
  commentCount: number;
  startedAt: string;
  endedAt: string | null;
}

/** Lo necesario para conectarse a la sala de un directo. */
export interface LiveConnection {
  stream: LiveStream;
  /** Dirección `wss://` del servidor de LiveKit. */
  serverUrl: string;
  /** Token de LiveKit: con permiso de emitir para quien retransmite, sólo de mirar para el resto. */
  token: string;
}

export interface LiveComment {
  id: string;
  streamId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export const LiveEventType = {
  Comment: 'comment',
  Reaction: 'reaction',
  ViewerCount: 'viewer_count',
  Ended: 'ended',
} as const;
export type LiveEventType = (typeof LiveEventType)[keyof typeof LiveEventType];

export interface LiveEvent {
  type: LiveEventType;
  streamId: string;
  comment: LiveComment | null;
  /** El emoji, en las reacciones. */
  reaction: string | null;
  user: UserSummary | null;
  viewerCount: number | null;
}

export interface StartLiveRequest {
  title?: string;
  audience?: Audience;
}

export interface Notification {
  id: string;
  type: NotificationType;
  actors: UserSummary[];
  actorCount: number;
  postId: string | null;
  commentId: string | null;
  storyId: string | null;
  liveStreamId: string | null;
  /** Miniatura de lo que se comenta: la primera foto de la publicación. */
  thumbnail: Media | null;
  preview: string | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPage {
  data: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

export const NotificationEventType = {
  Upserted: 'upserted',
  AllRead: 'all_read',
} as const;
export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export interface NotificationEvent {
  type: NotificationEventType;
  notification: Notification | null;
  unreadCount: number;
}
