import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  ChatEvent,
  Conversation as ConversationDto,
  ConversationMember as ConversationMemberDto,
  Message as MessageDto,
  MessageReactionGroup,
  Post as PostDto,
} from '@social-network/shared';

import {
  POPULATE_POST,
  toIso,
  toMedia,
  toMediaOrNull,
  toUserSummary,
  type MediaDoc,
  type UserSummaryDoc,
} from '../common/mappers.js';
import type { Model, Types } from '../database/mongoose.js';
import type { Conversation, ConversationMember, Message } from '../database/schemas/chat.schema.js';
import {
  ConversationRole,
  ConversationType,
  MessageKind,
  MessageStatus,
} from '../database/schemas/enums.js';
import { User } from '../database/schemas/user.schema.js';
import { PostViewService, type LeanPost } from '../social/post-view.service.js';

const SUMMARY = 'name firstName lastName avatarId verified';

/** Relaciones que hacen falta para pintar un mensaje entero. */
export const POPULATE_MESSAGE = [
  { path: 'sender', select: SUMMARY, populate: { path: 'avatar' } },
  { path: 'attachments' },
  {
    path: 'replyTo',
    select: 'kind body senderId attachmentIds deletedAt',
    populate: [
      { path: 'sender', select: SUMMARY, populate: { path: 'avatar' } },
      { path: 'attachments' },
    ],
  },
  { path: 'sharedPost', populate: POPULATE_POST },
  { path: 'story', select: 'mediaId text expiresAt deletedAt', populate: { path: 'media' } },
];

export type LeanConversation = Conversation & {
  _id: Types.ObjectId;
  photo?: MediaDoc & { _id: Types.ObjectId };
};
export type LeanMember = ConversationMember & {
  _id: Types.ObjectId;
  user?: UserSummaryDoc & { _id: Types.ObjectId };
};
export type LeanMessage = Message & {
  _id: Types.ObjectId;
  sender?: UserSummaryDoc & { _id: Types.ObjectId };
  attachments?: (MediaDoc & { _id: Types.ObjectId })[];
  replyTo?:
    | (Message & {
        _id: Types.ObjectId;
        sender?: UserSummaryDoc & { _id: Types.ObjectId };
        attachments?: (MediaDoc & { _id: Types.ObjectId })[];
      })
    | null;
  sharedPost?: LeanPost | null;
  story?: {
    _id: Types.ObjectId;
    text: string | null;
    expiresAt: Date;
    deletedAt: Date | null;
    media?: (MediaDoc & { _id: Types.ObjectId }) | null;
  } | null;
};

/**
 * De documentos del chat a lo que ve cada participante.
 *
 * Separado del servicio porque hay mucho que calcular por mensaje —hasta dónde
 * ha llegado, quién reaccionó, la cita, la publicación compartida— y porque el
 * mismo mensaje se vuelve a ajustar para cada persona que lo recibe en vivo.
 */
