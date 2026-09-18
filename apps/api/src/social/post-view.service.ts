import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Comment as CommentDto, Post as PostDto } from '@social-network/shared';

import { toComment, toPost, type CommentDoc, type PostDoc } from '../common/mappers.js';
import { fuzzyPoint } from '../common/utils/geo.js';
import { ObjectId, type Model, type Types } from '../database/mongoose.js';
import {
  Comment,
  CommentLike,
  PostReaction,
  SavedPost,
} from '../database/schemas/content.schema.js';
import type { Audience, ReactionType } from '../database/schemas/enums.js';
import { RelationshipService, type ViewerContext } from './relationship.service.js';

/** Publicación leída con `.lean()` y sus relaciones pobladas. */
export type LeanPost = PostDoc & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  audience: Audience;
  authorPrivate?: boolean;
  sharedPost?: (LeanPost & { authorPrivate?: boolean }) | null;
};

/** Comentarios que se enseñan bajo cada tarjeta del muro. */
const PREVIEW_COMMENTS = 2;

/**
 * Cómo ve una lista de publicaciones quien la pide.
 *
 * Añade a cada una lo que depende de quién mira —su reacción, si la guardó, si
 * sigue al autor, los últimos comentarios— con una consulta por dato para
 * toda la página, y aplica las dos reglas que nunca pueden faltar: la
 * ubicación difuminada no sale exacta, y una publicación compartida que quien
 * mira no puede ver no se despliega.
 */
@Injectable()
export class PostViewService {
  constructor(
    @InjectModel(PostReaction.name) private readonly reactions: Model<PostReaction>,
    @InjectModel(SavedPost.name) private readonly saved: Model<SavedPost>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(CommentLike.name) private readonly commentLikes: Model<CommentLike>,
    private readonly relationships: RelationshipService,
  ) {}

  async present(
    docs: LeanPost[],
    viewerId: string | null,
    context?: ViewerContext,
  ): Promise<PostDto[]> {
    if (docs.length === 0) {
      return [];
    }

    const viewer = context ?? (await this.relationships.viewerContext(viewerId));
    const ids = docs.map((doc) => doc._id);

    const [myReactions, savedIds, followStates, previews] = await Promise.all([
      this.myReactions(viewerId, ids),
      this.savedIds(viewerId, ids),
      this.relationships.followStates(
        viewerId,
        docs.map((doc) => String(doc.userId)),
      ),
      this.commentPreviews(ids, viewerId, viewer),
    ]);

    return docs.map((doc) => {
      const id = String(doc._id);
      const authorId = String(doc.userId);
      const shared = doc.sharedPost;

      const sharedVisible =
        !!shared &&
        this.relationships.canSee(viewer, {
          ownerId: String(shared.userId),
          audience: shared.audience,
          ownerPrivate: shared.authorPrivate === true,
        });

      const post = toPost(
        doc,
        {
          myReaction: myReactions.get(id) ?? null,
          saved: savedIds.has(id),
          authorFollowState:
            viewerId && authorId !== viewerId ? (followStates.get(authorId) ?? null) : null,
          commentPreview: previews.get(id) ?? [],
        },
        { sharedPostVisible: sharedVisible },
      );

      return blurLocation(
        post.sharedPost ? { ...post, sharedPost: blurLocation(post.sharedPost) } : post,
      );
    });
  }

  private async myReactions(
    viewerId: string | null,
    ids: Types.ObjectId[],
  ): Promise<Map<string, ReactionType>> {
    if (!viewerId) {
      return new Map();
    }

    const docs = await this.reactions
      .find({ userId: viewerId, postId: { $in: ids } })
      .select('postId type')
      .lean();

    return new Map(docs.map((doc) => [String(doc.postId), doc.type]));
  }

  private async savedIds(viewerId: string | null, ids: Types.ObjectId[]): Promise<Set<string>> {
    if (!viewerId) {
      return new Set();
    }

    const docs = await this.saved
      .find({ userId: viewerId, postId: { $in: ids } })
      .select('postId')
      .lean();

    return new Set(docs.map((doc) => String(doc.postId)));
  }

  /**
   * Los últimos comentarios de primer nivel de cada publicación.
   *
   * Una sola agregación para toda la página, que ordena y recorta dentro de
   * cada grupo, en lugar de una consulta por tarjeta.
   */
  private async commentPreviews(
    postIds: Types.ObjectId[],
    viewerId: string | null,
    context: ViewerContext,
  ): Promise<Map<string, CommentDto[]>> {
    const blocked = [...context.blockedIds].map((id) => new ObjectId(id));

    const groups = await this.comments.aggregate<{ _id: Types.ObjectId; ids: Types.ObjectId[] }>([
      {
        $match: {
          postId: { $in: postIds },
          parentId: null,
          deletedAt: null,
          ...(blocked.length > 0 ? { userId: { $nin: blocked } } : {}),
        },
      },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$postId', ids: { $push: '$_id' } } },
      { $project: { ids: { $slice: ['$ids', PREVIEW_COMMENTS] } } },
    ]);

    const commentIds = groups.flatMap((group) => group.ids);

    if (commentIds.length === 0) {
      return new Map();
    }

    const [docs, liked] = await Promise.all([
      this.comments
        .find({ _id: { $in: commentIds } })
        .populate({ path: 'author', populate: { path: 'avatar' } })
        .lean(),
      viewerId
        ? this.commentLikes
            .find({ userId: viewerId, commentId: { $in: commentIds } })
            .select('commentId')
            .lean()
        : Promise.resolve([]),
    ]);

    const likedIds = new Set(liked.map((doc) => String(doc.commentId)));
    const map = new Map<string, CommentDto[]>();

    for (const doc of (docs as unknown as (CommentDoc & { _id: Types.ObjectId })[]).sort(
      // Bajo la tarjeta se leen en orden: el más antiguo de los dos, arriba.
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )) {
      const postId = String(doc.postId);
      const list = map.get(postId) ?? [];
      list.push(toComment(doc, likedIds.has(String(doc._id))));
      map.set(postId, list);
    }

    return map;
  }
}

/**
 * Sustituye la ubicación exacta por un punto aproximado cuando el autor lo
 * pidió, de modo que la coordenada real no sale nunca del servidor.
 */
function blurLocation(post: PostDto): PostDto {
  if (post.locationAccuracy <= 0 || post.location?.lat == null || post.location.lng == null) {
    return post;
  }

  const blurred = fuzzyPoint(
    { lat: post.location.lat, lng: post.location.lng },
    post.locationAccuracy,
    post.id,
  );

  return { ...post, location: { ...post.location, lat: blurred.lat, lng: blurred.lng } };
}
