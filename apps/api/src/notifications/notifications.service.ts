import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Branding, Notification as NotificationDto, NotificationPage } from '@social-network/shared';

import { toId, toIso, toMediaOrNull, toUserSummary, type MediaDoc } from '../common/mappers.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Media } from '../database/schemas/content.schema.js';
import { NotificationEventType, NotificationType } from '../database/schemas/enums.js';
import { Notification } from '../database/schemas/notification.schema.js';
import { Block, User } from '../database/schemas/user.schema.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { PresenceService } from '../realtime/presence.service.js';
import { Topic } from '../realtime/topics.js';
import type { UserChannelMessage } from '../realtime/user-channel.js';
import { PushService } from './push.service.js';

/** Cuántos actores se guardan por aviso agrupado: los que se nombran. */
const MAX_ACTORS = 5;

export interface NotifyInput {
  recipientId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  type: NotificationType;
  postId?: string | Types.ObjectId | null;
  commentId?: string | Types.ObjectId | null;
  storyId?: string | Types.ObjectId | null;
  liveStreamId?: string | Types.ObjectId | null;
  preview?: string | null;
}

type LeanNotification = Notification & { _id: Types.ObjectId; actors?: unknown[] };

/**
 * Los avisos: quién reaccionó, comentó, te siguió o empezó un directo.
 *
 * Los parecidos se agrupan mientras no se leen: veinte reacciones a la misma
 * publicación son un aviso —«Ana y 19 personas más»—, no veinte. Cada cambio
 * se anuncia por el tema privado de la persona para que el contador de la
 * campana se actualice al momento, y si no está conectada se le manda además
 * una notificación push.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(Block.name) private readonly blocks: Model<Block>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Media.name) private readonly media: Model<Media>,
    private readonly bus: EventBusService,
    private readonly presence: PresenceService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  /** Crea o engorda un aviso. Nunca hace fallar la acción que lo provoca. */
  async notify(input: NotifyInput): Promise<void> {
    const recipientId = String(input.recipientId);
    const actorId = String(input.actorId);

    if (recipientId === actorId || !isValidObjectId(recipientId)) {
      return;
    }

    try {
      if (await this.isBlocked(recipientId, actorId)) {
        return;
      }

      const groupKey = groupKeyOf(input);
      const now = new Date();
      const actor = new ObjectId(actorId);

      // Se busca un aviso sin leer del mismo grupo; si lo hay, el actor pasa
      // al principio de la lista sin repetirse.
      const existing = await this.notifications
        .findOne({ recipientId, groupKey, readAt: null })
        .select('actorIds')
        .lean();

      let doc: LeanNotification | null;

      if (existing) {
        const alreadyThere = existing.actorIds.some((id) => String(id) === actorId);
        const actorIds = [actor, ...existing.actorIds.filter((id) => String(id) !== actorId)].slice(0, MAX_ACTORS);

        doc = await this.notifications
          .findOneAndUpdate(
            { _id: existing._id },
            {
              $set: { actorIds, activityAt: now, preview: input.preview ?? null },
              ...(alreadyThere ? {} : { $inc: { actorCount: 1 } }),
            },
            { returnDocument: 'after' },
          )
          .lean();
      } else {
        const created = await this.notifications.create({
          recipientId,
          type: input.type,
          actorIds: [actor],
          actorCount: 1,
          groupKey,
          postId: input.postId ?? null,
          commentId: input.commentId ?? null,
          storyId: input.storyId ?? null,
          liveStreamId: input.liveStreamId ?? null,
          preview: input.preview ?? null,
          activityAt: now,
        });

        doc = created.toObject();
      }

      if (doc) {
        await this.announce(recipientId, doc);
        await this.sendPush(recipientId, actorId, input);
      }
    } catch (error) {
      this.logger.warn(`No se pudo crear el aviso ${input.type} para ${recipientId}: ${String(error)}`);
    }
  }

  /**
   * Quita a alguien de un aviso: retiró su reacción, dejó de seguir…
   *
   * Si era el único actor, el aviso desaparece.
   */
  async retract(input: NotifyInput): Promise<void> {
    const recipientId = String(input.recipientId);
    const actorId = String(input.actorId);

    try {
      const groupKey = groupKeyOf(input);
      const doc = await this.notifications
        .findOneAndUpdate(
          { recipientId, groupKey, actorIds: new ObjectId(actorId) },
          { $pull: { actorIds: new ObjectId(actorId) }, $inc: { actorCount: -1 } },
          { returnDocument: 'after' },
        )
        .lean();

      if (doc && (doc.actorIds.length === 0 || doc.actorCount <= 0)) {
        await this.notifications.deleteOne({ _id: doc._id });
      }
    } catch (error) {
      this.logger.debug(`No se pudo retirar el aviso: ${String(error)}`);
    }
  }

  /** Borra los avisos que apuntan a algo que ya no existe. */
  async removeFor(target: { postId?: string; commentId?: string; storyId?: string; liveStreamId?: string }): Promise<void> {
    const filter = Object.fromEntries(Object.entries(target).filter(([, value]) => value !== undefined));

    if (Object.keys(filter).length > 0) {
      await this.notifications.deleteMany(filter);
    }
  }

  async list(userId: string, cursor: string | null, limit: number): Promise<NotificationPage> {
    const take = Math.min(Math.max(limit, 1), 50);
    const before = cursor ? new Date(cursor) : null;

    const docs = await this.notifications
      .find({
        recipientId: userId,
        ...(before && !Number.isNaN(before.getTime()) ? { activityAt: { $lt: before } } : {}),
      })
      .sort({ activityAt: -1 })
      .limit(take + 1)
      .populate({ path: 'actors', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } })
      .lean();

    const page = docs.slice(0, take) as LeanNotification[];
    const thumbnails = await this.thumbnailsFor(page);

    return {
      data: page.map((doc) => this.toDto(doc, thumbnails)),
      nextCursor: docs.length > take ? (toIso(page.at(-1)?.activityAt ?? null) ?? null) : null,
      unreadCount: await this.unreadCount(userId),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications.countDocuments({ recipientId: userId, readAt: null });
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    const valid = ids.filter((id) => isValidObjectId(id));

    await this.notifications.updateMany(
      { recipientId: userId, _id: { $in: valid }, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return this.broadcastUnread(userId);
  }

  async markAllRead(userId: string): Promise<number> {
    await this.notifications.updateMany({ recipientId: userId, readAt: null }, { $set: { readAt: new Date() } });

    return this.broadcastUnread(userId);
  }

  private async broadcastUnread(userId: string): Promise<number> {
    const unreadCount = await this.unreadCount(userId);
    const message: UserChannelMessage = {
      channel: 'notification',
      event: { type: NotificationEventType.AllRead, notification: null, unreadCount },
    };

    await this.bus.publish(Topic.user(userId), message);

    return unreadCount;
  }

  private async announce(recipientId: string, doc: LeanNotification): Promise<void> {
    const populated = await this.notifications
      .findById(doc._id)
      .populate({ path: 'actors', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } })
      .lean();

    if (!populated) {
      return;
    }

    const thumbnails = await this.thumbnailsFor([populated]);
    const message: UserChannelMessage = {
      channel: 'notification',
      event: {
        type: NotificationEventType.Upserted,
        notification: this.toDto(populated, thumbnails),
        unreadCount: await this.unreadCount(recipientId),
      },
    };

    await this.bus.publish(Topic.user(recipientId), message);
  }

  /** La primera foto de cada publicación citada, para la miniatura del aviso. */
  private async thumbnailsFor(docs: LeanNotification[]): Promise<Map<string, MediaDoc & { _id: Types.ObjectId }>> {
    const postIds = [...new Set(docs.map((doc) => toId(doc.postId)).filter((id): id is string => id !== null))];
    const map = new Map<string, MediaDoc & { _id: Types.ObjectId }>();

    if (postIds.length === 0) {
      return map;
    }

    const media = await this.media
      .find({ postId: { $in: postIds }, position: 0 })
      .lean();

    for (const item of media) {
      if (item.postId) {
        map.set(String(item.postId), item);
      }
    }

    return map;
  }

  private toDto(doc: LeanNotification, thumbnails: Map<string, MediaDoc & { _id: Types.ObjectId }>): NotificationDto {
    const actors = ((doc.actors ?? []) as Parameters<typeof toUserSummary>[0][])
      // Los virtuales pueblan en cualquier orden: se recoloca como se guardó.
      .sort(
        (a, b) =>
          doc.actorIds.findIndex((id) => String(id) === String(a?._id)) -
          doc.actorIds.findIndex((id) => String(id) === String(b?._id)),
      )
      .map((actor) => toUserSummary(actor));
    const postId = toId(doc.postId);

    return {
      id: String(doc._id),
      type: doc.type,
      actors,
      actorCount: Math.max(doc.actorCount, actors.length),
      postId,
      commentId: toId(doc.commentId),
      storyId: toId(doc.storyId),
      liveStreamId: toId(doc.liveStreamId),
      thumbnail: postId ? toMediaOrNull(thumbnails.get(postId)) : null,
      preview: doc.preview,
      read: doc.readAt !== null,
      createdAt: toIso(doc.createdAt),
      updatedAt: toIso(doc.activityAt),
    };
  }

  private async sendPush(recipientId: string, actorId: string, input: NotifyInput): Promise<void> {
    if (!this.push.enabled || (await this.presence.isOnline(recipientId))) {
      return;
    }

    const [actor, recipient] = await Promise.all([
      this.users.findById(actorId).select('firstName lastName').lean(),
      this.users.findById(recipientId).select('lang').lean(),
    ]);

    if (!actor || !recipient) {
      return;
    }

    const name = `${actor.firstName} ${actor.lastName}`.trim();
    const lang = recipient.lang?.startsWith('en') ? 'en' : 'es';

    await this.push.sendToUsers([recipientId], {
      title: this.config.getOrThrow<Branding>('branding').name,
      body: `${name} ${PUSH_COPY[lang][input.type]}${input.preview ? `: ${input.preview}` : ''}`,
      data: {
        type: input.type,
        ...(input.postId ? { postId: String(input.postId) } : {}),
        ...(input.storyId ? { storyId: String(input.storyId) } : {}),
        ...(input.liveStreamId ? { liveStreamId: String(input.liveStreamId) } : {}),
        actorId,
      },
      tag: groupKeyOf(input),
    });
  }

  private async isBlocked(a: string, b: string): Promise<boolean> {
    const found = await this.blocks.exists({
      $or: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });

    return found !== null;
  }
}

