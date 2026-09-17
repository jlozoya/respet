import type { FollowState, Gender, MessagePolicy, UserRole } from '../enums.js';
import type { Location, UserSummary } from '../models.js';

export type LocationInput = Partial<Omit<Location, 'id'>>;

export interface UpdateProfileRequest {
  name?: string;
  firstName?: string;
  lastName?: string;
  gender?: Gender | null;
  phone?: string | null;
  birthday?: string | null;
  bio?: string | null;
  website?: string | null;
}

export interface UpdateEmailRequest {
  email: string;
  /** Obligatoria para cuentas con contraseña; se omite en cuentas sociales. */
  password?: string;
}

export interface UpdateLanguageRequest {
  lang: string;
}

export interface UpdateLocationRequest {
  location: LocationInput | null;
}

export interface UpdatePermissionsRequest {
  showMainEmail?: boolean;
  showAlternativeEmails?: boolean;
  showMainPhone?: boolean;
  showAlternativePhones?: boolean;
  showLocation?: boolean;
  receiveMailAds?: boolean;
  messagePolicy?: MessagePolicy;
  privateProfile?: boolean;
  showOnlineStatus?: boolean;
  storyReplyPolicy?: MessagePolicy;
  loginAlerts?: boolean;
}

export interface AddEmailsRequest {
  emails: string[];
}

export interface AddPhonesRequest {
  phones: string[];
}

/** Estado del seguimiento después de cambiarlo. */
export interface FollowResult {
  followerCount: number;
  followState: FollowState;
}

/**
 * Solicitud de seguimiento pendiente de respuesta.
 *
 * Sólo las ve quien tiene el perfil privado, que es el único que las recibe.
 */
export interface FollowRequest {
  id: string;
  requester: UserSummary;
  createdAt: string;
}

/** Cómo queda la cuenta de seguidores tras responder una solicitud. */
export interface FollowRequestResult {
  followerCount: number;
}

export interface UserListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  role?: UserRole;
}

/** Una persona que quizá conozcas, con el motivo. */
export interface UserSuggestion {
  user: UserSummary;
  /** Cuántas de las personas que sigues la siguen. */
  mutualCount: number;
  /** Algunos de esos seguidores en común, para «Seguido por Ana y 3 más». */
  mutuals: UserSummary[];
}

/** Alguien conectado de entre los que sigues, para la columna de contactos. */
export interface OnlineContact {
  user: UserSummary;
  online: boolean;
  lastSeenAt: string | null;
}
