import {
  HttpStatus,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  LiveComment as LiveCommentDto,
  LiveConnection,
  LiveEvent,
  LiveStream as LiveStreamDto,
} from '@social-network/shared';
import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '../common/decorators/index.js';
import { AppException, ErrorCode } from '../common/errors.js';
import { toIso, toUserSummary, type UserSummaryDoc } from '../common/mappers.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import {
  Audience,
  LiveEventType,
  LiveStatus,
  NotificationType,
} from '../database/schemas/enums.js';
import { LiveComment, LiveStream } from '../database/schemas/story.schema.js';
import { User, UserPermissions } from '../database/schemas/user.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import { RelationshipService } from '../social/relationship.service.js';
import { LiveKitService } from './livekit.service.js';

/** Sin latido durante tanto tiempo, el directo se da por terminado. */
const HEARTBEAT_TIMEOUT_MS = 60_000;
/** Cada cuánto se buscan directos abandonados. */
const SWEEP_EVERY_MS = 30_000;
/** A cuántos seguidores se avisa, como mucho, de que empieza un directo. */
const MAX_LIVE_NOTIFICATIONS = 2000;

const SUMMARY = 'name firstName lastName avatarId verified';

type LeanStream = LiveStream & {
  _id: Types.ObjectId;
  host?: UserSummaryDoc & { _id: Types.ObjectId };
};

/**
 * Directos: quién emite, quién mira y lo que se comenta.
 *
 * El vídeo va por LiveKit; esto lleva el resto. Los comentarios y reacciones
 * se guardan y se difunden por el bus a todos los que miran, y la audiencia la
 * cuenta LiveKit, que es quien sabe de verdad cuánta gente hay en la sala.
 */
