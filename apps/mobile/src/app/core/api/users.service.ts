import { Injectable, inject } from '@angular/core';
import type {
  AddEmailsRequest,
  AddPhonesRequest,
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  Media,
  Paginated,
  PublicProfile,
  UpdateEmailRequest,
  UpdateLocationRequest,
  UpdatePermissionsRequest,
  UpdateProfileRequest,
  User,
  UserContact,
  UserEmail,
  UserListQuery,
  UserPermissions,
  UserPhone,
  UserRole,
  UserSummary,
} from '@respet/shared';

import { ApiClientService } from './api-client.service';
import {
  PAGE_META_FRAGMENTS,
  PERMISSIONS_FRAGMENTS,
  PUBLIC_PROFILE_FRAGMENTS,
  USER_CONTACT_FRAGMENTS,
  USER_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

export const ME = gql(`query Me { me { ...UserFields } }`, ...USER_FRAGMENTS);

const UPDATE_PROFILE = gql(
  `mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const REQUEST_EMAIL_CHANGE = `
mutation RequestEmailChange($input: UpdateEmailInput!) {
  requestEmailChange(input: $input)
}`;

const UPDATE_LANGUAGE = gql(
  `mutation UpdateLanguage($input: UpdateLanguageInput!) {
    updateLanguage(input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_LOCATION = gql(
  `mutation UpdateLocation($input: UpdateLocationInput!) {
    updateLocation(input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const MY_PERMISSIONS = gql(
  `query MyPermissions { myPermissions { ...PermissionsFields } }`,
  ...PERMISSIONS_FRAGMENTS,
);

const UPDATE_PERMISSIONS = gql(
  `mutation UpdatePermissions($input: UpdatePermissionsInput!) {
    updatePermissions(input: $input) { ...PermissionsFields }
  }`,
  ...PERMISSIONS_FRAGMENTS,
);

const MY_EMAILS = `query MyEmails { myEmails { id email } }`;

const ADD_EMAILS = `
mutation AddEmails($input: AddEmailsInput!) {
  addEmails(input: $input) { id email }
}`;

const REMOVE_EMAIL = `mutation RemoveEmail($id: ID!) { removeEmail(id: $id) }`;

const MY_PHONES = `query MyPhones { myPhones { id phone } }`;

const ADD_PHONES = `
mutation AddPhones($input: AddPhonesInput!) {
  addPhones(input: $input) { id phone }
}`;

const REMOVE_PHONE = `mutation RemovePhone($id: ID!) { removePhone(id: $id) }`;

const REMOVE_SOCIAL_LINK = `mutation RemoveSocialLink($id: ID!) { removeSocialLink(id: $id) }`;

const DELETE_MY_ACCOUNT = `mutation DeleteMyAccount { deleteMyAccount }`;

const USER_CONTACT = gql(
  `query UserContactById($id: ID!) {
    userContact(id: $id) { ...UserContactFields }
  }`,
  ...USER_CONTACT_FRAGMENTS,
);

const PUBLIC_PROFILE = gql(
  `query PublicProfileById($id: ID!) {
    publicProfile(id: $id) { ...PublicProfileFields }
  }`,
  ...PUBLIC_PROFILE_FRAGMENTS,
);

const FOLLOW_USER = `
mutation FollowUser($id: ID!) {
  followUser(id: $id) { followerCount followState }
}`;

const UNFOLLOW_USER = `
mutation UnfollowUser($id: ID!) {
  unfollowUser(id: $id) { followerCount followState }
}`;

const FOLLOW_REQUESTS = gql(
  `query MyFollowRequests($query: UserListQueryInput) {
    myFollowRequests(query: $query) {
      data { id createdAt requester { ...UserSummaryFields } }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const ACCEPT_FOLLOW_REQUEST = `
mutation AcceptFollowRequest($id: ID!) {
  acceptFollowRequest(id: $id) { followerCount }
}`;

const REJECT_FOLLOW_REQUEST = `
mutation RejectFollowRequest($id: ID!) {
  rejectFollowRequest(id: $id) { followerCount }
}`;

const FOLLOWERS = gql(
  `query Followers($id: ID!, $query: UserListQueryInput) {
    followers(id: $id, query: $query) {
      data { ...UserSummaryFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const FOLLOWING = gql(
  `query Following($id: ID!, $query: UserListQueryInput) {
    following(id: $id, query: $query) {
      data { ...UserSummaryFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_SUMMARY_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const USERS = gql(
  `query Users($query: UserListQueryInput) {
    users(query: $query) {
      data { ...UserFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...USER_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const USER = gql(
  `query UserById($id: ID!) {
    user(id: $id) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_USER_PROFILE = gql(
  `mutation UpdateUserProfile($id: ID!, $input: UpdateProfileInput!) {
    updateUserProfile(id: $id, input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const SET_USER_ROLE = gql(
  `mutation SetUserRole($id: ID!, $role: UserRole!) {
    setUserRole(id: $id, role: $role) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_USER_LOCATION = gql(
  `mutation UpdateUserLocation($id: ID!, $input: UpdateLocationInput!) {
    updateUserLocation(id: $id, input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const DELETE_USER = `mutation DeleteUser($id: ID!) { deleteUser(id: $id) }`;

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly gql = inject(GraphqlClientService);
  private readonly api = inject(ApiClientService);

  // --- Cuenta propia --------------------------------------------------------

  async me(): Promise<User> {
    const { me } = await this.gql.request<{ me: User }>(ME);

    return me;
  }

  async updateProfile(request: UpdateProfileRequest): Promise<User> {
    const { updateProfile } = await this.gql.request<{ updateProfile: User }>(UPDATE_PROFILE, {
      input: request,
    });

    return updateProfile;
  }

  /** El cambio no surte efecto hasta abrir el enlace enviado al correo nuevo. */
  async requestEmailChange(request: UpdateEmailRequest): Promise<void> {
    await this.gql.request(REQUEST_EMAIL_CHANGE, { input: request });
  }

  async updateLanguage(lang: string): Promise<User> {
    const { updateLanguage } = await this.gql.request<{ updateLanguage: User }>(UPDATE_LANGUAGE, {
      input: { lang },
    });

    return updateLanguage;
  }

  async updateLocation(request: UpdateLocationRequest): Promise<User> {
    const { updateLocation } = await this.gql.request<{ updateLocation: User }>(UPDATE_LOCATION, {
      input: request,
    });

    return updateLocation;
  }

  updateAvatar(file: Blob, filename?: string): Promise<Media> {
    return this.api.upload<Media>('/users/me/avatar', file, filename, 'PUT');
  }

  async permissions(): Promise<UserPermissions> {
    const { myPermissions } = await this.gql.request<{ myPermissions: UserPermissions }>(
      MY_PERMISSIONS,
    );

    return myPermissions;
  }

  async updatePermissions(request: UpdatePermissionsRequest): Promise<UserPermissions> {
    const { updatePermissions } = await this.gql.request<{ updatePermissions: UserPermissions }>(
      UPDATE_PERMISSIONS,
      { input: request },
    );

    return updatePermissions;
  }

  async emails(): Promise<UserEmail[]> {
    const { myEmails } = await this.gql.request<{ myEmails: UserEmail[] }>(MY_EMAILS);

    return myEmails;
  }

  async addEmails(request: AddEmailsRequest): Promise<UserEmail[]> {
    const { addEmails } = await this.gql.request<{ addEmails: UserEmail[] }>(ADD_EMAILS, {
      input: request,
    });

    return addEmails;
  }

  async removeEmail(id: string): Promise<void> {
    await this.gql.request(REMOVE_EMAIL, { id });
  }

  async phones(): Promise<UserPhone[]> {
    const { myPhones } = await this.gql.request<{ myPhones: UserPhone[] }>(MY_PHONES);

    return myPhones;
  }

  async addPhones(request: AddPhonesRequest): Promise<UserPhone[]> {
    const { addPhones } = await this.gql.request<{ addPhones: UserPhone[] }>(ADD_PHONES, {
      input: request,
    });

    return addPhones;
  }

  async removePhone(id: string): Promise<void> {
    await this.gql.request(REMOVE_PHONE, { id });
  }

  async unlinkSocialAccount(id: string): Promise<void> {
    await this.gql.request(REMOVE_SOCIAL_LINK, { id });
  }

  async deleteMyAccount(): Promise<void> {
    await this.gql.request(DELETE_MY_ACCOUNT);
  }

  // --- Consulta pública -----------------------------------------------------

  /** Datos de contacto, ya filtrados por el servidor según su privacidad. */
  async contact(userId: string): Promise<UserContact> {
    const { userContact } = await this.gql.request<{ userContact: UserContact }>(USER_CONTACT, {
      id: userId,
    });

    return userContact;
  }

  /**
   * Ficha pública de una persona.
   *
   * `findById` es la ficha completa y sólo la sirve el servidor a la
   * administración; ésta la puede ver cualquiera, con o sin cuenta.
   */
  async profile(userId: string): Promise<PublicProfile> {
    const { publicProfile } = await this.gql.request<{ publicProfile: PublicProfile }>(
      PUBLIC_PROFILE,
      { id: userId },
    );

    return publicProfile;
  }

  async follow(userId: string): Promise<FollowResult> {
    const { followUser } = await this.gql.request<{ followUser: FollowResult }>(FOLLOW_USER, {
      id: userId,
    });

    return followUser;
  }

  async unfollow(userId: string): Promise<FollowResult> {
    const { unfollowUser } = await this.gql.request<{ unfollowUser: FollowResult }>(UNFOLLOW_USER, {
      id: userId,
    });

    return unfollowUser;
  }

  /** Solicitudes que quedan por responder, de la más reciente a la más antigua. */
  async followRequests(
    query: { page?: number; perPage?: number } = {},
  ): Promise<Paginated<FollowRequest>> {
    const { myFollowRequests } = await this.gql.request<{
      myFollowRequests: Paginated<FollowRequest>;
    }>(FOLLOW_REQUESTS, { query });

    return myFollowRequests;
  }

  async acceptFollowRequest(id: string): Promise<FollowRequestResult> {
    const { acceptFollowRequest } = await this.gql.request<{
      acceptFollowRequest: FollowRequestResult;
    }>(ACCEPT_FOLLOW_REQUEST, { id });

    return acceptFollowRequest;
  }

  async rejectFollowRequest(id: string): Promise<FollowRequestResult> {
    const { rejectFollowRequest } = await this.gql.request<{
      rejectFollowRequest: FollowRequestResult;
    }>(REJECT_FOLLOW_REQUEST, { id });

    return rejectFollowRequest;
  }

  async followers(
    userId: string,
    query: { page?: number; perPage?: number } = {},
  ): Promise<Paginated<UserSummary>> {
    const { followers } = await this.gql.request<{ followers: Paginated<UserSummary> }>(FOLLOWERS, {
      id: userId,
      query,
    });

    return followers;
  }

  async following(
    userId: string,
    query: { page?: number; perPage?: number } = {},
  ): Promise<Paginated<UserSummary>> {
    const { following } = await this.gql.request<{ following: Paginated<UserSummary> }>(FOLLOWING, {
      id: userId,
      query,
    });

    return following;
  }

  // --- Administración -------------------------------------------------------

  async list(query: UserListQuery = {}): Promise<Paginated<User>> {
    const { users } = await this.gql.request<{ users: Paginated<User> }>(USERS, { query });

    return users;
  }

  async findById(id: string): Promise<User> {
    const { user } = await this.gql.request<{ user: User }>(USER, { id });

    return user;
  }

  async updateProfileById(id: string, request: UpdateProfileRequest): Promise<User> {
    const { updateUserProfile } = await this.gql.request<{ updateUserProfile: User }>(
      UPDATE_USER_PROFILE,
      { id, input: request },
    );

    return updateUserProfile;
  }

  async setRole(id: string, role: UserRole): Promise<User> {
    const { setUserRole } = await this.gql.request<{ setUserRole: User }>(SET_USER_ROLE, {
      id,
      role,
    });

    return setUserRole;
  }

  async updateLocationById(id: string, request: UpdateLocationRequest): Promise<User> {
    const { updateUserLocation } = await this.gql.request<{ updateUserLocation: User }>(
      UPDATE_USER_LOCATION,
      { id, input: request },
    );

    return updateUserLocation;
  }

  updateAvatarById(id: string, file: Blob, filename?: string): Promise<Media> {
    return this.api.upload<Media>(`/users/${id}/avatar`, file, filename, 'PUT');
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_USER, { id });
  }
}
