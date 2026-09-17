import type { Media, Post, UserSummary } from './models.js';

export const ConversationType = {
  Direct: 'direct',
  Group: 'group',
} as const;
export type ConversationType = (typeof ConversationType)[keyof typeof ConversationType];

export const ConversationRole = {
  Owner: 'owner',
  Admin: 'admin',
  Member: 'member',
} as const;
export type ConversationRole = (typeof ConversationRole)[keyof typeof ConversationRole];

export const MessageKind = {
  Text: 'text',
  Image: 'image',
  Video: 'video',
  Audio: 'audio',
  File: 'file',
  PostShare: 'post_share',
  StoryReply: 'story_reply',
  System: 'system',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const SystemMessageAction = {
  Created: 'created',
  MembersAdded: 'members_added',
  MemberRemoved: 'member_removed',
  MemberLeft: 'member_left',
  Renamed: 'renamed',
  PhotoChanged: 'photo_changed',
  AdminGranted: 'admin_granted',
} as const;
export type SystemMessageAction = (typeof SystemMessageAction)[keyof typeof SystemMessageAction];

/**
 * Hasta dónde ha llegado un mensaje propio.
 *
 * `sending` y `failed` sólo existen en el cliente, mientras el mensaje espera
 * en la bandeja de salida; el servidor nunca los devuelve.
 */
export const MessageStatus = {
  Sending: 'sending',
  Failed: 'failed',
  Sent: 'sent',
  Delivered: 'delivered',
  Read: 'read',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

/** Las reacciones de un mensaje, agrupadas por emoji. */
export interface MessageReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

/** Un mensaje citado encima de su respuesta: sólo lo justo para reconocerlo. */
export interface MessageReference {
  id: string;
  kind: MessageKind;
  body: string | null;
  sender: UserSummary;
  /** La primera imagen o vídeo, para la miniatura de la cita. */
  thumbnail: Media | null;
  deleted: boolean;
}

/** La historia a la que contesta un mensaje. */
export interface StoryReference {
  id: string;
  /** Nula si la historia ya caducó o se borró. */
  media: Media | null;
  text: string | null;
  expired: boolean;
}

export interface SystemEventInfo {
  action: SystemMessageAction;
  targets: UserSummary[];
  value: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  /** El que puso el cliente al enviarlo, para casarlo con la copia optimista. */
  clientId: string | null;
  kind: MessageKind;
  /** Nulo en los mensajes sólo con adjuntos y en los eliminados. */
  body: string | null;
  attachments: Media[];
  replyTo: MessageReference | null;
  sharedPost: Post | null;
  story: StoryReference | null;
  system: SystemEventInfo | null;
  sender: UserSummary;
  reactions: MessageReactionGroup[];
  /** En los mensajes propios, hasta dónde han llegado. Nulo en los ajenos. */
  status: MessageStatus | null;
  /** En los grupos, cuántos lo han leído ya. */
  readCount: number;
  editedAt: string | null;
  /** Cierto si su autor lo retiró; el hilo lo muestra como eliminado. */
  deleted: boolean;
  createdAt: string;
}

export interface ConversationMember {
  user: UserSummary;
  role: ConversationRole;
  /** Hasta dónde ha leído, para los avatares diminutos de «visto». */
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  /** Nombre del grupo; en las de dos, nulo. */
  title: string | null;
  photo: Media | null;
  /** La otra persona, en las conversaciones de dos. Nula en los grupos. */
  peer: UserSummary | null;
  /** Participantes activos, incluida quien consulta. */
  members: ConversationMember[];
  myRole: ConversationRole;
  lastMessageAt: string | null;
  /** Resumen del último mensaje, para la lista. */
  lastPreview: string | null;
  lastSenderId: string | null;
  unreadCount: number;
  muted: boolean;
  archived: boolean;
  pinned: boolean;
  /** Cierto si ya no se puede escribir: se salió del grupo o hay un bloqueo. */
  readOnly: boolean;
  createdAt: string;
}

export interface SendMessageRequest {
  /** Identificador generado por el cliente para que reintentar no duplique. */
  clientId?: string;
  body?: string;
  replyToId?: string;
  sharedPostId?: string;
  /** Duración de una nota de voz, en milisegundos, por si el servidor no puede medirla. */
  durationMs?: number;
}

export interface MessageListQuery {
  /** Devuelve los mensajes anteriores a este id, para el desplazamiento hacia arriba. */
  before?: string;
  /** Devuelve los mensajes posteriores a este id, para ponerse al día tras reconectar. */
  after?: string;
  limit?: number;
}

/**
 * Página de mensajes.
 *
 * No usa la paginación por número de página del resto de la API: un hilo crece
 * por arriba mientras se lee, y numerar páginas haría que los mensajes se
 * repitieran o se saltaran al llegar uno nuevo. Se pagina por cursor.
 */
export interface MessagePage {
  data: Message[];
  /** Id desde el que pedir el siguiente tramo, o `null` si ya no hay más. */
  nextCursor: string | null;
}

export interface CreateGroupRequest {
  title: string;
  memberIds: string[];
}

export interface ConversationListQuery {
  archived?: boolean;
  search?: string;
}

// --- Eventos en tiempo real --------------------------------------------------

export const ChatEventType = {
  MessageCreated: 'message_created',
  MessageUpdated: 'message_updated',
  MessageDeleted: 'message_deleted',
  ReactionsChanged: 'reactions_changed',
  Read: 'read',
  Delivered: 'delivered',
  Typing: 'typing',
  ConversationUpdated: 'conversation_updated',
  ConversationRemoved: 'conversation_removed',
} as const;
export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType];

/**
 * Un aviso del chat.
 *
 * Un solo tipo con campos opcionales en lugar de una unión: se lee igual desde
 * cualquier cliente de GraphQL y el `type` dice qué campos vienen rellenos.
 */
export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  message: Message | null;
  conversation: Conversation | null;
  /** Quién leyó, escribe o recibió. */
  userId: string | null;
  typing: boolean | null;
  /** Hasta dónde se leyó o se recibió. */
  at: string | null;
  lastReadMessageId: string | null;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
}
