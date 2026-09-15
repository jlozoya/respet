import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Comment, Paginated } from '@respet/shared';
import { isValidObjectId } from '../database/mongoose.js';
import type { Model } from '../database/mongoose.js';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException } from '../common/errors.js';
import { toComment } from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { Comment as CommentDoc } from '../database/schemas/content.schema.js';
import { Post } from '../database/schemas/content.schema.js';
import type { CommentListQueryDto, CreateCommentDto, UpdateCommentDto } from './dto/comment.dto.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(CommentDoc.name) private readonly comments: Model<CommentDoc>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
  ) {}

  /**
   * Hilo de una publicación, del más antiguo al más reciente.
   *
   * Al revés que el muro: una conversación se lee en el orden en que ocurrió.
   */
  async list(postId: string, query: CommentListQueryDto): Promise<Paginated<Comment>> {
    await this.assertPostExists(postId);

    const { skip, take, page, perPage } = toPage(query);
    const where = { postId };

    const [docs, total] = await Promise.all([
      this.comments
        .find(where)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(take)
        .populate({ path: 'author', populate: { path: 'avatar' } })
        .lean(),
      this.comments.countDocuments(where),
    ]);

    return paginate(docs.map((doc) => toComment(doc as never)), total, page, perPage);
  }

  async create(postId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
    await this.assertPostExists(postId);

    const created = await this.comments.create({ postId, userId, body: dto.body });

    return this.findOrFail(String(created._id));
  }

  async update(id: string, dto: UpdateCommentDto, actor: AuthenticatedUser): Promise<Comment> {
    const comment = await this.assertCanEdit(id, actor);

    if (comment.deletedAt !== null) {
      throw AppException.notFound('Comment');
    }

    await this.comments.updateOne({ _id: id }, { $set: { body: dto.body } });

    return this.findOrFail(id);
  }

  /**
   * Retira un comentario sin borrarlo.
   *
   * Igual que en el chat: quitar el documento dejaría un hueco en una
   * conversación que otras personas están leyendo, y las respuestas que
   * colgaban de él quedarían sin contexto. Se vacía el texto y se marca la
   * fecha.
   */
  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.assertCanEdit(id, actor);

    await this.comments.updateOne({ _id: id }, { $set: { body: '', deletedAt: new Date() } });
  }

  private async findOrFail(id: string): Promise<Comment> {
    const doc = await this.comments
      .findById(id)
      .populate({ path: 'author', populate: { path: 'avatar' } })
      .lean();

    if (!doc) {
      throw AppException.notFound('Comment');
    }

    return toComment(doc as never);
  }

  private async assertPostExists(postId: string): Promise<void> {
    // Un identificador con forma inválida no existe, y preguntárselo a Mongo
    // lanzaría un error de conversión en lugar de un 404 limpio.
    if (!isValidObjectId(postId) || !(await this.posts.exists({ _id: postId }))) {
      throw AppException.notFound('Post');
    }
  }

  private async assertCanEdit(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ deletedAt: Date | null }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Comment');
    }

    const comment = await this.comments.findById(id).select('userId deletedAt').lean();

    if (!comment) {
      throw AppException.notFound('Comment');
    }

    if (String(comment.userId) !== actor.id && actor.role !== 'admin') {
      throw AppException.forbidden('You can only modify your own comments');
    }

    return { deletedAt: comment.deletedAt };
  }
}
