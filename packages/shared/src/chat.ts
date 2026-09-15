import type { Media, UserSummary } from './models.js';

export const MessageKind = {
  Text: 'text',
  Image: 'image',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export interface Message {
  id: string;
  conversationId: string;
  kind: MessageKind;
  /** Nulo en los mensajes de imagen y en los eliminados. */
  body: string | null;
  media: Media | null;
  sender: UserSummary;
  /** Cierto si su autor lo retiró; el hilo lo muestra como eliminado. */
  deleted: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  /** La otra persona. Con conversaciones de dos siempre hay exactamente una. */
  peer: UserSummary;
  lastMessageAt: string | null;
  /** Resumen del último mensaje, para la lista. */
  lastPreview: string | null;
  unreadCount: number;
  muted: boolean;
}

export interface SendMessageRequest {
  /** Texto del mensaje. Se omite cuando se envía una imagen. */
  body?: string;
}

export interface MessageListQuery {
  /** Devuelve los mensajes anteriores a este id, para el desplazamiento hacia arriba. */
  before?: string;
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

// --- Eventos en tiempo real --------------------------------------------------

/** Nombres de los eventos que el cliente envía al servidor. */
export const ChatClientEvent = {
  Join: 'chat:join',
  Leave: 'chat:leave',
  Typing: 'chat:typing',
} as const;

/** Nombres de los eventos que el servidor emite al cliente. */
export const ChatServerEvent = {
  MessageCreated: 'chat:message',
  MessageDeleted: 'chat:message-deleted',
  Read: 'chat:read',
  Typing: 'chat:typing',
  Presence: 'chat:presence',
  ConversationUpdated: 'chat:conversation',
} as const;

export interface TypingPayload {
  conversationId: string;
  userId: string;
  typing: boolean;
}

export interface ReadPayload {
  conversationId: string;
  userId: string;
  readAt: string;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
}
