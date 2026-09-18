import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Comment, CommentLikeResult, Paginated } from '@social-network/shared';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { toComment, type CommentDoc } from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Comment as CommentModel, CommentLike, Post } from '../database/schemas/content.schema.js';
import { NotificationType } from '../database/schemas/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import { RelationshipService } from '../social/relationship.service.js';
import { extractMentions } from '../social/text.js';
import { PostsService } from '../posts/posts.service.js';
import type { CommentListQueryDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

const POPULATE_COMMENT = [
  { path: 'author', populate: { path: 'avatar' } },
  { path: 'mentions', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } },
];

type LeanComment = CommentDoc & { _id: Types.ObjectId; userId: Types.ObjectId };

/**
 * Comentarios, con un nivel de respuestas como en Instagram.
 *
 * Responder a una respuesta cuelga del mismo comentario raíz y menciona a su
 * autor: más niveles se vuelven ilegibles en una pantalla de móvil.
 */
@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(CommentModel.name) private readonly comments: Model<CommentModel>,
    @InjectModel(CommentLike.name) private readonly likes: Model<CommentLike>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    private readonly postsService: PostsService,
    private readonly relationships: RelationshipService,
    private readonly notifications: NotificationsService,
    private readonly bus: EventBusService,
  ) {}

  /**
   * Hilo de una publicación, del más antiguo al más reciente.
   *
   * Al revés que el muro: una conversación se lee en el orden en que ocurrió.
   * Los comentarios de personas con las que hay un bloqueo no aparecen.
   */
  async list(postId: string, query: CommentListQueryDto, viewerId: string | null): Promise<Paginated<Comment>> {
    await this.postsService.findVisibleDoc(postId, viewerId);

    const { skip, take, page, perPage } = toPage(query);
    const blocked = viewerId ? [...(await this.relationships.blockedIds(viewerId))].map((id) => new ObjectId(id)) : [];
    const where = {
      postId,
      parentId: query.parentId ? new ObjectId(query.parentId) : null,
      ...(blocked.length > 0 ? { userId: { $nin: blocked } } : {}),
    };

    const [docs, total] = await Promise.all([
      this.comments.find(where).sort({ createdAt: 1 }).skip(skip).limit(take).populate(POPULATE_COMMENT).lean(),
      this.comments.countDocuments(where),
    ]);

    return paginate(await this.present(docs as unknown as LeanComment[], viewerId), total, page, perPage);
  }

  async create(postId: string, author: AuthenticatedUser, dto: CreateCommentDto): Promise<Comment> {
    const post = await this.postsService.findVisibleDoc(postId, author.id);

    if (post.commentsDisabled && String(post.userId) !== author.id) {
      throw AppException.forbiddenWith(ErrorCode.CommentsDisabled, 'Comments are turned off for this post');
    }

    let parent: (CommentModel & { _id: Types.ObjectId }) | null = null;

    if (dto.parentId) {
      parent = await this.comments.findOne({ _id: dto.parentId, postId, deletedAt: null }).lean();

      if (!parent) {
        throw AppException.notFound('Comment');
      }
    }

    const mentionIds = await this.relationships.resolveUsernames(extractMentions(dto.body), author.id);
    // Una respuesta a una respuesta cuelga del comentario raíz.
    const rootId = parent?.parentId ?? parent?._id ?? null;

    const created = await this.comments.create({
      postId,
      userId: author.id,
      parentId: rootId,
      body: dto.body,
      mentionIds,
    });

    await this.posts.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });

    if (rootId) {
      await this.comments.updateOne({ _id: rootId }, { $inc: { replyCount: 1 } });
    }

    const commentId = String(created._id);
    const preview = dto.body.slice(0, 120);
    const notified = new Set<string>([author.id]);

    if (parent && !notified.has(String(parent.userId))) {
      notified.add(String(parent.userId));
      await this.notifications.notify({
        recipientId: parent.userId,
        actorId: author.id,
        type: NotificationType.Reply,
        postId,
        commentId: String(rootId),
        preview,
      });
    }

    if (!notified.has(String(post.userId))) {
      notified.add(String(post.userId));
      await this.notifications.notify({
        recipientId: post.userId,
        actorId: author.id,
        type: NotificationType.Comment,
        postId,
        commentId,
        preview,
      });
    }

    for (const mentionId of mentionIds) {
      if (!notified.has(String(mentionId))) {
        notified.add(String(mentionId));
        await this.notifications.notify({
          recipientId: mentionId,
          actorId: author.id,
          type: NotificationType.Mention,
          postId,
          commentId,
          preview,
        });
      }
    }

    await this.bus.publish(Topic.domain(DomainEvent.CommentCreated), { commentId, postId, userId: author.id });

    return this.findOrFail(commentId, author.id);
  }

  async update(id: string, dto: UpdateCommentDto, actor: AuthenticatedUser): Promise<Comment> {
    const comment = await this.assertCanEdit(id, actor);

    if (comment.deletedAt !== null) {
      throw AppException.notFound('Comment');
    }

    const mentionIds = await this.relationships.resolveUsernames(extractMentions(dto.body), actor.id);

    await this.comments.updateOne({ _id: id }, { $set: { body: dto.body, mentionIds, editedAt: new Date() } });

    return this.findOrFail(id, actor.id);
  }

  /**
   * Retira un comentario sin borrarlo.
   *
   * Igual que en el chat: quitar el documento dejaría un hueco en una
   * conversación que otras personas están leyendo, y las respuestas que
   * colgaban de él quedarían sin contexto. Se vacía el texto y se marca la
   * fecha. El dueño de la publicación también puede retirar comentarios ajenos
   * en lo suyo.
   */
  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const comment = await this.assertCanEdit(id, actor, true);

    if (comment.deletedAt) {
      return;
    }

    await this.comments.updateOne({ _id: id }, { $set: { body: '', mentionIds: [], deletedAt: new Date() } });
    await this.posts.updateOne({ _id: comment.postId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });

    if (comment.parentId) {
      await this.comments.updateOne({ _id: comment.parentId, replyCount: { $gt: 0 } }, { $inc: { replyCount: -1 } });
    }

    await this.notifications.removeFor({ commentId: id });
  }

  async like(id: string, userId: string): Promise<CommentLikeResult> {
    const comment = await this.findActive(id);

    await this.postsService.findVisibleDoc(String(comment.postId), userId);

    const result = await this.likes.updateOne(
      { commentId: id, userId },
      { $setOnInsert: { commentId: id, userId } },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      await this.comments.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
      await this.notifications.notify({
        recipientId: comment.userId,
        actorId: userId,
        type: NotificationType.CommentLike,
        postId: comment.postId,
        commentId: id,
        preview: comment.body.slice(0, 80),
      });
    }

    return this.likeResult(id, true);
  }

  async unlike(id: string, userId: string): Promise<CommentLikeResult> {
    const comment = await this.findActive(id);
    const deleted = await this.likes.deleteOne({ commentId: id, userId });

    if (deleted.deletedCount > 0) {
      await this.comments.updateOne({ _id: id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
      await this.notifications.retract({
        recipientId: comment.userId,
        actorId: userId,
        type: NotificationType.CommentLike,
        commentId: id,
      });
    }

    return this.likeResult(id, false);
  }

  private async likeResult(id: string, likedByMe: boolean): Promise<CommentLikeResult> {
    const doc = await this.comments.findById(id).select('likeCount').lean();

    return { likeCount: Math.max(0, doc?.likeCount ?? 0), likedByMe };
  }

  private async present(docs: LeanComment[], viewerId: string | null): Promise<Comment[]> {
    const liked = viewerId
      ? new Set(
          (
            await this.likes
              .find({ userId: viewerId, commentId: { $in: docs.map((doc) => doc._id) } })
              .select('commentId')
              .lean()
          ).map((doc) => String(doc.commentId)),
        )
      : new Set<string>();

    return docs.map((doc) => toComment(doc, liked.has(String(doc._id))));
  }

  private async findActive(id: string): Promise<CommentModel & { _id: Types.ObjectId }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Comment');
    }

    const comment = await this.comments.findOne({ _id: id, deletedAt: null }).lean();

    if (!comment) {
      throw AppException.notFound('Comment');
    }

    return comment;
  }

  private async findOrFail(id: string, viewerId: string | null): Promise<Comment> {
    const doc = await this.comments.findById(id).populate(POPULATE_COMMENT).lean();

    if (!doc) {
      throw AppException.notFound('Comment');
    }

    const [comment] = await this.present([doc], viewerId);

    return comment;
  }

  private async assertCanEdit(
    id: string,
    actor: AuthenticatedUser,
    allowPostOwner = false,
  ): Promise<CommentModel & { _id: Types.ObjectId }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Comment');
    }

    const comment = await this.comments.findById(id).lean();

    if (!comment) {
      throw AppException.notFound('Comment');
    }

    if (String(comment.userId) === actor.id || actor.role === 'admin') {
      return comment;
    }

    if (allowPostOwner) {
      const post = await this.posts.findById(comment.postId).select('userId').lean();

      if (post && String(post.userId) === actor.id) {
        return comment;
      }
    }

    throw AppException.forbidden('You can only modify your own comments');
  }
}
