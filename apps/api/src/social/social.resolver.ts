import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type {
  BlockedUser,
  Hashtag,
  OnlineContact,
  PresencePayload,
  PublicProfile,
  SearchResults,
  UserSuggestion,
} from '@respet/shared';
import { Field, ObjectType } from '@nestjs/graphql';

import {
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { HashtagType, SearchResultsType } from '../graphql/types/social.types.js';
import {
  BlockedUserType,
  OnlineContactType,
  PublicProfileType,
  UserSuggestionType,
} from '../graphql/types/user.types.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import type { PresenceChange } from '../realtime/presence.service.js';
import { Topic } from '../realtime/topics.js';
import { ProfileService } from './profile.service.js';
import { SocialService } from './social.service.js';

@ObjectType('PresenceChange', { description: 'Alguien se ha conectado o desconectado.' })
export class PresenceChangeType implements PresencePayload {
  @Field(() => ID)
  userId!: string;

  @Field()
  online!: boolean;

  @Field(() => String, { nullable: true })
  lastSeenAt!: string | null;
}

@Resolver()
export class SocialResolver {
  constructor(
    private readonly social: SocialService,
    private readonly profiles: ProfileService,
    private readonly bus: EventBusService,
  ) {}

  @Public()
  @Query(() => PublicProfileType, {
    name: 'publicProfile',
    description: 'Ficha pública por id. Con sesión dice además si la sigues, si tiene historias…',
  })
  async publicProfile(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PublicProfile> {
    return this.profiles.byId(id, viewer?.id ?? null);
  }

  @Public()
  @Query(() => PublicProfileType, {
    name: 'profileByName',
    description: 'Ficha pública por nombre de usuario, el que va en la dirección del perfil.',
  })
  async profileByName(
    @Args('name') name: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PublicProfile> {
    return this.profiles.byName(name, viewer?.id ?? null);
  }

  @Public()
  @RateLimit({ limit: 120, windowSeconds: 60 })
  @Query(() => SearchResultsType, {
    name: 'search',
    description: 'Busca personas, etiquetas y publicaciones. Con `#` delante, sólo etiquetas.',
  })
  async search(
    @Args('term') term: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 }) limit = 10,
  ): Promise<SearchResults> {
    return this.social.search(term, viewer?.id ?? null, Math.min(Math.max(limit, 1), 30));
  }

  @Public()
  @Query(() => [HashtagType], { name: 'trendingHashtags' })
  async trendingHashtags(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 }) limit = 10,
  ): Promise<Hashtag[]> {
    return this.social.trendingHashtags(Math.min(Math.max(limit, 1), 30));
  }

  @Scopes('user_follows')
  @Query(() => [UserSuggestionType], { name: 'suggestedUsers', description: 'Personas que quizá conozcas.' })
  async suggestedUsers(
    @CurrentUser('id') userId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 }) limit = 10,
  ): Promise<UserSuggestion[]> {
    return this.social.suggestions(userId, Math.min(Math.max(limit, 1), 30));
  }

  @Query(() => [OnlineContactType], {
    name: 'onlineContacts',
    description: 'Las personas que sigues, primero las conectadas.',
  })
  async onlineContacts(@CurrentUser('id') userId: string): Promise<OnlineContact[]> {
    return this.social.onlineContacts(userId);
  }

  @Mutation(() => Boolean, { description: 'Bloquea a alguien y deshace los seguimientos entre ambos.' })
  async blockUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.social.block(userId, id);

    return true;
  }

  @Mutation(() => Boolean)
  async unblockUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.social.unblock(userId, id);

    return true;
  }

  @Query(() => [BlockedUserType], { name: 'blockedUsers' })
  async blockedUsers(@CurrentUser('id') userId: string): Promise<BlockedUser[]> {
    return this.social.blockedUsers(userId);
  }

  /**
   * Conexiones y desconexiones de las personas indicadas.
   *
   * La lista la pone el cliente —sus contactos, los participantes de sus
   * conversaciones— y el servidor sólo deja pasar lo que ya es visible: quien
   * oculta su estado no se anuncia nunca.
   */
  @Subscription(() => PresenceChangeType, {
    name: 'presenceChanged',
    resolve: (change: PresenceChange) => change,
  })
  presenceChanged(
    @Args('userIds', { type: () => [ID] }) userIds: string[],
    @CurrentUser('id') viewerId: string,
  ): AsyncIterableIterator<PresenceChange> {
    const watched = new Set(userIds.slice(0, 500));

    return this.bus.subscribe<PresenceChange>(
      Topic.presence,
      (change) => watched.has(change.userId) && change.userId !== viewerId,
    );
  }
}
