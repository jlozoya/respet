import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { Notification, NotificationEvent, NotificationPage } from '@social-network/shared';

import { NotificationEventType, NotificationType } from '../enums.js';
import { MediaType } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('Notification', {
  description: 'Un aviso: reacciones, comentarios, seguidores, directos…',
})
export class NotificationObject implements Notification {
  @Field(() => ID)
  id!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field(() => [UserSummaryType], { description: 'Los últimos en provocarlo.' })
  actors!: UserSummaryType[];

  @Field(() => Int, { description: 'Cuántas personas en total.' })
  actorCount!: number;

  @Field(() => ID, { nullable: true })
  postId!: string | null;

  @Field(() => ID, { nullable: true })
  commentId!: string | null;

  @Field(() => ID, { nullable: true })
  storyId!: string | null;

  @Field(() => ID, { nullable: true })
  liveStreamId!: string | null;

  @Field(() => MediaType, { nullable: true })
  thumbnail!: MediaType | null;

  @Field(() => String, { nullable: true })
  preview!: string | null;

  @Field()
  read!: boolean;

  @Field()
  createdAt!: string;

  @Field({ description: 'Última actividad.' })
  updatedAt!: string;
}

@ObjectType('NotificationPage')
export class NotificationPageType implements NotificationPage {
  @Field(() => [NotificationObject])
  data!: NotificationObject[];

  @Field(() => String, { nullable: true })
  nextCursor!: string | null;

  @Field(() => Int)
  unreadCount!: number;
}

@ObjectType('NotificationEvent')
export class NotificationEventObject implements NotificationEvent {
  @Field(() => NotificationEventType)
  type!: NotificationEventType;

  @Field(() => NotificationObject, { nullable: true })
  notification!: NotificationObject | null;

  @Field(() => Int)
  unreadCount!: number;
}