@Injectable()
export class LiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    @InjectModel(LiveStream.name) private readonly streams: Model<LiveStream>,
    @InjectModel(LiveComment.name) private readonly comments: Model<LiveComment>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    private readonly livekit: LiveKitService,
    private readonly relationships: RelationshipService,
    private readonly notifications: NotificationsService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.sweeper = setInterval(() => void this.endAbandoned(), SWEEP_EVERY_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
    }
  }

  get enabled(): boolean {
    return this.livekit.enabled;
  }

  /** Empieza a emitir. Devuelve el pase para publicar cámara y micrófono. */
  async start(host: AuthenticatedUser, title: string, audience: Audience): Promise<LiveConnection> {
    this.livekit.assertEnabled();

    const active = await this.streams
      .findOne({ hostId: host.id, status: LiveStatus.Live })
      .select('_id')
      .lean();

    if (active) {
      throw new AppException(
        ErrorCode.LiveAlreadyActive,
        HttpStatus.CONFLICT,
        'You are already live',
        {
          streamId: [String(active._id)],
        },
      );
    }

    const roomName = `live-${randomUUID()}`;
    await this.livekit.createRoom(roomName);

    const now = new Date();
    const created = await this.streams.create({
      hostId: host.id,
      title: title.slice(0, 120),
      audience: audience === Audience.OnlyMe ? Audience.Followers : audience,
      roomName,
      startedAt: now,
      lastHeartbeatAt: now,
    });

    const stream = await this.findDoc(String(created._id));
    const identity = await this.identityOf(host.id);

    void this.notifyFollowers(host.id, String(created._id));
    await this.bus.publish(Topic.domain(DomainEvent.LiveStarted), {
      streamId: String(created._id),
      userId: host.id,
    });

    return {
      stream: this.present(stream),
      serverUrl: this.livekit.serverUrl,
      token: await this.livekit.hostToken(roomName, identity),
    };
  }

  /** Entra a mirar. Sólo lo consigue quien puede verlo. */
  async join(streamId: string, viewer: AuthenticatedUser): Promise<LiveConnection> {
    this.livekit.assertEnabled();

    const stream = await this.findVisible(streamId, viewer.id);

    if (stream.status !== LiveStatus.Live) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'This live stream has ended');
    }

    await this.streams.updateOne({ _id: streamId }, { $inc: { totalViewers: 1 } });

    const identity = await this.identityOf(viewer.id);

    return {
      stream: this.present(stream),
      serverUrl: this.livekit.serverUrl,
      token:
        String(stream.hostId) === viewer.id
          ? await this.livekit.hostToken(stream.roomName, identity)
          : await this.livekit.viewerToken(stream.roomName, identity),
    };
  }

  /**
   * Latido de quien emite, cada pocos segundos.
   *
   * De paso se pregunta a LiveKit cuánta gente mira y, si ha cambiado, se
   * anuncia: así la cifra es la real aunque las conexiones estén repartidas
   * entre varias instancias de la API.
   */
  async heartbeat(streamId: string, hostId: string): Promise<LiveStreamDto> {
    const stream = await this.assertHost(streamId, hostId);

    if (stream.status !== LiveStatus.Live) {
      return this.present(stream);
    }

    const viewers = await this.livekit.viewerCount(stream.roomName, hostId);
    const update: Record<string, unknown> = { lastHeartbeatAt: new Date() };

    if (viewers !== null) {
      update['viewerCount'] = viewers;
    }

    await this.streams.updateOne(
      { _id: streamId },
      { $set: update, ...(viewers !== null ? { $max: { peakViewerCount: viewers } } : {}) },
    );

    if (viewers !== null && viewers !== stream.viewerCount) {
      await this.emit(streamId, { type: LiveEventType.ViewerCount, viewerCount: viewers });
    }

    return this.present(await this.findDoc(streamId));
  }

  async end(streamId: string, actor: AuthenticatedUser): Promise<LiveStreamDto> {
    const stream = await this.assertHost(streamId, actor.id, actor.role === 'admin');

    await this.finish(stream);

    return this.present(await this.findDoc(streamId));
  }

  async comment(streamId: string, userId: string, body: string): Promise<LiveCommentDto> {
    const stream = await this.findVisible(streamId, userId);

    if (stream.status !== LiveStatus.Live) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'This live stream has ended');
    }

    const created = await this.comments.create({ streamId, userId, body });
    await this.streams.updateOne({ _id: streamId }, { $inc: { commentCount: 1 } });

    const doc = await this.comments
      .findById(created._id)
      .populate({ path: 'author', select: SUMMARY, populate: { path: 'avatar' } })
      .lean();
    const comment = this.presentComment(doc as never);

    await this.emit(streamId, { type: LiveEventType.Comment, comment, user: comment.author });

    return comment;
  }

  /** Las reacciones que flotan sobre el vídeo. No se guardan una a una: sólo cuentan. */
  async react(streamId: string, userId: string, emoji: string): Promise<boolean> {
    const stream = await this.findVisible(streamId, userId);

    if (stream.status !== LiveStatus.Live) {
      return false;
    }

    await this.streams.updateOne({ _id: streamId }, { $inc: { reactionCount: 1 } });

    const user = await this.users.findById(userId).select(SUMMARY).populate('avatar').lean();

    await this.emit(streamId, {
      type: LiveEventType.Reaction,
      reaction: emoji,
      user: toUserSummary(user),
    });

    return true;
  }

  /** Directos en curso: primero de quienes sigues, luego el resto que puedes ver. */
  async active(viewerId: string | null, limit = 30): Promise<LiveStreamDto[]> {
    const context = await this.relationships.viewerContext(viewerId);
    const docs = (await this.streams
      .find({ status: LiveStatus.Live })
      .sort({ viewerCount: -1, startedAt: -1 })
      .limit(200)
      .populate({ path: 'host', select: SUMMARY, populate: { path: 'avatar' } })
      .lean()) as unknown as LeanStream[];

    const privateHosts = await this.privateHostsOf(docs);

    return docs
      .filter((doc) =>
        this.relationships.canSee(context, {
          ownerId: String(doc.hostId),
          audience: doc.audience,
          ownerPrivate: privateHosts.has(String(doc.hostId)),
        }),
      )
      .sort(
        (a, b) =>
          Number(context.followingIds.has(String(b.hostId))) -
          Number(context.followingIds.has(String(a.hostId))),
      )
      .slice(0, limit)
      .map((doc) => this.present(doc));
  }

  async findOne(streamId: string, viewerId: string | null): Promise<LiveStreamDto> {
    return this.present(await this.findVisible(streamId, viewerId));
  }

  /** Comentarios anteriores, para quien entra con el directo empezado. */
  async listComments(
    streamId: string,
    viewerId: string | null,
    before: string | null,
    limit: number,
  ): Promise<{ data: LiveCommentDto[]; nextCursor: string | null }> {
    await this.findVisible(streamId, viewerId);

    const blocked = viewerId
      ? [...(await this.relationships.blockedIds(viewerId))].map((id) => new ObjectId(id))
      : [];
    const take = Math.min(Math.max(limit, 1), 100);

    const docs = await this.comments
      .find({
        streamId,
        ...(before && isValidObjectId(before) ? { _id: { $lt: new ObjectId(before) } } : {}),
        ...(blocked.length > 0 ? { userId: { $nin: blocked } } : {}),
      })
      .sort({ _id: -1 })
      .limit(take + 1)
      .populate({ path: 'author', select: SUMMARY, populate: { path: 'avatar' } })
      .lean();

    const page = docs.slice(0, take);

    return {
      data: page.map((doc) => this.presentComment(doc as never)).reverse(),
      nextCursor: docs.length > take ? String(page.at(-1)?._id) : null,
    };
  }

  /** Comprueba que quien escucha los eventos de un directo puede verlo. */
  async assertCanWatch(streamId: string, viewerId: string): Promise<void> {
    await this.findVisible(streamId, viewerId);
  }

  private async finish(stream: LeanStream): Promise<void> {
    if (stream.status === LiveStatus.Ended) {
      return;
    }

    await this.streams.updateOne(
      { _id: stream._id, status: LiveStatus.Live },
      { $set: { status: LiveStatus.Ended, endedAt: new Date(), viewerCount: 0 } },
    );
    await this.livekit.deleteRoom(stream.roomName);
    await this.emit(String(stream._id), { type: LiveEventType.Ended });
    await this.notifications.removeFor({ liveStreamId: String(stream._id) });
    await this.bus.publish(Topic.domain(DomainEvent.LiveEnded), {
      streamId: String(stream._id),
      userId: String(stream.hostId),
    });
  }

  /** Termina los directos cuyo emisor dejó de dar señales. */
  private async endAbandoned(): Promise<void> {
    try {
      const stale = (await this.streams
        .find({
          status: LiveStatus.Live,
          lastHeartbeatAt: { $lt: new Date(Date.now() - HEARTBEAT_TIMEOUT_MS) },
        })
        .lean()) as unknown as LeanStream[];

      for (const stream of stale) {
        this.logger.log(`Directo ${String(stream._id)} sin latido: se da por terminado`);
        await this.finish(stream);
      }
    } catch (error) {
      this.logger.warn(`No se pudieron revisar los directos abandonados: ${String(error)}`);
    }
  }

  private async notifyFollowers(hostId: string, streamId: string): Promise<void> {
    const followers = await this.relationships.followerIds(hostId);

    for (const followerId of followers.slice(0, MAX_LIVE_NOTIFICATIONS)) {
      await this.notifications.notify({
        recipientId: followerId,
        actorId: hostId,
        type: NotificationType.LiveStarted,
        liveStreamId: streamId,
      });
    }
  }

  private async emit(
    streamId: string,
    event: Partial<LiveEvent> & { type: LiveEvent['type'] },
  ): Promise<void> {
    const payload: LiveEvent = {
      streamId,
      comment: null,
      reaction: null,
      user: null,
      viewerCount: null,
      ...event,
    };

    await this.bus.publish(Topic.live(streamId), payload);
  }

  private async findVisible(streamId: string, viewerId: string | null): Promise<LeanStream> {
    const stream = await this.findDoc(streamId);
    const context = await this.relationships.viewerContext(viewerId);
    const privateHosts = await this.privateHostsOf([stream]);

    const visible = this.relationships.canSee(context, {
      ownerId: String(stream.hostId),
      audience: stream.audience,
      ownerPrivate: privateHosts.has(String(stream.hostId)),
    });

    if (!visible) {
      throw AppException.notFound('LiveStream');
    }

    return stream;
  }

  private async findDoc(streamId: string): Promise<LeanStream> {
    if (!isValidObjectId(streamId)) {
      throw AppException.notFound('LiveStream');
    }

    const stream = (await this.streams
      .findById(streamId)
      .populate({ path: 'host', select: SUMMARY, populate: { path: 'avatar' } })
      .lean()) as unknown as LeanStream | null;

    if (!stream) {
      throw AppException.notFound('LiveStream');
    }

    return stream;
  }

  private async assertHost(
    streamId: string,
    userId: string,
    allowAdmin = false,
  ): Promise<LeanStream> {
    const stream = await this.findDoc(streamId);

    if (String(stream.hostId) !== userId && !allowAdmin) {
      throw AppException.forbidden('Only the host can do this');
    }

    return stream;
  }

  private async privateHostsOf(docs: LeanStream[]): Promise<Set<string>> {
    const ids = [...new Set(docs.map((doc) => String(doc.hostId)))];
    const rows = await this.permissions
      .find({ userId: { $in: ids }, privateProfile: true })
      .select('userId')
      .lean();

    return new Set(rows.map((row) => String(row.userId)));
  }

  private async identityOf(userId: string): Promise<{ id: string; name: string }> {
    const user = await this.users.findById(userId).select('firstName lastName name').lean();

    return {
      id: userId,
      name: user ? `${user.firstName} ${user.lastName}`.trim() || user.name : userId,
    };
  }

  private present(doc: LeanStream): LiveStreamDto {
    return {
      id: String(doc._id),
      host: toUserSummary(doc.host),
      title: doc.title,
      status: doc.status,
      audience: doc.audience,
      viewerCount: doc.viewerCount,
      peakViewerCount: doc.peakViewerCount,
      reactionCount: doc.reactionCount,
      commentCount: doc.commentCount,
      startedAt: toIso(doc.startedAt),
      endedAt: toIso(doc.endedAt),
    };
  }

  private presentComment(
    doc: LiveComment & { _id: Types.ObjectId; author?: UserSummaryDoc & { _id: Types.ObjectId } },
  ): LiveCommentDto {
    return {
      id: String(doc._id),
      streamId: String(doc.streamId),
      author: toUserSummary(doc.author),
      body: doc.body,
      createdAt: toIso(doc.createdAt),
    };
  }
}
