import type { PostKind, VoteValue } from '../enums.js';

export interface CreatePostRequest {
  description: string;
  kind: PostKind;
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
}

export type UpdatePostRequest = Partial<CreatePostRequest>;

export interface PostListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  kind?: PostKind;
  userId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /**
   * `following` limita el muro a quienes sigue quien consulta; `discover`, el
   * valor por defecto, lo abre a todo el mundo.
   */
  feed?: PostFeed;
}

export const PostFeed = {
  Discover: 'discover',
  Following: 'following',
} as const;
export type PostFeed = (typeof PostFeed)[keyof typeof PostFeed];

/**
 * Recuento de votos de una publicación después de cambiar el propio.
 *
 * El servidor devuelve las cuentas ya hechas: si cada cliente sumara uno por su
 * cuenta, dos sesiones abiertas acabarían enseñando cifras distintas.
 */
export interface PostVoteResult {
  likeCount: number;
  dislikeCount: number;
  myVote: VoteValue | null;
}

export interface CreateCommentRequest {
  body: string;
}

export type UpdateCommentRequest = CreateCommentRequest;

export interface CommentListQuery {
  page?: number;
  perPage?: number;
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