/**
 * Qué avisos se funden en uno.
 *
 * Las reacciones y comentarios, por publicación; los seguidores nuevos, todos
 * juntos; un directo, uno por directo. Una mención o una respuesta, en cambio,
 * van por comentario: cada una tiene su texto y merece su aviso.
 */
function groupKeyOf(input: NotifyInput): string {
  const target =
    toId(input.commentId) ??
    toId(input.postId) ??
    toId(input.storyId) ??
    toId(input.liveStreamId);

  switch (input.type) {
    case NotificationType.Reaction:
    case NotificationType.Comment:
    case NotificationType.PostShared:
      return `${input.type}:${toId(input.postId) ?? ''}`;
    case NotificationType.Follow:
    case NotificationType.FollowRequest:
      return input.type;
    case NotificationType.FollowAccepted:
      return `${input.type}:${String(input.actorId)}`;
    default:
      return `${input.type}:${target ?? ''}`;
  }
}

const PUSH_COPY: Record<'es' | 'en', Record<NotificationType, string>> = {
  es: {
    reaction: 'reaccionó a tu publicación',
    comment: 'comentó tu publicación',
    reply: 'respondió a tu comentario',
    comment_like: 'le gustó tu comentario',
    mention: 'te mencionó',
    follow: 'empezó a seguirte',
    follow_request: 'quiere seguirte',
    follow_accepted: 'aceptó tu solicitud',
    story_reaction: 'reaccionó a tu historia',
    live_started: 'ha empezado un directo',
    post_shared: 'compartió tu publicación',
    security_alert: 'alerta de seguridad',
  },
  en: {
    reaction: 'reacted to your post',
    comment: 'commented on your post',
    reply: 'replied to your comment',
    comment_like: 'liked your comment',
    mention: 'mentioned you',
    follow: 'started following you',
    follow_request: 'wants to follow you',
    follow_accepted: 'accepted your request',
    story_reaction: 'reacted to your story',
    live_started: 'is live now',
    post_shared: 'shared your post',
    security_alert: 'security alert',
  },
};
