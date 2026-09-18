import { Args, Field, ID, InputType, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { LiveComment, LiveConnection, LiveEvent, LiveStream } from '@social-network/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { trim } from '../common/dto/transforms.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { Audience } from '../graphql/enums.js';
import {
  LiveCommentConnection,
  LiveCommentType,
  LiveConnectionType,
  LiveEventObject,
  LiveStreamType,
} from '../graphql/types/story.types.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { Topic } from '../realtime/topics.js';
import { RelationshipService } from '../social/relationship.service.js';
import { LiveService } from './live.service.js';

const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,16}$/u;

@InputType('StartLiveInput')
export class StartLiveDto {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  title?: string;

  @Field(() => Audience, { nullable: true, defaultValue: 'public' })
  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;
}

@Resolver(() => LiveStreamType)
export class LiveResolver {
  constructor(
    private readonly live: LiveService,
    private readonly relationships: RelationshipService,
    private readonly bus: EventBusService,
  ) {}

  @Public()
  @Query(() => Boolean, { name: 'liveStreamingEnabled', description: 'Si el servidor tiene configurados los directos.' })
  liveStreamingEnabled(): boolean {
    return this.live.enabled;
  }

  @Public()
  @Scopes('live_videos')
  @Query(() => [LiveStreamType], { name: 'liveStreams', description: 'Directos en curso.' })
  async liveStreams(@OptionalUser() viewer: AuthenticatedUser | null): Promise<LiveStream[]> {
    return this.live.active(viewer?.id ?? null);
  }

  @Public()
  @Scopes('live_videos')
  @Query(() => LiveStreamType, { name: 'liveStream' })
  async liveStream(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<LiveStream> {
    return this.live.findOne(id, viewer?.id ?? null);
  }

  @Public()
  @Query(() => LiveCommentConnection, { name: 'liveComments' })
  async liveComments(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('before', { type: () => ID, nullable: true }) before?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit = 50,
  ): Promise<{ data: LiveComment[]; nextCursor: string | null }> {
    return this.live.listComments(id, viewer?.id ?? null, before ?? null, limit);
  }

  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @Mutation(() => LiveConnectionType, { description: 'Empieza un directo. Devuelve el pase para emitir.' })
  async startLiveStream(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input', { type: () => StartLiveDto, nullable: true }) input: StartLiveDto = {},
  ): Promise<LiveConnection> {
    return this.live.start(actor, input.title ?? '', input.audience ?? Audience.public);
  }

  @Scopes('live_videos')
  @RateLimit({ limit: 60, windowSeconds: 60 })
  @Mutation(() => LiveConnectionType, { description: 'Entra a mirar un directo.' })
  async joinLiveStream(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<LiveConnection> {
    return this.live.join(id, actor);
  }

  @Mutation(() => LiveStreamType, { description: 'Señal de vida de quien emite, cada pocos segundos.' })
  async liveStreamHeartbeat(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<LiveStream> {
    return this.live.heartbeat(id, userId);
  }

  @Mutation(() => LiveStreamType)
  async endLiveStream(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<LiveStream> {
    return this.live.end(id, actor);
  }

  @RateLimit({ limit: 30, windowSeconds: 60 })
  @Mutation(() => LiveCommentType)
  async commentOnLiveStream(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('body') body: string,
    @CurrentUser('id') userId: string,
  ): Promise<LiveComment> {
    const text = body.trim().slice(0, 300);

    if (!text) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The comment is empty');
    }

    return this.live.comment(id, userId, text);
  }

  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Mutation(() => Boolean)
  async reactToLiveStream(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    if (!EMOJI.test(emoji.trim())) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'emoji must be a single emoji');
    }

    return this.live.react(id, userId, emoji.trim());
  }

  /**
   * Comentarios, reacciones, audiencia y final de un directo, en vivo.
   *
   * Los comentarios de personas con las que hay un bloqueo no se entregan.
   */
  @Scopes('live_videos')
  @Subscription(() => LiveEventObject, { name: 'liveStreamEvents', resolve: (event: LiveEvent) => event })
  async liveStreamEvents(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncIterableIterator<LiveEvent>> {
    await this.live.assertCanWatch(id, userId);

    const blocked = await this.relationships.blockedIds(userId);

    return this.bus.subscribe<LiveEvent>(Topic.live(id), (event) => !event.user || !blocked.has(event.user.id));
  }
}
