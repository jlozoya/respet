import type { Audience, PostKind, ReactionType, ReportTarget } from '../enums.js';

export interface CreatePostRequest {
  description?: string;
  kind?: PostKind;
  audience?: Audience;
  location?: {
    country?: string | null;
    state?: string | null;
    city?: string | null;
    route?: string | null;
    streetNumber?: string | null;
    postalCode?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  /** 0 = ubicación exacta; valores mayores difuminan el punto en el mapa. */
  locationAccuracy?: number;
  /** La publicación que se comparte. */
  sharedPostId?: string;
  commentsDisabled?: boolean;
}

export type UpdatePostRequest = Partial<Omit<CreatePostRequest, 'sharedPostId'>>;

export interface PostListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  kind?: PostKind;
  userId?: string;
  hashtag?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /**
   * `following` limita el muro a quienes sigue quien consulta; `discover`
   * lo abre a todo el mundo, y `home` —el de portada— mezcla lo de quienes
   * sigue con lo más destacado del resto cuando se acaba lo primero.
   */
  feed?: PostFeed;
  /** Sólo publicaciones con fotos o vídeos: la cuadrícula del perfil y de explorar. */
  withMediaOnly?: boolean;
}

export const PostFeed = {
  Home: 'home',
  Discover: 'discover',
  Following: 'following',
} as const;
export type PostFeed = (typeof PostFeed)[keyof typeof PostFeed];

/**
 * Reacciones de una publicación después de cambiar la propia.
 *
 * El servidor devuelve las cuentas ya hechas: si cada cliente sumara uno por su
 * cuenta, dos sesiones abiertas acabarían enseñando cifras distintas.
 */
export interface ReactionResult {
  reactionCount: number;
  reactionSummary: { type: ReactionType; count: number }[];
  myReaction: ReactionType | null;
}

export interface CreateCommentRequest {
  body: string;
  /** El comentario al que se responde. */
  parentId?: string;
}

export interface UpdateCommentRequest {
  body: string;
}

export interface CommentListQuery {
  page?: number;
  perPage?: number;
  /** Las respuestas de este comentario, en lugar de los de primer nivel. */
  parentId?: string;
}

export interface CommentLikeResult {
  likeCount: number;
  likedByMe: boolean;
}

/** Denuncia de cualquier cosa denunciable. */
export interface CreateReportRequest {
  targetType: ReportTarget;
  targetId: string;
  reason: string;
}

/** Denuncia de una publicación. */
export interface ReportPostRequest {
  reason: string;
}

export interface CreateBulletinRequest {
  title: string;
  description: string;
  date: string;
}

export type UpdateBulletinRequest = Partial<CreateBulletinRequest>;

export interface CreateSupportRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
  lang?: string;
}

export interface AnalyticsQuery {
  /** Agrupación temporal del histórico de altas. */
  interval?: 'day' | 'week' | 'month' | 'year';
  from?: string;
  to?: string;
}
