import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Paginated, Report as ReportDto } from '@social-network/shared';

import { AppException, ErrorCode } from '../common/errors.js';
import { toIso, toUserSummary } from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { isValidObjectId, type Model, type Types } from '../database/mongoose.js';
import { Message } from '../database/schemas/chat.schema.js';
import { Comment, Post, Report } from '../database/schemas/content.schema.js';
import { ReportStatus, ReportTarget } from '../database/schemas/enums.js';
import { LiveStream, Story } from '../database/schemas/story.schema.js';
import { User } from '../database/schemas/user.schema.js';

/**
 * Denuncias y su revisión.
 *
 * Cualquier cosa se puede denunciar: una publicación, un comentario, una
 * persona, una historia, un mensaje o un directo. Se apunta también quién es
 * el dueño de lo denunciado, para que moderación vea de un vistazo a quién se
 * denuncia más.
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Story.name) private readonly stories: Model<Story>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(LiveStream.name) private readonly lives: Model<LiveStream>,
  ) {}

  /**
   * Registra una denuncia.
   *
   * Denunciar dos veces lo mismo actualiza el motivo en lugar de acumular
   * documentos: el peso de una denuncia no debe depender de cuántas veces
   * pulse el botón la misma persona.
   */
  async report(reporterId: string, targetType: ReportTarget, targetId: string, reason: string): Promise<void> {
    const ownerId = await this.ownerOf(targetType, targetId);

    if (ownerId === null) {
      throw AppException.notFound('Report target');
    }

    if (String(ownerId) === reporterId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'You cannot report your own content');
    }

    await this.reports.updateOne(
      { targetType, targetId, reporterId },
      { $set: { reason, status: ReportStatus.Pending, targetOwnerId: ownerId } },
      { upsert: true },
    );
  }

  async list(status: ReportStatus | undefined, page: number, perPage: number): Promise<Paginated<ReportDto>> {
    const pagination = toPage({ page, perPage });
    const filter = status ? { status } : {};

    const [docs, total] = await Promise.all([
      this.reports
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.take)
        .populate({ path: 'reporter', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } })
        .lean(),
      this.reports.countDocuments(filter),
    ]);

    const ownerIds = [...new Set(docs.map((doc) => String(doc.targetOwnerId)).filter((id) => id !== 'null'))];
    const owners = await this.users
      .find({ _id: { $in: ownerIds } })
      .select('name firstName lastName avatarId verified')
      .populate('avatar')
      .lean();
    const byId = new Map(owners.map((owner) => [String(owner._id), owner]));

    return paginate(
      docs.map((doc) => {
        const reporter = (doc as { reporter?: unknown }).reporter;
        const owner = doc.targetOwnerId ? byId.get(String(doc.targetOwnerId)) : undefined;

        return {
          id: String(doc._id),
          targetType: doc.targetType,
          targetId: String(doc.targetId),
          targetOwner: owner ? toUserSummary(owner) : null,
          reporter: reporter ? toUserSummary(reporter as never) : null,
          reason: doc.reason,
          status: doc.status,
          createdAt: toIso(doc.createdAt),
          reviewedAt: toIso(doc.reviewedAt),
        };
      }),
      total,
      pagination.page,
      pagination.perPage,
    );
  }

  /** Marca una denuncia como revisada o descartada, y las iguales con ella. */
  async resolve(reportId: string, status: ReportStatus, reviewerId: string): Promise<void> {
    if (!isValidObjectId(reportId)) {
      throw AppException.notFound('Report');
    }

    const report = await this.reports.findById(reportId).select('targetType targetId').lean();

    if (!report) {
      throw AppException.notFound('Report');
    }

    await this.reports.updateMany(
      { targetType: report.targetType, targetId: report.targetId, status: ReportStatus.Pending },
      { $set: { status, reviewedById: reviewerId, reviewedAt: new Date() } },
    );
  }

  private async ownerOf(type: ReportTarget, id: string): Promise<Types.ObjectId | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    switch (type) {
      case ReportTarget.Post:
        return (await this.posts.findById(id).select('userId').lean())?.userId ?? null;
      case ReportTarget.Comment:
        return (await this.comments.findById(id).select('userId').lean())?.userId ?? null;
      case ReportTarget.User:
        return (await this.users.exists({ _id: id }))?._id ?? null;
      case ReportTarget.Story:
        return (await this.stories.findById(id).select('authorId').lean())?.authorId ?? null;
      case ReportTarget.Message:
        return (await this.messages.findById(id).select('senderId').lean())?.senderId ?? null;
      case ReportTarget.Live:
        return (await this.lives.findById(id).select('hostId').lean())?.hostId ?? null;
    }
  }
}
