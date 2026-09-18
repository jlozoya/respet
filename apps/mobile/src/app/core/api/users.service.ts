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
  ReauthRequest,
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
} from '@social-network/shared';

import {
  MEDIA_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  PERMISSIONS_FRAGMENTS,
  PUBLIC_PROFILE_FRAGMENTS,
  USER_CONTACT_FRAGMENTS,
  USER_FRAGMENTS,
  USER_SUMMARY_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const UPDATE_PROFILE = gql(
  `mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_MY_AVATAR = gql(
  `mutation UpdateMyAvatar($file: Upload!) { updateMyAvatar(file: $file) { ...MediaFields } }`,
  ...MEDIA_FRAGMENTS,
);

const UPDATE_MY_COVER = gql(
  `mutation UpdateMyCover($file: Upload!) { updateMyCover(file: $file) { ...MediaFields } }`,
  ...MEDIA_FRAGMENTS,
);

const REMOVE_MY_AVATAR = `mutation RemoveMyAvatar { removeMyAvatar }`;
const REMOVE_MY_COVER = `mutation RemoveMyCover { removeMyCover }`;

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
const ADD_EMAILS = `mutation AddEmails($input: AddEmailsInput!) { addEmails(input: $input) { id email } }`;
const REMOVE_EMAIL = `mutation RemoveEmail($id: ID!) { removeEmail(id: $id) }`;
const MY_PHONES = `query MyPhones { myPhones { id phone } }`;
const ADD_PHONES = `mutation AddPhones($input: AddPhonesInput!) { addPhones(input: $input) { id phone } }`;
const REMOVE_PHONE = `mutation RemovePhone($id: ID!) { removePhone(id: $id) }`;
const REMOVE_SOCIAL_LINK = `mutation RemoveSocialLink($id: ID!) { removeSocialLink(id: $id) }`;

const DELETE_MY_ACCOUNT = `
mutation DeleteMyAccount($reauth: ReauthInput!) {
  deleteMyAccount(reauth: $reauth)
}`;

const USER_CONTACT = gql(
  `query UserContactById($id: ID!) { userContact(id: $id) { ...UserContactFields } }`,
  ...USER_CONTACT_FRAGMENTS,
);

const PUBLIC_PROFILE = gql(
  `query PublicProfileById($id: ID!) { publicProfile(id: $id) { ...PublicProfileFields } }`,
  ...PUBLIC_PROFILE_FRAGMENTS,
);

const PROFILE_BY_NAME = gql(
  `query ProfileByName($name: String!) { profileByName(name: $name) { ...PublicProfileFields } }`,
  ...PUBLIC_PROFILE_FRAGMENTS,
);

const FOLLOW_USER = `mutation FollowUser($id: ID!) { followUser(id: $id) { followerCount followState } }`;
const UNFOLLOW_USER = `mutation UnfollowUser($id: ID!) { unfollowUser(id: $id) { followerCount followState } }`;
const REMOVE_FOLLOWER = `mutation RemoveFollower($id: ID!) { removeFollower(id: $id) { followerCount } }`;

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
mutation AcceptFollowRequest($id: ID!) { acceptFollowRequest(id: $id) { followerCount } }`;

const REJECT_FOLLOW_REQUEST = `
mutation RejectFollowRequest($id: ID!) { rejectFollowRequest(id: $id) { followerCount } }`;

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

const USER = gql(`query UserById($id: ID!) { user(id: $id) { ...UserFields } }`, ...USER_FRAGMENTS);

const UPDATE_USER_PROFILE = gql(
  `mutation UpdateUserProfile($id: ID!, $input: UpdateProfileInput!) {
    updateUserProfile(id: $id, input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const SET_USER_ROLE = gql(
  `mutation SetUserRole($id: ID!, $role: UserRole!) { setUserRole(id: $id, role: $role) { ...UserFields } }`,
  ...USER_FRAGMENTS,
);

const SET_USER_VERIFIED = gql(
  `mutation SetUserVerified($id: ID!, $verified: Boolean!) {
    setUserVerified(id: $id, verified: $verified) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_USER_LOCATION = gql(
  `mutation UpdateUserLocation($id: ID!, $input: UpdateLocationInput!) {
    updateUserLocation(id: $id, input: $input) { ...UserFields }
  }`,
  ...USER_FRAGMENTS,
);

const UPDATE_USER_AVATAR = gql(
  `mutation UpdateUserAvatar($id: ID!, $file: Upload!) {
    updateUserAvatar(id: $id, file: $file) { ...MediaFields }
  }`,
  ...MEDIA_FRAGMENTS,
);

const DELETE_USER = `mutation DeleteUser($id: ID!) { deleteUser(id: $id) }`;

/** Un id de MongoDB: veinticuatro cifras hexadecimales. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Personas: la cuenta propia, los perfiles ajenos y el seguimiento.
 *
 * Las fotos de perfil y de portada viajan dentro de la propia mutación, como
 * cualquier otro archivo desde que toda la API es GraphQL.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly gql = inject(GraphqlClientService);

  // --- La cuenta propia -----------------------------------------------------

  updateProfile(request: UpdateProfileRequest): Promise<User> {
    return this.gql.field(UPDATE_PROFILE, { input: request });
  }

  updateAvatar(file: Blob): Promise<Media> {
    return this.gql.field(UPDATE_MY_AVATAR, { file });
  }

  updateCover(file: Blob): Promise<Media> {
    return this.gql.field(UPDATE_MY_COVER, { file });
  }

  async removeAvatar(): Promise<void> {
    await this.gql.request(REMOVE_MY_AVATAR);
  }

  async removeCover(): Promise<void> {
    await this.gql.request(REMOVE_MY_COVER);
  }

  /** Pide el cambio; se aplica al abrir el enlace que llega a la dirección nueva. */
  async requestEmailChange(request: UpdateEmailRequest): Promise<void> {
    await this.gql.request(REQUEST_EMAIL_CHANGE, { input: request });
  }

  updateLanguage(lang: string): Promise<User> {
    return this.gql.field(UPDATE_LANGUAGE, { input: { lang } });
  }

  updateLocation(request: UpdateLocationRequest): Promise<User> {
    return this.gql.field(UPDATE_LOCATION, { input: request });
  }

  permissions(): Promise<UserPermissions> {
    return this.gql.field(MY_PERMISSIONS);
  }

  updatePermissions(request: UpdatePermissionsRequest): Promise<UserPermissions> {
    return this.gql.field(UPDATE_PERMISSIONS, { input: request });
  }

  emails(): Promise<UserEmail[]> {
    return this.gql.field(MY_EMAILS);
  }

  addEmails(request: AddEmailsRequest): Promise<UserEmail[]> {
    return this.gql.field(ADD_EMAILS, { input: request });
  }

  async removeEmail(id: string): Promise<void> {
    await this.gql.request(REMOVE_EMAIL, { id });
  }

  phones(): Promise<UserPhone[]> {
    return this.gql.field(MY_PHONES);
  }

  addPhones(request: AddPhonesRequest): Promise<UserPhone[]> {
    return this.gql.field(ADD_PHONES, { input: request });
  }

  async removePhone(id: string): Promise<void> {
    await this.gql.request(REMOVE_PHONE, { id });
  }

  async unlinkSocialAccount(id: string): Promise<void> {
    await this.gql.request(REMOVE_SOCIAL_LINK, { id });
  }

  /** Borra la cuenta. Pide confirmar la identidad. */
  async deleteMyAccount(reauth: ReauthRequest): Promise<void> {
    await this.gql.request(DELETE_MY_ACCOUNT, { reauth });
  }

  // --- Perfiles ajenos ------------------------------------------------------

  contact(userId: string): Promise<UserContact> {
    return this.gql.field(USER_CONTACT, { id: userId });
  }

  /**
   * La ficha de una persona, por id o por nombre de usuario.
   *
   * La dirección del perfil lleva el nombre —`/profile/ana`—, pero los enlaces
   * antiguos y los avisos llevan el id; los dos caminos acaban aquí.
   */
  profile(handle: string): Promise<PublicProfile> {
    return OBJECT_ID.test(handle)
      ? this.gql.field(PUBLIC_PROFILE, { id: handle })
      : this.gql.field(PROFILE_BY_NAME, { name: handle });
  }

  follow(userId: string): Promise<FollowResult> {
    return this.gql.field(FOLLOW_USER, { id: userId });
  }

  unfollow(userId: string): Promise<FollowResult> {
    return this.gql.field(UNFOLLOW_USER, { id: userId });
  }

  removeFollower(userId: string): Promise<FollowRequestResult> {
    return this.gql.field(REMOVE_FOLLOWER, { id: userId });
  }

  followRequests(query: UserListQuery = {}): Promise<Paginated<FollowRequest>> {
    return this.gql.field(FOLLOW_REQUESTS, { query });
  }

  acceptFollowRequest(id: string): Promise<FollowRequestResult> {
    return this.gql.field(ACCEPT_FOLLOW_REQUEST, { id });
  }

  rejectFollowRequest(id: string): Promise<FollowRequestResult> {
    return this.gql.field(REJECT_FOLLOW_REQUEST, { id });
  }

  followers(userId: string, query: UserListQuery = {}): Promise<Paginated<UserSummary>> {
    return this.gql.field(FOLLOWERS, { id: userId, query });
  }

  following(userId: string, query: UserListQuery = {}): Promise<Paginated<UserSummary>> {
    return this.gql.field(FOLLOWING, { id: userId, query });
  }

  // --- Administración -------------------------------------------------------

  list(query: UserListQuery = {}): Promise<Paginated<User>> {
    return this.gql.field(USERS, { query });
  }

  findById(id: string): Promise<User> {
    return this.gql.field(USER, { id });
  }

  updateProfileById(id: string, request: UpdateProfileRequest): Promise<User> {
    return this.gql.field(UPDATE_USER_PROFILE, { id, input: request });
  }

  setRole(id: string, role: UserRole): Promise<User> {
    return this.gql.field(SET_USER_ROLE, { id, role });
  }

  setVerified(id: string, verified: boolean): Promise<User> {
    return this.gql.field(SET_USER_VERIFIED, { id, verified });
  }

  updateLocationById(id: string, request: UpdateLocationRequest): Promise<User> {
    return this.gql.field(UPDATE_USER_LOCATION, { id, input: request });
  }

  updateAvatarById(id: string, file: Blob): Promise<Media> {
    return this.gql.field(UPDATE_USER_AVATAR, { id, file });
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_USER, { id });
  }
}
