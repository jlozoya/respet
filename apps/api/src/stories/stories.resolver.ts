import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Message, Paginated, Story, StoryGroup, StoryHighlight, StoryViewer } from '@social-network/shared';

import {
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Scopes,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { MessageType } from '../graphql/types/chat.types.js';
import { Paginated as PaginatedType } from '../graphql/types/common.types.js';
import {
  StoryGroupType,
  StoryHighlightType,
  StoryType,
  StoryViewerPage,
} from '../graphql/types/story.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import { CreateStoryDto, StoryHighlightDto } from './dto/story.dto.js';
import { StoriesService } from './stories.service.js';

const StoryPage = PaginatedType(StoryType, 'Story');

/** Un emoji: uno o pocos caracteres gráficos, sin texto. */
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,16}$/u;

@Resolver(() => StoryType)
export class StoriesResolver {
  constructor(private readonly stories: StoriesService) {}

  @Scopes('user_stories')
  @Query(() => [StoryGroupType], {
    name: 'storyFeed',
    description: 'La barra de historias: las propias primero, luego las de quienes sigues sin ver.',
  })
  async feed(@CurrentUser('id') userId: string): Promise<StoryGroup[]> {
    return this.stories.feed(userId);
  }

  @Public()
  @Scopes('user_stories')
  @Query(() => [StoryType], { name: 'userStories', description: 'Las historias vigentes de una persona.' })
  async userStories(
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) userId: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<Story[]> {
    return this.stories.userStories(userId, viewer?.id ?? null);
  }

  @Public()
  @Query(() => StoryType, { name: 'story' })
  async story(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<Story> {
    return this.stories.findOne(id, viewer?.id ?? null);
  }

  @Query(() => StoryPage, { name: 'storyArchive', description: 'Todas las historias propias, caducadas incluidas.' })
  async archive(
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 30 }) perPage = 30,
  ): Promise<Paginated<Story>> {
    return this.stories.archive(userId, page, Math.min(perPage, 60));
  }

  @Query(() => StoryViewerPage, { name: 'storyViewers', description: 'Quién ha visto una historia propia.' })
  async viewers(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 50 }) perPage = 50,
  ): Promise<Paginated<StoryViewer>> {
    return this.stories.viewers(id, userId, page, Math.min(perPage, 100));
  }

  @Public()
  @Query(() => [StoryHighlightType], { name: 'storyHighlights' })
  async highlights(
    @Args('userId', { type: () => ID }, ParseObjectIdPipe) userId: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<StoryHighlight[]> {
    return this.stories.highlightsOf(userId, viewer?.id ?? null);
  }

  /**
   * Publica una historia: una foto o un vídeo —que viaja en `file`— o un
   * texto sobre un fondo de color.
   */
  @Scopes('publish_stories')
  @RateLimit({ limit: 100, windowSeconds: 86_400 })
  @Mutation(() => StoryType)
  async createStory(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input', { type: () => CreateStoryDto, nullable: true }) input: CreateStoryDto = {},
    @Args({ name: 'file', type: () => GraphQLUpload, nullable: true }) file?: PendingUpload,
  ): Promise<Story> {
    return this.stories.create(actor, input, file ?? null);
  }

  @Scopes('publish_stories')
  @Mutation(() => Boolean)
  async deleteStory(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.stories.remove(id, actor);

    return true;
  }

  @Mutation(() => Boolean, { description: 'Apunta que has visto una historia.' })
  async markStoryViewed(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.stories.markViewed(id, userId);

    return true;
  }

  @RateLimit({ limit: 300, windowSeconds: 3600 })
  @Mutation(() => StoryType, { description: 'Reacciona con un emoji; llega también por privado.' })
  async reactToStory(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ): Promise<Story> {
    if (!EMOJI.test(emoji.trim())) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'emoji must be a single emoji');
    }

    return this.stories.react(id, userId, emoji.trim());
  }

  @RateLimit({ limit: 120, windowSeconds: 3600 })
  @Mutation(() => MessageType, { description: 'Contesta a una historia por privado.' })
  async replyToStory(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('body') body: string,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    const text = body.trim().slice(0, 1000);

    if (!text) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The reply is empty');
    }

    return this.stories.reply(id, userId, text);
  }

  @Mutation(() => StoryHighlightType)
  async createStoryHighlight(
    @CurrentUser('id') userId: string,
    @Args('input') input: StoryHighlightDto,
  ): Promise<StoryHighlight> {
    return this.stories.saveHighlight(userId, input, null);
  }

  @Mutation(() => StoryHighlightType)
  async updateStoryHighlight(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
    @Args('input') input: StoryHighlightDto,
  ): Promise<StoryHighlight> {
    return this.stories.saveHighlight(userId, input, id);
  }

  @Mutation(() => Boolean)
  async deleteStoryHighlight(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boolean> {
    await this.stories.deleteHighlight(userId, id);

    return true;
  }
}
