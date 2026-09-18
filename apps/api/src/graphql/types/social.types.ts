import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  Comment,
  CommentLikeResult,
  Hashtag,
  Post,
  PostReactor,
  ReactionCount,
  ReactionResult,
  Report,
  SearchResults,
} from '@social-network/shared';

import { Audience, FollowState, PostKind, ReactionType, ReportStatus, ReportTarget } from '../enums.js';
import { LocationType, MediaType, Paginated } from './common.types.js';
import { PublicProfileType, UserSummaryType } from './user.types.js';

@ObjectType('ReactionCount')
export class ReactionCountType implements ReactionCount {
  @Field(() => ReactionType)
  type!: ReactionType;

  @Field(() => Int)
  count!: number;
}

@ObjectType('Comment')
export class CommentType implements Comment {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  postId!: string;

  @Field(() => ID, { nullable: true, description: 'El comentario al que responde.' })
  parentId!: string | null;

  @Field()
  body!: string;

  @Field(() => UserSummaryType)
  author!: UserSummaryType;

  @Field(() => [UserSummaryType])
  mentions!: UserSummaryType[];

  @Field(() => Int)
  likeCount!: number;

  @Field()
  likedByMe!: boolean;

  @Field(() => Int)
  replyCount!: number;

  @Field({ description: 'Los retirados no se borran: dejarían huecos en el hilo.' })
  deleted!: boolean;

  @Field(() => String, { nullable: true })
  editedAt!: string | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('Post', { description: 'Una publicación.' })
export class PostType implements Post {
  @Field(() => ID)
  id!: string;

  @Field()
  description!: string;

  @Field(() => PostKind)
  kind!: PostKind;

  @Field(() => Audience)
  audience!: Audience;

  @Field(() => Int, {
    description: '0 publica la ubicación exacta; más difumina el punto en el mapa.',
  })
  locationAccuracy!: number;

  @Field(() => UserSummaryType)
  author!: UserSummaryType;

  @Field(() => LocationType, { nullable: true })
  location!: LocationType | null;

  @Field(() => [MediaType])
  media!: MediaType[];

  @Field(() => [String])
  hashtags!: string[];

  @Field(() => [UserSummaryType])
  mentions!: UserSummaryType[];

  @Field(() => PostType, { nullable: true, description: 'La publicación que comparte.' })
  sharedPost!: PostType | null;

  @Field({ description: 'Cierto si compartía algo que ya no está disponible.' })
  sharedPostUnavailable!: boolean;

  @Field(() => Int)
  reactionCount!: number;

  @Field(() => [ReactionCountType])
  reactionSummary!: ReactionCountType[];

  @Field(() => ReactionType, { nullable: true, description: 'La reacción de quien mira.' })
  myReaction!: ReactionType | null;

  @Field(() => Int)
  commentCount!: number;

  @Field(() => Int)
  shareCount!: number;

  @Field({ description: 'Cierto si quien mira la ha guardado.' })
  saved!: boolean;

  @Field()
  commentsDisabled!: boolean;

  @Field(() => FollowState, {
    nullable: true,
    description: 'En qué punto sigue quien mira al autor. Nulo sin sesión y en lo propio.',
  })
  authorFollowState!: FollowState | null;

  @Field(() => [CommentType], { description: 'Los últimos comentarios, para enseñarlos bajo la tarjeta.' })
  commentPreview!: CommentType[];

  @Field(() => String, { nullable: true })
  editedAt!: string | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('ReactionResult', { description: 'Reacciones tras cambiar la propia.' })
export class ReactionResultType implements ReactionResult {
  @Field(() => Int)
  reactionCount!: number;

  @Field(() => [ReactionCountType])
  reactionSummary!: ReactionCountType[];

  @Field(() => ReactionType, { nullable: true })
  myReaction!: ReactionType | null;
}

@ObjectType('PostReactor')
export class PostReactorType implements PostReactor {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field(() => ReactionType)
  type!: ReactionType;

  @Field(() => FollowState, { nullable: true })
  followState!: FollowState | null;
}

@ObjectType('CommentLikeResult')
export class CommentLikeResultType implements CommentLikeResult {
  @Field(() => Int)
  likeCount!: number;

  @Field()
  likedByMe!: boolean;
}

@ObjectType('Hashtag')
export class HashtagType implements Hashtag {
  @Field()
  tag!: string;

  @Field(() => Int)
  postCount!: number;
}

@ObjectType('SearchResults')
export class SearchResultsType implements SearchResults {
  @Field(() => [PublicProfileType])
  users!: PublicProfileType[];

  @Field(() => [HashtagType])
  hashtags!: HashtagType[];

  @Field(() => [PostType])
  posts!: PostType[];
}

@ObjectType('Report', { description: 'Una denuncia, vista desde moderación.' })
export class ReportType implements Report {
  @Field(() => ID)
  id!: string;

  @Field(() => ReportTarget)
  targetType!: ReportTarget;

  @Field(() => ID)
  targetId!: string;

  @Field(() => UserSummaryType, { nullable: true })
  targetOwner!: UserSummaryType | null;

  @Field(() => UserSummaryType, { nullable: true })
  reporter!: UserSummaryType | null;

  @Field()
  reason!: string;

  @Field(() => ReportStatus)
  status!: ReportStatus;

  @Field()
  createdAt!: string;

  @Field(() => String, { nullable: true })
  reviewedAt!: string | null;
}

export const PostPage = Paginated(PostType, 'Post');
export const CommentPage = Paginated(CommentType, 'Comment');
export const PostReactorPage = Paginated(PostReactorType, 'PostReactor');
export const ReportPage = Paginated(ReportType, 'Report');
