import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  Analytics,
  Bulletin,
  Comment,
  Post,
  PostVoteResult,
  SupportTicket,
  UsersRegistrationPoint,
} from '@respet/shared';

import { FollowState, PostKind, VoteValue } from '../enums.js';
import { LocationType, MediaType, Paginated } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('Post', { description: 'Una publicación del muro.' })
export class PostType implements Post {
  @Field(() => ID)
  id!: string;

  @Field()
  description!: string;

  @Field(() => PostKind)
  kind!: PostKind;

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

  @Field(() => Int)
  likeCount!: number;

  @Field(() => Int)
  dislikeCount!: number;

  @Field(() => Int)
  commentCount!: number;

  @Field(() => VoteValue, {
    nullable: true,
    description: 'Voto de quien mira. Nulo si no ha votado, que no es votar en contra.',
  })
  myVote!: VoteValue | null;

  @Field(() => FollowState, {
    nullable: true,
    description: 'En qué punto sigue quien mira al autor. Nulo sin sesión y en lo propio.',
  })
  authorFollowState!: FollowState | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('PostVoteResult', { description: 'Recuento de votos después de cambiar el propio.' })
export class PostVoteResultType implements PostVoteResult {
  @Field(() => Int)
  likeCount!: number;

  @Field(() => Int)
  dislikeCount!: number;

  @Field(() => VoteValue, { nullable: true })
  myVote!: VoteValue | null;
}

@ObjectType('Comment')
export class CommentType implements Comment {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  postId!: string;

  @Field()
  body!: string;

  @Field(() => UserSummaryType)
  author!: UserSummaryType;

  @Field({ description: 'Los retirados no se borran: dejarían huecos en el hilo.' })
  deleted!: boolean;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('Bulletin', { description: 'Aviso publicado por la administración.' })
export class BulletinType implements Bulletin {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  date!: string;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('SupportTicket', { description: 'Mensaje del formulario de contacto.' })
export class SupportTicketType implements SupportTicket {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field()
  message!: string;

  @Field()
  lang!: string;

  @Field()
  createdAt!: string;
}

@ObjectType({ description: 'Cuentas por género.' })
export class GenderBreakdown {
  @Field(() => Int)
  male!: number;

  @Field(() => Int)
  female!: number;

  @Field(() => Int, { description: 'Quienes prefieren no decirlo.' })
  unspecified!: number;

  @Field(() => Int, { description: 'Quienes no han contestado.' })
  unknown!: number;
}

@ObjectType({ description: 'Cuentas por tramo de edad.' })
export class AgeBreakdown {
  @Field(() => Int)
  children!: number;

  @Field(() => Int)
  teens!: number;

  @Field(() => Int)
  youngAdults!: number;

  @Field(() => Int)
  adults!: number;

  @Field(() => Int)
  unknown!: number;
}

@ObjectType({ description: 'Cuentas por forma de autenticarse.' })
export class ProviderBreakdown {
  @Field(() => Int)
  password!: number;

  @Field(() => Int)
  google!: number;

  @Field(() => Int)
  facebook!: number;

  @Field(() => Int)
  apple!: number;
}

@ObjectType('Analytics', { description: 'Cifras generales de la plataforma.' })
export class AnalyticsType implements Analytics {
  @Field(() => Int)
  usersTotal!: number;

  @Field(() => Int)
  supportTotal!: number;

  @Field(() => Int)
  postsTotal!: number;

  @Field(() => Int)
  ordersTotal!: number;

  @Field(() => GenderBreakdown)
  gender!: GenderBreakdown;

  @Field(() => AgeBreakdown)
  ages!: AgeBreakdown;

  @Field(() => ProviderBreakdown)
  providers!: ProviderBreakdown;
}

@ObjectType('UsersRegistrationPoint', { description: 'Altas dentro de un intervalo.' })
export class UsersRegistrationPointType implements UsersRegistrationPoint {
  @Field({ description: 'Inicio del intervalo, en formato ISO-8601.' })
  date!: string;

  @Field(() => Int)
  users!: number;
}

export const PostPage = Paginated(PostType, 'Post');
export const CommentPage = Paginated(CommentType, 'Comment');
export const BulletinPage = Paginated(BulletinType, 'Bulletin');
export const SupportTicketPage = Paginated(SupportTicketType, 'SupportTicket');