@Injectable()
export class ChatPresenterService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly postViews: PostViewService,
  ) {}

  conversation(
    conversation: LeanConversation,
    members: LeanMember[],
    viewerId: string,
    options: { blocked: boolean },
  ): ConversationDto {
    const mine = members.find((member) => String(member.userId) === viewerId);
    const active = members.filter((member) => member.leftAt === null && member.user);
    const isDirect = conversation.type === ConversationType.Direct;
    const peer = isDirect ? active.find((member) => String(member.userId) !== viewerId) : undefined;

    return {
      id: String(conversation._id),
      type: conversation.type,
      title: conversation.title,
      photo: toMediaOrNull(conversation.photo),
      peer: peer?.user ? toUserSummary(peer.user) : null,
      members: active.map((member) => this.member(member)),
      myRole: mine?.role ?? ConversationRole.Member,
      lastMessageAt: toIso(conversation.lastMessageAt),
      lastPreview: conversation.lastPreview,
      lastSenderId: conversation.lastSenderId ? String(conversation.lastSenderId) : null,
      unreadCount: mine?.unreadCount ?? 0,
      muted: mine?.muted ?? false,
      archived: mine?.archived ?? false,
      pinned: mine?.pinnedAt !== null && mine?.pinnedAt !== undefined,
      readOnly: !mine || mine.leftAt !== null || (isDirect && (options.blocked || !peer)),
      createdAt: toIso(conversation.createdAt),
    };
  }

  member(member: LeanMember): ConversationMemberDto {
    return {
      user: toUserSummary(member.user),
      role: member.role,
      lastReadMessageId: member.lastReadMessageId ? String(member.lastReadMessageId) : null,
      lastReadAt: toIso(member.lastReadAt),
      joinedAt: toIso(member.createdAt),
    };
  }

  /**
   * Traduce una tanda de mensajes.
   *
   * El estado —enviado, entregado, leído— sale de hasta dónde han leído y
   * recibido los demás participantes, no de una fila por mensaje.
   */
  async messages(
    docs: LeanMessage[],
    members: LeanMember[],
    viewerId: string,
  ): Promise<MessageDto[]> {
    const systemTargets = await this.systemTargets(docs);
    const sharedPosts = await this.sharedPosts(docs, viewerId);

    return docs.map((doc) => this.message(doc, members, viewerId, systemTargets, sharedPosts));
  }

  /**
   * Ajusta un mensaje ya traducido para otra persona.
   *
   * Lo que viaja por el bus se calcula una vez; al entregarlo a cada
   * suscriptor cambian dos cosas: si reaccionó él y, si no es el autor, que
   * no hay estado de entrega que enseñarle.
   */
  forViewer(message: MessageDto, viewerId: string): MessageDto {
    return personalizeMessage(message, viewerId);
  }

  private message(
    doc: LeanMessage,
    members: LeanMember[],
    viewerId: string,
    systemTargets: Map<string, UserSummaryDoc & { _id: Types.ObjectId }>,
    sharedPosts: Map<string, PostDto>,
  ): MessageDto {
    const deleted = doc.deletedAt !== null;
    const senderId = String(doc.senderId);
    const createdAt = doc.createdAt;
    const others = members.filter(
      (member) => String(member.userId) !== senderId && member.leftAt === null,
    );
    const readCount = others.filter(
      (member) => member.lastReadAt && member.lastReadAt >= createdAt,
    ).length;
    const deliveredCount = others.filter(
      (member) =>
        (member.lastDeliveredAt && member.lastDeliveredAt >= createdAt) ||
        (member.lastReadAt && member.lastReadAt >= createdAt),
    ).length;

    let status: MessageStatus = MessageStatus.Sent;

    if (others.length > 0 && readCount === others.length) {
      status = MessageStatus.Read;
    } else if (others.length > 0 && deliveredCount === others.length) {
      status = MessageStatus.Delivered;
    }

    const reply = doc.replyTo;
    const story = doc.story;

    return {
      id: String(doc._id),
      conversationId: String(doc.conversationId),
      clientId: doc.clientId,
      kind: doc.kind,
      body: deleted ? null : doc.body,
      attachments: deleted ? [] : (doc.attachments ?? []).map(toMedia),
      replyTo: reply
        ? {
            id: String(reply._id),
            kind: reply.kind,
            body: reply.deletedAt ? null : (reply.body?.slice(0, 200) ?? null),
            sender: toUserSummary(reply.sender),
            thumbnail: reply.deletedAt ? null : toMediaOrNull(reply.attachments?.[0]),
            deleted: reply.deletedAt !== null,
          }
        : null,
      sharedPost:
        !deleted && doc.sharedPostId ? (sharedPosts.get(String(doc.sharedPostId)) ?? null) : null,
      story:
        doc.storyId && !deleted
          ? {
              id: String(doc.storyId),
              media:
                story && !story.deletedAt && story.expiresAt > new Date()
                  ? toMediaOrNull(story.media)
                  : null,
              text: story && !story.deletedAt ? story.text : null,
              expired: !story || story.deletedAt !== null || story.expiresAt <= new Date(),
            }
          : null,
      system: doc.system
        ? {
            action: doc.system.action,
            targets: doc.system.targetIds
              .map((id) => systemTargets.get(String(id)))
              .filter(Boolean)
              .map((user) => toUserSummary(user)),
            value: doc.system.value,
          }
        : null,
      sender: toUserSummary(doc.sender),
      reactions: groupReactions(doc.reactions, viewerId),
      status: doc.kind === MessageKind.System ? null : senderId === viewerId ? status : null,
      readCount,
      editedAt: toIso(doc.editedAt),
      deleted,
      createdAt: toIso(createdAt),
    };
  }

  private async systemTargets(
    docs: LeanMessage[],
  ): Promise<Map<string, UserSummaryDoc & { _id: Types.ObjectId }>> {
    const ids = [...new Set(docs.flatMap((doc) => doc.system?.targetIds ?? []).map(String))];

    if (ids.length === 0) {
      return new Map();
    }

    const users = await this.users
      .find({ _id: { $in: ids } })
      .select(SUMMARY)
      .populate('avatar')
      .lean();

    return new Map(
      users.map((user) => [
        String(user._id),
        user as unknown as UserSummaryDoc & { _id: Types.ObjectId },
      ]),
    );
  }

  private async sharedPosts(docs: LeanMessage[], viewerId: string): Promise<Map<string, PostDto>> {
    const posts = docs.flatMap((doc) => (doc.sharedPost && !doc.deletedAt ? [doc.sharedPost] : []));

    if (posts.length === 0) {
      return new Map();
    }

    const presented = await this.postViews.present(posts, viewerId);

    return new Map(presented.map((post) => [post.id, post]));
  }
}

/** Un mensaje visto por otra persona: sus reacciones y, si no es suyo, sin estado de entrega. */
export function personalizeMessage(message: MessageDto, viewerId: string): MessageDto {
  return {
    ...message,
    status: message.sender.id === viewerId ? message.status : null,
    reactions: message.reactions.map((group) => ({
      ...group,
      reactedByMe: group.userIds.includes(viewerId),
    })),
  };
}

export function personalizeChatEvent(event: ChatEvent, viewerId: string): ChatEvent {
  return event.message ? { ...event, message: personalizeMessage(event.message, viewerId) } : event;
}

function groupReactions(
  reactions: { userId: Types.ObjectId; emoji: string }[],
  viewerId: string,
): MessageReactionGroup[] {
  const groups = new Map<string, string[]>();

  for (const reaction of reactions) {
    const list = groups.get(reaction.emoji) ?? [];
    list.push(String(reaction.userId));
    groups.set(reaction.emoji, list);
  }

  return [...groups.entries()]
    .map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByMe: userIds.includes(viewerId),
    }))
    .sort((a, b) => b.count - a.count);
}
