import type { Gender, UserRole } from '../enums.js';
import type { Location, UserPermissions } from '../models.js';

export type LocationInput = Partial<Omit<Location, 'id'>>;

export interface UpdateProfileRequest {
  name?: string;
  firstName?: string;
  lastName?: string;
  gender?: Gender | null;
  phone?: string | null;
  birthday?: string | null;
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

export type UpdatePermissionsRequest = Partial<UserPermissions>;

export interface AddEmailsRequest {
  emails: string[];
}

export interface AddPhonesRequest {
  phones: string[];
}

/** Estado del seguimiento después de cambiarlo. */
export interface FollowResult {
  followerCount: number;
  followedByMe: boolean;
}

export interface UserListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  role?: UserRole;
}
