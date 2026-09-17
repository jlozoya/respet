import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { NotificationEvent, NotificationPage } from '@respet/shared';
import { IsIn, IsString, Length } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

import { CurrentUser, RateLimit, Scopes, type AuthenticatedUser } from '../common/decorators/index.js';
import { NotificationEventObject, NotificationPageType } from '../graphql/types/notification.types.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import type { UserChannelMessage } from '../realtime/user-channel.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';

@InputType('RegisterPushDeviceInput')
export class RegisterPushDeviceDto {
  @Field({ description: 'Token de Firebase Cloud Messaging del dispositivo.' })
  @IsString()
  @Length(10, 4096)
  token!: string;

  @Field({ description: '`android`, `ios` o `web`.' })
  @IsIn(['android', 'ios', 'web'])
  platform!: string;
}

@Resolver()
export class NotificationsResolver {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly bus: EventBusService,
  ) {}

  @Scopes('notifications')
  @Query(() => NotificationPageType, {
    name: 'notifications',
    description: 'Avisos, del más reciente al más antiguo, paginados por cursor.',
  })
  async list(
    @CurrentUser('id') userId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit = 20,
  ): Promise<NotificationPage> {
    return this.notifications.list(userId, cursor ?? null, limit);
  }

  @Scopes('notifications')
  @Query(() => Int, { name: 'unreadNotificationCount' })
  async unreadCount(@CurrentUser('id') userId: string): Promise<number> {
    return this.notifications.unreadCount(userId);
  }

  @Mutation(() => Int, { description: 'Marca avisos como leídos. Devuelve los que quedan sin leer.' })
  async markNotificationsRead(
    @CurrentUser('id') userId: string,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ): Promise<number> {
    return this.notifications.markRead(userId, ids.slice(0, 200));
  }

  @Mutation(() => Int, { description: 'Marca todos los avisos como leídos.' })
  async markAllNotificationsRead(@CurrentUser('id') userId: string): Promise<number> {
    return this.notifications.markAllRead(userId);
  }

  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Mutation(() => Boolean, { description: 'Registra este dispositivo para recibir notificaciones push.' })
  async registerPushDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input') input: RegisterPushDeviceDto,
  ): Promise<boolean> {
    await this.push.register(actor.id, input.token, input.platform, actor.sessionId);

    return true;
  }

  @Mutation(() => Boolean)
  async unregisterPushDevice(@Args('token') token: string): Promise<boolean> {
    await this.push.unregister(token);

    return true;
  }

  /** Cada aviso nuevo o cambio del contador, en cuanto ocurre. */
  @Scopes('notifications')
  @Subscription(() => NotificationEventObject, {
    name: 'notificationEvents',
    resolve: (message: UserChannelMessage) => (message.channel === 'notification' ? message.event : null),
  })
  notificationEvents(@CurrentUser('id') userId: string): AsyncIterableIterator<UserChannelMessage> {
    return this.bus.subscribe<UserChannelMessage>(
      Topic.user(userId),
      (message) => message.channel === 'notification',
    );
  }
}

export type { NotificationEvent };
