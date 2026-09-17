import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  LiveComment,
  LiveConnection,
  LiveEvent,
  LiveStream,
  Story,
  StoryGroup,
  StoryHighlight,
  StoryStyle,
  StoryViewer,
} from '@respet/shared';

import { Audience, LiveEventType, LiveStatus, StoryKind } from '../enums.js';
import { CursorPaginated, MediaType, Paginated } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('StoryStyle')
export class StoryStyleType implements StoryStyle {
  @Field()
  background!: string;

  @Field()
  font!: string;
}

@ObjectType('Story', { description: 'Una foto, un vídeo o un texto que se ve durante un día.' })
export class StoryType implements Story {
  @Field(() => ID)
  id!: string;

  @Field(() => UserSummaryType)
  author!: UserSummaryType;

  @Field(() => StoryKind)
  kind!: StoryKind;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field(() => String, { nullable: true })
  text!: string | null;

  @Field(() => StoryStyleType)
  style!: StoryStyleType;

  @Field(() => Int)
  durationMs!: number;

  @Field(() => Audience)
  audience!: Audience;

  @Field({ description: 'Cierto si quien mira ya la ha visto.' })
  seen!: boolean;

  @Field(() => String, { nullable: true })
  myReaction!: string | null;

  @Field(() => Int, { nullable: true, description: 'Sólo en las propias.' })
  viewCount!: number | null;

  @Field(() => Int, { nullable: true, description: 'Sólo en las propias.' })
  reactionCount!: number | null;

  @Field({ description: 'Si quien mira puede contestarla por mensaje.' })
  canReply!: boolean;

  @Field()
  expiresAt!: string;

  @Field()
  createdAt!: string;
}

@ObjectType('StoryGroup', { description: 'Las historias de una persona: un círculo de la barra.' })
export class StoryGroupType implements StoryGroup {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field(() => [StoryType])
  stories!: StoryType[];

  @Field()
  hasUnseen!: boolean;

  @Field()
  latestAt!: string;
}

@ObjectType('StoryViewer')
export class StoryViewerType implements StoryViewer {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field(() => String, { nullable: true })
  reaction!: string | null;

  @Field()
  viewedAt!: string;
}

@ObjectType('StoryHighlight', { description: 'Una colección de historias fija en el perfil.' })
export class StoryHighlightType implements StoryHighlight {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => MediaType, { nullable: true })
  cover!: MediaType | null;

  @Field(() => [StoryType])
  stories!: StoryType[];

  @Field()
  createdAt!: string;
}

@ObjectType('LiveStream', { description: 'Una emisión en directo.' })
export class LiveStreamType implements LiveStream {
  @Field(() => ID)
  id!: string;

  @Field(() => UserSummaryType)
  host!: UserSummaryType;

  @Field()
  title!: string;

  @Field(() => LiveStatus)
  status!: LiveStatus;

  @Field(() => Audience)
  audience!: Audience;

  @Field(() => Int)
  viewerCount!: number;

  @Field(() => Int)
  peakViewerCount!: number;

  @Field(() => Int)
  reactionCount!: number;

  @Field(() => Int)
  commentCount!: number;

  @Field()
  startedAt!: string;

  @Field(() => String, { nullable: true })
  endedAt!: string | null;
}

@ObjectType('LiveConnection', { description: 'Lo necesario para conectarse a la sala de LiveKit.' })
export class LiveConnectionType implements LiveConnection {
  @Field(() => LiveStreamType)
  stream!: LiveStreamType;

  @Field({ description: 'Dirección `wss://` del servidor de LiveKit.' })
  serverUrl!: string;

  @Field({ description: 'Token de LiveKit para esta sala.' })
  token!: string;
}

@ObjectType('LiveComment')
export class LiveCommentType implements LiveComment {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  streamId!: string;

  @Field(() => UserSummaryType)
  author!: UserSummaryType;

  @Field()
  body!: string;

  @Field()
  createdAt!: string;
}

@ObjectType('LiveEvent')
export class LiveEventObject implements LiveEvent {
  @Field(() => LiveEventType)
  type!: LiveEventType;

  @Field(() => ID)
  streamId!: string;

  @Field(() => LiveCommentType, { nullable: true })
  comment!: LiveCommentType | null;

  @Field(() => String, { nullable: true })
  reaction!: string | null;

  @Field(() => UserSummaryType, { nullable: true })
  user!: UserSummaryType | null;

  @Field(() => Int, { nullable: true })
  viewerCount!: number | null;
}

export const StoryViewerPage = Paginated(StoryViewerType, 'StoryViewer');
export const LiveCommentConnection = CursorPaginated(LiveCommentType, 'LiveComment');
