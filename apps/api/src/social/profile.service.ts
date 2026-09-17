import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { PublicProfile } from '@respet/shared';

import { AppException } from '../common/errors.js';
import { toPublicProfile, type MediaDoc } from '../common/mappers.js';
import { isValidObjectId, type Model, type Types } from '../database/mongoose.js';
import { Follow, Post } from '../database/schemas/content.schema.js';
import { FollowState, MessagePolicy } from '../database/schemas/enums.js';
import { Story, StoryView } from '../database/schemas/story.schema.js';
import { User, UserPermissions } from '../database/schemas/user.schema.js';
import { PresenceService } from '../realtime/presence.service.js';
import { RelationshipService } from './relationship.service.js';

/** Los campos de una cuenta que hacen falta para su ficha pública. */
export const PROFILE_FIELDS = 'name firstName lastName avatarId coverId bio website verified lastSeenAt createdAt';

interface ProfileDoc {
  _id: Types.ObjectId;
  name: string;
  firstName: string;
  lastName: string;
  verified?: boolean;
  bio?: string | null;
  website?: string | null;
  lastSeenAt?: Date | null;
  avatar?: (MediaDoc & { _id: Types.ObjectId }) | null;
  cover?: (MediaDoc & { _id: Types.ObjectId }) | null;
  createdAt: Date;
}

/**
 * Las fichas públicas, compuestas en bloque.
 *
 * Una ficha junta mucho: cifras de seguidores, si es privada, si quien mira la
 * sigue o la ha bloqueado, si tiene historias sin ver, si está en línea. Pedir
 * todo eso persona a persona en un buscador de veinte resultados eran más de
 * cien consultas; aquí son una por dato, para toda la lista.
 */
