import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type {
  Message,
  Paginated,
  Story as StoryDto,
  StoryGroup,
  StoryHighlight as StoryHighlightDto,
  StoryViewer,
} from '@social-network/shared';

import { ChatService } from '../chat/chat.service.js';
import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import {
  toIso,
  toMediaOrNull,
  toUserSummary,
  type MediaDoc,
  type UserSummaryDoc,
} from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Audience, MediaType, NotificationType, StoryKind } from '../database/schemas/enums.js';
import { Story, StoryHighlight, StoryView } from '../database/schemas/story.schema.js';
import { UserPermissions } from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';
import type { PendingUpload } from '../media/upload.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import { RelationshipService, type ViewerContext } from '../social/relationship.service.js';
import type { CreateStoryDto, StoryHighlightDto as HighlightInput } from './dto/story.dto.js';

/** Lo que dura en pantalla una foto o un texto. */
const STILL_DURATION_MS = 5000;
/** Lo máximo que dura un vídeo de historia. */
const MAX_VIDEO_MS = 60_000;

const POPULATE_STORY = [
  {
    path: 'author',
    select: 'name firstName lastName avatarId verified',
    populate: { path: 'avatar' },
  },
  { path: 'media' },
];

type LeanStory = Story & {
  _id: Types.ObjectId;
  author?: UserSummaryDoc & { _id: Types.ObjectId };
  media?: (MediaDoc & { _id: Types.ObjectId }) | null;
};

/**
 * Historias: lo que se ve durante un día en la barra de arriba.
 *
 * Una historia caducada no se borra: sale de la barra pero queda en el archivo
 * de su autor y puede formar parte de una historia destacada, como en
 * Instagram.
 */
