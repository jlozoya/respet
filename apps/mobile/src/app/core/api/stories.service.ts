import { Injectable, inject, signal } from '@angular/core';
import type {
  CreateStoryRequest,
  Message,
  Paginated,
  Story,
  StoryGroup,
  StoryHighlight,
  StoryViewer,
} from '@respet/shared';

import {
  MEDIA_FRAGMENTS,
  MESSAGE_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  STORY_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const STORY_FEED = gql(
  `query StoryFeed {
    storyFeed {
      hasUnseen
      latestAt
      user { ...UserSummaryFields }
      stories { ...StoryFields }
    }
  }`,
  ...STORY_FRAGMENTS,
);

const USER_STORIES = gql(
  `query UserStories($userId: ID!) { userStories(userId: $userId) { ...StoryFields } }`,
  ...STORY_FRAGMENTS,
);

const STORY = gql(`query StoryById($id: ID!) { story(id: $id) { ...StoryFields } }`, ...STORY_FRAGMENTS);

const STORY_ARCHIVE = gql(
  `query StoryArchive($page: Int, $perPage: Int) {
    storyArchive(page: $page, perPage: $perPage) {
      data { ...StoryFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...STORY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const STORY_VIEWERS = gql(
  `query StoryViewers($id: ID!, $page: Int, $perPage: Int) {
    storyViewers(id: $id, page: $page, perPage: $perPage) {
      data { reaction viewedAt user { ...UserSummaryFields } }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const STORY_HIGHLIGHTS = gql(
  `query StoryHighlights($userId: ID!) {
    storyHighlights(userId: $userId) {
      id
      title
      createdAt
      cover { ...MediaFields }
      stories { ...StoryFields }
    }
  }`,
  ...STORY_FRAGMENTS,
);

const CREATE_STORY = gql(
  `mutation CreateStory($input: CreateStoryInput, $file: Upload) {
    createStory(input: $input, file: $file) { ...StoryFields }
  }`,
  ...STORY_FRAGMENTS,
);

const DELETE_STORY = `mutation DeleteStory($id: ID!) { deleteStory(id: $id) }`;
const MARK_STORY_VIEWED = `mutation MarkStoryViewed($id: ID!) { markStoryViewed(id: $id) }`;

const REACT_TO_STORY = gql(
  `mutation ReactToStory($id: ID!, $emoji: String!) { reactToStory(id: $id, emoji: $emoji) { ...StoryFields } }`,
  ...STORY_FRAGMENTS,
);

const REPLY_TO_STORY = gql(
  `mutation ReplyToStory($id: ID!, $body: String!) { replyToStory(id: $id, body: $body) { ...MessageFields } }`,
  ...MESSAGE_FRAGMENTS,
);

const HIGHLIGHT_FIELDS = `id title createdAt cover { ...MediaFields } stories { ...StoryFields }`;

const CREATE_HIGHLIGHT = gql(
  `mutation CreateStoryHighlight($input: StoryHighlightInput!) {
    createStoryHighlight(input: $input) { ${HIGHLIGHT_FIELDS} }
  }`,
  ...STORY_FRAGMENTS,
  ...MEDIA_FRAGMENTS,
);

const UPDATE_HIGHLIGHT = gql(
  `mutation UpdateStoryHighlight($id: ID!, $input: StoryHighlightInput!) {
    updateStoryHighlight(id: $id, input: $input) { ${HIGHLIGHT_FIELDS} }
  }`,
  ...STORY_FRAGMENTS,
  ...MEDIA_FRAGMENTS,
);

const DELETE_HIGHLIGHT = `mutation DeleteStoryHighlight($id: ID!) { deleteStoryHighlight(id: $id) }`;

export interface HighlightRequest {
  title: string;
  storyIds: string[];
  coverStoryId?: string;
}

/**
 * Historias: lo que se ve durante un día y desaparece.
 *
 * Guarda la barra de historias en una señal porque la leen a la vez el muro,
 * el visor —que marca las vistas— y el creador, que añade la propia al
 * publicar.
 */
@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly gql = inject(GraphqlClientService);

  private readonly feedSignal = signal<StoryGroup[]>([]);
  private readonly loadedSignal = signal(false);

  /** La barra de historias: las propias primero, luego las no vistas. */
  readonly feed = this.feedSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  async loadFeed(): Promise<StoryGroup[]> {
    const groups = await this.gql.field<StoryGroup[]>(STORY_FEED);
    this.feedSignal.set(groups);
    this.loadedSignal.set(true);

    return groups;
  }

  userStories(userId: string): Promise<Story[]> {
    return this.gql.field(USER_STORIES, { userId });
  }

  findById(id: string): Promise<Story> {
    return this.gql.field(STORY, { id });
  }

  archive(page = 1, perPage = 30): Promise<Paginated<Story>> {
    return this.gql.field(STORY_ARCHIVE, { page, perPage });
  }

  viewers(id: string, page = 1, perPage = 50): Promise<Paginated<StoryViewer>> {
    return this.gql.field(STORY_VIEWERS, { id, page, perPage });
  }

  highlights(userId: string): Promise<StoryHighlight[]> {
    return this.gql.field(STORY_HIGHLIGHTS, { userId });
  }

  async create(request: CreateStoryRequest, file: Blob | null): Promise<Story> {
    const story = await this.gql.field<Story>(CREATE_STORY, { input: request, file });
    await this.loadFeed().catch(() => undefined);

    return story;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_STORY, { id });
    this.feedSignal.update((groups) =>
      groups
        .map((group) => ({ ...group, stories: group.stories.filter((story) => story.id !== id) }))
        .filter((group) => group.stories.length > 0),
    );
  }

  /**
   * Apunta la vista y la refleja en la barra sin esperar al servidor: el
   * círculo debe apagarse en cuanto se cierra el visor.
   */
  async markViewed(story: Story): Promise<void> {
    if (story.seen) {
      return;
    }

    this.feedSignal.update((groups) =>
      groups.map((group) => {
        if (group.user.id !== story.author.id) {
          return group;
        }

        const stories = group.stories.map((item) => (item.id === story.id ? { ...item, seen: true } : item));

        return { ...group, stories, hasUnseen: stories.some((item) => !item.seen) };
      }),
    );

    await this.gql.request(MARK_STORY_VIEWED, { id: story.id }).catch(() => undefined);
  }

  react(id: string, emoji: string): Promise<Story> {
    return this.gql.field(REACT_TO_STORY, { id, emoji });
  }

  reply(id: string, body: string): Promise<Message> {
    return this.gql.field(REPLY_TO_STORY, { id, body });
  }

  createHighlight(request: HighlightRequest): Promise<StoryHighlight> {
    return this.gql.field(CREATE_HIGHLIGHT, { input: request });
  }

  updateHighlight(id: string, request: HighlightRequest): Promise<StoryHighlight> {
    return this.gql.field(UPDATE_HIGHLIGHT, { id, input: request });
  }

  async removeHighlight(id: string): Promise<void> {
    await this.gql.request(DELETE_HIGHLIGHT, { id });
  }

  /** Olvida la barra al salir de la cuenta. */
  reset(): void {
    this.feedSignal.set([]);
    this.loadedSignal.set(false);
  }
}