@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Story.name) private readonly stories: Model<Story>,
    @InjectModel(StoryView.name) private readonly storyViews: Model<StoryView>,
    private readonly relationships: RelationshipService,
    private readonly presence: PresenceService,
  ) {}

  async byId(id: string, viewerId: string | null): Promise<PublicProfile> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('User');
    }

    const doc = await this.users.findById(id).select(PROFILE_FIELDS).populate(['avatar', 'cover']).lean();

    if (!doc) {
      throw AppException.notFound('User');
    }

    const [profile] = await this.build([doc], viewerId);

    return profile;
  }

  /** Por nombre de usuario, que es lo que va en la dirección del perfil. */
  async byName(name: string, viewerId: string | null): Promise<PublicProfile> {
    const doc = await this.users
      .findOne({ name: name.toLowerCase() })
      .select(PROFILE_FIELDS)
      .populate(['avatar', 'cover'])
      .lean();

    if (!doc) {
      throw AppException.notFound('User');
    }

    const [profile] = await this.build([doc], viewerId);

    return profile;
  }

  async byIds(ids: (string | Types.ObjectId)[], viewerId: string | null): Promise<PublicProfile[]> {
    if (ids.length === 0) {
      return [];
    }

    const docs = await this.users
      .find({ _id: { $in: ids } })
      .select(PROFILE_FIELDS)
      .populate(['avatar', 'cover'])
      .lean();

    const order = new Map(ids.map((id, index) => [String(id), index]));
    const sorted = (docs as unknown as ProfileDoc[]).sort(
      (a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0),
    );

    return this.build(sorted, viewerId);
  }

  private async build(docs: ProfileDoc[], viewerId: string | null): Promise<PublicProfile[]> {
    if (docs.length === 0) {
      return [];
    }

    const ids = docs.map((doc) => doc._id);
    const idStrings = ids.map(String);
    const now = new Date();

    const [
      followerCounts,
      followingCounts,
      postCounts,
      permissions,
      followStates,
      context,
      reverseFollows,
      mutuals,
      activeStories,
      online,
    ] = await Promise.all([
      this.countBy(this.follows, { followeeId: { $in: ids }, pending: { $ne: true } }, '$followeeId'),
      this.countBy(this.follows, { followerId: { $in: ids }, pending: { $ne: true } }, '$followerId'),
      this.countBy(this.posts, { userId: { $in: ids } }, '$userId'),
      this.permissions
        .find({ userId: { $in: ids } })
        .select('userId privateProfile showOnlineStatus messagePolicy')
        .lean(),
      this.relationships.followStates(viewerId, idStrings),
      this.relationships.viewerContext(viewerId),
      // Quiénes de la lista siguen a quien mira: decide si le pueden escribir
      // cuando sólo aceptan mensajes de a quienes siguen.
      viewerId
        ? this.follows
            .find({ followerId: { $in: ids }, followeeId: viewerId, pending: { $ne: true } })
            .select('followerId')
            .lean()
        : Promise.resolve([]),
      this.mutualCounts(viewerId, ids),
      this.stories
        .find({ authorId: { $in: ids }, expiresAt: { $gt: now }, deletedAt: null })
        .select('_id authorId audience')
        .lean(),
      this.presence.visibleOnlineAmong(idStrings),
    ]);

    const prefs = new Map(permissions.map((doc) => [String(doc.userId), doc]));
    const followsViewer = new Set(reverseFollows.map((doc) => String(doc.followerId)));

    const viewerHidesOnline = viewerId
      ? (await this.permissions.findOne({ userId: viewerId }).select('showOnlineStatus').lean())
          ?.showOnlineStatus === false
      : true;

    // Las historias que quien mira podría ver, y cuáles de ellas ya ha visto.
    const visibleStories = activeStories.filter((story) =>
      this.relationships.canSee(context, {
        ownerId: String(story.authorId),
        audience: story.audience,
        ownerPrivate: prefs.get(String(story.authorId))?.privateProfile === true,
      }),
    );

    const seenStoryIds = viewerId
      ? new Set(
          (
            await this.storyViews
              .find({ viewerId, storyId: { $in: visibleStories.map((story) => story._id) } })
              .select('storyId')
              .lean()
          ).map((view) => String(view.storyId)),
        )
      : new Set<string>();

    return docs.map((doc) => {
      const id = String(doc._id);
      const pref = prefs.get(id);
      const isPrivate = pref?.privateProfile === true;
      const followState = followStates.get(id) ?? null;
      const isSelf = viewerId === id;
      const blocked = context.blockedIds.has(id);
      const canViewContent = isSelf || (!blocked && (!isPrivate || followState === FollowState.Following));
      const stories = canViewContent ? visibleStories.filter((story) => String(story.authorId) === id) : [];
      const showsOnline = !isSelf && !blocked && pref?.showOnlineStatus !== false && !viewerHidesOnline;
      const policy = pref?.messagePolicy ?? MessagePolicy.Everyone;

      return toPublicProfile(doc, {
        postCount: postCounts.get(id) ?? 0,
        followerCount: followerCounts.get(id) ?? 0,
        followingCount: followingCounts.get(id) ?? 0,
        followState: isSelf ? null : followState,
        isPrivate,
        canViewContent,
        blockedByViewer: blocked,
        hasActiveStory: stories.length > 0,
        hasUnseenStory: stories.some((story) => !seenStoryIds.has(String(story._id))),
        isOnline: showsOnline ? online.has(id) : null,
        lastSeenAt: showsOnline && doc.lastSeenAt ? doc.lastSeenAt.toISOString() : null,
        canMessage:
          viewerId !== null &&
          !isSelf &&
          !blocked &&
          (policy === MessagePolicy.Everyone || (policy === MessagePolicy.Following && followsViewer.has(id))),
        mutualFollowerCount: mutuals.get(id) ?? 0,
      });
    });
  }

  private async countBy(
    model: Model<Follow> | Model<Post>,
    match: Record<string, unknown>,
    groupBy: string,
  ): Promise<Map<string, number>> {
    const rows = await (model as Model<Follow>).aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: match },
      { $group: { _id: groupBy, total: { $sum: 1 } } },
    ]);

    return new Map(rows.map((row) => [String(row._id), row.total]));
  }

  private async mutualCounts(viewerId: string | null, ids: Types.ObjectId[]): Promise<Map<string, number>> {
    if (!viewerId) {
      return new Map();
    }

    const following = await this.relationships.followingIds(viewerId);

    if (following.length === 0) {
      return new Map();
    }

    return this.countBy(
      this.follows,
      { followeeId: { $in: ids }, followerId: { $in: following }, pending: { $ne: true } },
      '$followeeId',
    );
  }
}