@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name) private readonly stories: Model<Story>,
    @InjectModel(StoryView.name) private readonly views: Model<StoryView>,
    @InjectModel(StoryHighlight.name) private readonly highlights: Model<StoryHighlight>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    private readonly media: MediaService,
    private readonly relationships: RelationshipService,
    private readonly notifications: NotificationsService,
    private readonly chat: ChatService,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  async create(
    author: AuthenticatedUser,
    dto: CreateStoryDto,
    file: PendingUpload | null,
  ): Promise<StoryDto> {
    let mediaId: Types.ObjectId | null = null;
    let kind: StoryKind = StoryKind.Text;
    let durationMs: number;

    if (file) {
      const stored = await this.media.storeUpload(file, {
        accept: ['image', 'video'],
        preset: 'story',
        uploaderId: author.id,
        durationHintMs: dto.durationMs,
        maxDurationMs: MAX_VIDEO_MS,
      });

      mediaId = stored._id;
      kind = stored.type === MediaType.Video ? StoryKind.Video : StoryKind.Image;
      durationMs =
        kind === StoryKind.Video
          ? Math.min(stored.durationMs ?? dto.durationMs ?? 15_000, MAX_VIDEO_MS)
          : STILL_DURATION_MS;
    } else if (!dto.text) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'A story needs a photo, a video or some text',
      );
    } else {
      // Un texto largo necesita más tiempo para leerse.
      durationMs = Math.min(10_000, Math.max(STILL_DURATION_MS, dto.text.length * 60));
    }

    const ttlHours = this.config.getOrThrow<number>('stories.ttlHours');

    const created = await this.stories.create({
      authorId: author.id,
      kind,
      mediaId,
      text: dto.text ?? null,
      style: { background: dto.background ?? 'sunset', font: dto.font ?? 'classic' },
      durationMs,
      audience:
        dto.audience === Audience.OnlyMe
          ? Audience.Followers
          : (dto.audience ?? Audience.Followers),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    });

    await this.bus.publish(Topic.domain(DomainEvent.StoryCreated), {
      storyId: String(created._id),
      userId: author.id,
    });

    return this.findOne(String(created._id), author.id);
  }

  /**
   * La barra de historias.
   *
   * Las propias primero; después las de quienes sigues, con las que tienen algo
   * sin ver delante y, dentro de cada grupo, de la más reciente a la más
   * antigua.
   */
  async feed(viewerId: string): Promise<StoryGroup[]> {
    const context = await this.relationships.viewerContext(viewerId);
    const authors = [...context.followingIds, viewerId].map((id) => new ObjectId(id));

    const docs = (await this.stories
      .find({ authorId: { $in: authors }, expiresAt: { $gt: new Date() }, deletedAt: null })
      .sort({ createdAt: 1 })
      .populate(POPULATE_STORY)
      .lean()) as unknown as LeanStory[];

    const visible = await this.filterVisible(docs, context);
    const stories = await this.present(visible, viewerId);
    const groups = new Map<string, StoryDto[]>();

    for (const story of stories) {
      const list = groups.get(story.author.id) ?? [];
      list.push(story);
      groups.set(story.author.id, list);
    }

    return [...groups.values()]
      .map((list) => ({
        user: list[0].author,
        stories: list,
        hasUnseen: list.some((story) => !story.seen),
        latestAt: (list.at(-1) as StoryDto).createdAt,
      }))
      .sort(
        (a, b) =>
          Number(b.user.id === viewerId) - Number(a.user.id === viewerId) ||
          Number(b.hasUnseen) - Number(a.hasUnseen) ||
          b.latestAt.localeCompare(a.latestAt),
      );
  }

  /** Las historias vigentes de una persona, al pulsar su foto en el perfil. */
  async userStories(userId: string, viewerId: string | null): Promise<StoryDto[]> {
    if (!(await this.relationships.canViewContentOf(viewerId, userId))) {
      return [];
    }

    const context = await this.relationships.viewerContext(viewerId);
    const docs = (await this.stories
      .find({ authorId: userId, expiresAt: { $gt: new Date() }, deletedAt: null })
      .sort({ createdAt: 1 })
      .populate(POPULATE_STORY)
      .lean()) as unknown as LeanStory[];

    return this.present(await this.filterVisible(docs, context), viewerId);
  }

  /** Todas las historias propias, caducadas incluidas: el archivo. */
  async archive(userId: string, page: number, perPage: number): Promise<Paginated<StoryDto>> {
    const pagination = toPage({ page, perPage });
    const filter = { authorId: userId, deletedAt: null };

    const [docs, total] = await Promise.all([
      this.stories
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.take)
        .populate(POPULATE_STORY)
        .lean(),
      this.stories.countDocuments(filter),
    ]);

    return paginate(
      await this.present(docs as unknown as LeanStory[], userId),
      total,
      pagination.page,
      pagination.perPage,
    );
  }

  async findOne(storyId: string, viewerId: string | null): Promise<StoryDto> {
    const doc = await this.findVisible(storyId, viewerId);
    const [story] = await this.present([doc], viewerId);

    return story;
  }

  /** Apunta que alguien la ha visto. Idempotente; lo propio no cuenta. */
  async markViewed(storyId: string, viewerId: string): Promise<void> {
    const story = await this.findVisible(storyId, viewerId);

    if (String(story.authorId) === viewerId) {
      return;
    }

    const result = await this.views.updateOne(
      { storyId, viewerId },
      { $setOnInsert: { storyId, viewerId, authorId: story.authorId } },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      await this.stories.updateOne({ _id: storyId }, { $inc: { viewCount: 1 } });
    }
  }

  /**
   * Reacciona con un emoji.
   *
   * Como en Instagram, la reacción llega además por privado: es la forma de
   * que empiece una conversación.
   */
  async react(storyId: string, viewerId: string, emoji: string): Promise<StoryDto> {
    const story = await this.findVisible(storyId, viewerId);
    const authorId = String(story.authorId);

    if (authorId === viewerId) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'You cannot react to your own story',
      );
    }

    const previous = await this.views
      .findOneAndUpdate(
        { storyId, viewerId },
        {
          $set: { reaction: emoji },
          $setOnInsert: { storyId, viewerId, authorId: story.authorId },
        },
        { upsert: true, returnDocument: 'before' },
      )
      .lean();

    if (!previous) {
      await this.stories.updateOne({ _id: storyId }, { $inc: { viewCount: 1, reactionCount: 1 } });
    } else if (!previous.reaction) {
      await this.stories.updateOne({ _id: storyId }, { $inc: { reactionCount: 1 } });
    }

    await this.notifications.notify({
      recipientId: authorId,
      actorId: viewerId,
      type: NotificationType.StoryReaction,
      storyId,
      preview: emoji,
    });

    if (await this.relationships.canMessage(viewerId, authorId, 'storyReplyPolicy')) {
      await this.chat.sendStoryReply(viewerId, authorId, story._id, emoji).catch(() => undefined);
    }

    return this.findOne(storyId, viewerId);
  }

  /** Contesta a una historia por privado. */
  async reply(storyId: string, viewerId: string, body: string): Promise<Message> {
    const story = await this.findVisible(storyId, viewerId);
    const authorId = String(story.authorId);

    if (authorId === viewerId) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        'You cannot reply to your own story',
      );
    }

    if (!(await this.relationships.canMessage(viewerId, authorId, 'storyReplyPolicy'))) {
      throw AppException.forbidden('This person does not accept replies to their stories');
    }

    return this.chat.sendStoryReply(viewerId, authorId, story._id, body);
  }

  /** Quién la ha visto. Sólo para quien la publicó. */
  async viewers(
    storyId: string,
    ownerId: string,
    page: number,
    perPage: number,
  ): Promise<Paginated<StoryViewer>> {
    await this.assertOwner(storyId, ownerId);

    const pagination = toPage({ page, perPage });
    const [docs, total] = await Promise.all([
      this.views
        .find({ storyId })
        // Primero quienes reaccionaron, como hace Instagram.
        .sort({ reaction: -1, updatedAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.take)
        .populate({
          path: 'viewer',
          select: 'name firstName lastName avatarId verified',
          populate: { path: 'avatar' },
        })
        .lean(),
      this.views.countDocuments({ storyId }),
    ]);

    return paginate(
      docs
        .filter((doc) => (doc as { viewer?: unknown }).viewer)
        .map((doc) => ({
          user: toUserSummary((doc as unknown as { viewer: never }).viewer),
          reaction: doc.reaction,
          viewedAt: toIso(doc.createdAt),
        })),
      total,
      pagination.page,
      pagination.perPage,
    );
  }

  async remove(storyId: string, actor: AuthenticatedUser): Promise<void> {
    const story = await this.assertOwner(storyId, actor.id, actor.role === 'admin');

    await Promise.all([
      this.stories.deleteOne({ _id: storyId }),
      this.views.deleteMany({ storyId }),
      this.highlights.updateMany({ storyIds: story._id }, { $pull: { storyIds: story._id } }),
      this.notifications.removeFor({ storyId }),
    ]);

    if (story.mediaId) {
      await this.media.remove(story.mediaId);
    }
  }

  // --- Destacadas ---------------------------------------------------------------

  async highlightsOf(userId: string, viewerId: string | null): Promise<StoryHighlightDto[]> {
    if (!(await this.relationships.canViewContentOf(viewerId, userId))) {
      return [];
    }

    const docs = await this.highlights.find({ userId }).sort({ createdAt: -1 }).lean();
    const storyIds = [...new Set(docs.flatMap((doc) => doc.storyIds.map(String)))];
    const stories = (await this.stories
      .find({ _id: { $in: storyIds }, deletedAt: null })
      .populate(POPULATE_STORY)
      .lean()) as unknown as LeanStory[];
    const presented = new Map(
      (await this.present(stories, viewerId)).map((story) => [story.id, story]),
    );

    return docs.map((doc) => {
      const list = doc.storyIds
        .map((id) => presented.get(String(id)))
        .filter((story): story is StoryDto => !!story);
      const cover = (doc.coverStoryId && presented.get(String(doc.coverStoryId))) || list[0];

      return {
        id: String(doc._id),
        title: doc.title,
        cover: cover?.media ?? null,
        stories: list,
        createdAt: toIso(doc.createdAt),
      };
    });
  }

  async saveHighlight(
    userId: string,
    input: HighlightInput,
    highlightId: string | null,
  ): Promise<StoryHighlightDto> {
    const owned = await this.stories
      .find({ _id: { $in: input.storyIds }, authorId: userId, deletedAt: null })
      .select('_id')
      .lean();

    if (owned.length !== new Set(input.storyIds).size) {
      throw AppException.forbidden('You can only highlight your own stories');
    }

    const fields = {
      title: input.title,
      storyIds: input.storyIds.map((id) => new ObjectId(id)),
      coverStoryId:
        input.coverStoryId && input.storyIds.includes(input.coverStoryId)
          ? input.coverStoryId
          : null,
    };

    let id = highlightId;

    if (highlightId) {
      const updated = await this.highlights.updateOne(
        { _id: highlightId, userId },
        { $set: fields },
      );

      if (updated.matchedCount === 0) {
        throw AppException.notFound('Highlight');
      }
    } else {
      id = String((await this.highlights.create({ userId, ...fields }))._id);
    }

    const all = await this.highlightsOf(userId, userId);
    const saved = all.find((highlight) => highlight.id === id);

    if (!saved) {
      throw AppException.notFound('Highlight');
    }

    return saved;
  }

  async deleteHighlight(userId: string, highlightId: string): Promise<void> {
    const deleted = await this.highlights.deleteOne({ _id: highlightId, userId });

    if (deleted.deletedCount === 0) {
      throw AppException.notFound('Highlight');
    }
  }

  // --- Interno ----------------------------------------------------------------

  private async findVisible(storyId: string, viewerId: string | null): Promise<LeanStory> {
    if (!isValidObjectId(storyId)) {
      throw AppException.notFound('Story');
    }

    const doc = (await this.stories
      .findOne({ _id: storyId, deletedAt: null })
      .populate(POPULATE_STORY)
      .lean()) as unknown as LeanStory | null;

    if (!doc) {
      throw AppException.notFound('Story');
    }

    const isOwner = viewerId === String(doc.authorId);

    // Una historia caducada sólo la sigue viendo su autor, o quien la vea
    // dentro de una destacada.
    if (!isOwner && doc.expiresAt <= new Date()) {
      const highlighted = await this.highlights.exists({ storyIds: doc._id });

      if (!highlighted) {
        throw AppException.forbiddenWith(
          ErrorCode.StoryExpired,
          'This story is no longer available',
        );
      }
    }

    const context = await this.relationships.viewerContext(viewerId);
    const [visible] = await this.filterVisible([doc], context);

    if (!visible) {
      throw AppException.notFound('Story');
    }

    return doc;
  }

  private async filterVisible(docs: LeanStory[], context: ViewerContext): Promise<LeanStory[]> {
    const authorIds = [...new Set(docs.map((doc) => String(doc.authorId)))];
    const privateAuthors = new Set(
      (
        await this.permissions
          .find({ userId: { $in: authorIds }, privateProfile: true })
          .select('userId')
          .lean()
      ).map((doc) => String(doc.userId)),
    );

    return docs.filter((doc) =>
      this.relationships.canSee(context, {
        ownerId: String(doc.authorId),
        audience: doc.audience,
        ownerPrivate: privateAuthors.has(String(doc.authorId)),
      }),
    );
  }

  private async present(docs: LeanStory[], viewerId: string | null): Promise<StoryDto[]> {
    if (docs.length === 0) {
      return [];
    }

    const ids = docs.map((doc) => doc._id);
    const [myViews, replyPolicies] = await Promise.all([
      viewerId
        ? this.views
            .find({ viewerId, storyId: { $in: ids } })
            .select('storyId reaction')
            .lean()
        : Promise.resolve([]),
      this.replyableAuthors(docs, viewerId),
    ]);
    const viewed = new Map(myViews.map((view) => [String(view.storyId), view.reaction]));

    return docs.map((doc) => {
      const authorId = String(doc.authorId);
      const own = authorId === viewerId;

      return {
        id: String(doc._id),
        author: toUserSummary(doc.author),
        kind: doc.kind,
        media: toMediaOrNull(doc.media),
        text: doc.text,
        style: {
          background: doc.style?.background ?? 'sunset',
          font: doc.style?.font ?? 'classic',
        },
        durationMs: doc.durationMs,
        audience: doc.audience,
        seen: own || viewed.has(String(doc._id)),
        myReaction: viewed.get(String(doc._id)) ?? null,
        viewCount: own ? doc.viewCount : null,
        reactionCount: own ? doc.reactionCount : null,
        canReply: !own && replyPolicies.has(authorId),
        expiresAt: toIso(doc.expiresAt),
        createdAt: toIso(doc.createdAt),
      };
    });
  }

  /** A qué autores de la lista puede contestar quien mira. */
  private async replyableAuthors(docs: LeanStory[], viewerId: string | null): Promise<Set<string>> {
    const allowed = new Set<string>();

    if (!viewerId) {
      return allowed;
    }

    for (const authorId of new Set(docs.map((doc) => String(doc.authorId)))) {
      if (
        authorId !== viewerId &&
        (await this.relationships.canMessage(viewerId, authorId, 'storyReplyPolicy'))
      ) {
        allowed.add(authorId);
      }
    }

    return allowed;
  }

  private async assertOwner(
    storyId: string,
    userId: string,
    allowAdmin = false,
  ): Promise<Story & { _id: Types.ObjectId }> {
    if (!isValidObjectId(storyId)) {
      throw AppException.notFound('Story');
    }

    const story = await this.stories.findById(storyId).lean();

    if (!story || (String(story.authorId) !== userId && !allowAdmin)) {
      throw AppException.notFound('Story');
    }

    return story;
  }
}
