import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  Media,
  Paginated,
  User,
  UserContact,
  UserEmail,
  UserPermissions,
  UserPhone,
  UserSummary,
} from '@respet/shared';

import { ReauthDto } from '../auth/dto/auth.dto.js';
import { ReauthService } from '../auth/reauth.service.js';
import {
  Client,
  CurrentUser,
  OptionalUser,
  Public,
  RateLimit,
  Roles,
  Scopes,
  type AuthenticatedUser,
  type ClientInfo,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { UserRole } from '../graphql/enums.js';
import { MediaType } from '../graphql/types/common.types.js';
import {
  FollowRequestPage,
  FollowRequestResultType,
  FollowResultType,
  UserContactType,
  UserEmailType,
  UserPage,
  UserPermissionsType,
  UserPhoneType,
  UserSummaryPage,
  UserType,
} from '../graphql/types/user.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import {
  AddEmailsDto,
  AddPhonesDto,
  UpdateEmailDto,
  UpdateLanguageDto,
  UpdateLocationDto,
  UpdatePermissionsDto,
  UpdateProfileDto,
  UserListQueryDto,
} from './dto/user.dto.js';
import { UsersService } from './users.service.js';

/**
 * La cuenta propia, los seguimientos y la administración de usuarios.
 *
 * Cada cosa tiene su nombre: `updateProfile` es la propia y
 * `updateUserProfile` la ajena. El perfil de quien consulta se pide con `me`,
 * que vive en `AuthResolver`; las fichas públicas, con `publicProfile` y
 * `profileByName`, en `SocialResolver`.
 */
@Resolver(() => UserType)
export class UsersResolver {
  constructor(
    private readonly users: UsersService,
    private readonly reauth: ReauthService,
  ) {}

  // --- Cuenta propia --------------------------------------------------------

  @Query(() => UserPermissionsType, { name: 'myPermissions', description: 'Preferencias de privacidad.' })
  async myPermissions(@CurrentUser('id') userId: string): Promise<UserPermissions> {
    return this.users.getPermissions(userId);
  }

  @Query(() => [UserEmailType], { name: 'myEmails' })
  async myEmails(@CurrentUser('id') userId: string): Promise<UserEmail[]> {
    return this.users.listEmails(userId);
  }

  @Query(() => [UserPhoneType], { name: 'myPhones' })
  async myPhones(@CurrentUser('id') userId: string): Promise<UserPhone[]> {
    return this.users.listPhones(userId);
  }

  @Mutation(() => UserType)
  async updateProfile(@CurrentUser('id') userId: string, @Args('input') input: UpdateProfileDto): Promise<User> {
    return this.users.updateProfile(userId, input);
  }

  @RateLimit({ limit: 20, windowSeconds: 3600 })
  @Mutation(() => MediaType, { description: 'Cambia la foto de perfil. Se sube en la propia operación.' })
  async updateMyAvatar(
    @CurrentUser('id') userId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Media> {
    return this.users.updateImage(userId, 'avatar', file);
  }

  @RateLimit({ limit: 20, windowSeconds: 3600 })
  @Mutation(() => MediaType, { description: 'Cambia la foto de portada.' })
  async updateMyCover(
    @CurrentUser('id') userId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Media> {
    return this.users.updateImage(userId, 'cover', file);
  }

  @Mutation(() => Boolean)
  async removeMyAvatar(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.users.removeImage(userId, 'avatar');

    return true;
  }

  @Mutation(() => Boolean)
  async removeMyCover(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.users.removeImage(userId, 'cover');

    return true;
  }

  @RateLimit({ limit: 5, windowSeconds: 3600 })
  @Mutation(() => Boolean, {
    description: 'Pide un cambio de correo; se aplica al abrir el enlace enviado al nuevo.',
  })
  async requestEmailChange(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('input') input: UpdateEmailDto,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.reauth.assert(actor, { password: input.password }, client);
    await this.users.requestEmailChange(actor.id, input);

    return true;
  }

  @Mutation(() => UserType)
  async updateLanguage(@CurrentUser('id') userId: string, @Args('input') input: UpdateLanguageDto): Promise<User> {
    return this.users.updateLanguage(userId, input.lang);
  }

  @Mutation(() => UserType)
  async updateLocation(@CurrentUser('id') userId: string, @Args('input') input: UpdateLocationDto): Promise<User> {
    return this.users.updateLocation(userId, input);
  }

  @Mutation(() => UserPermissionsType)
  async updatePermissions(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdatePermissionsDto,
  ): Promise<UserPermissions> {
    return this.users.updatePermissions(userId, input);
  }

  @Mutation(() => [UserEmailType])
  async addEmails(@CurrentUser('id') userId: string, @Args('input') input: AddEmailsDto): Promise<UserEmail[]> {
    return this.users.addEmails(userId, input);
  }

  @Mutation(() => Boolean)
  async removeEmail(
    @CurrentUser('id') userId: string,
    @Args('id', { type: () => ID }, ParseObjectIdPipe) emailId: string,
  ): Promise<boolean> {
    await this.users.removeEmail(userId, emailId);

    return true;
  }

  @Mutation(() => [UserPhoneType])
  async addPhones(@CurrentUser('id') userId: string, @Args('input') input: AddPhonesDto): Promise<UserPhone[]> {
    return this.users.addPhones(userId, input);
  }

  @Mutation(() => Boolean)
  async removePhone(
    @CurrentUser('id') userId: string,
    @Args('id', { type: () => ID }, ParseObjectIdPipe) phoneId: string,
  ): Promise<boolean> {
    await this.users.removePhone(userId, phoneId);

    return true;
  }

  @Mutation(() => Boolean, { description: 'Desvincula una cuenta externa.' })
  async removeSocialLink(
    @CurrentUser('id') userId: string,
    @Args('id', { type: () => ID }, ParseObjectIdPipe) linkId: string,
  ): Promise<boolean> {
    await this.users.removeSocialLink(userId, linkId);

    return true;
  }

  @RateLimit({ limit: 3, windowSeconds: 3600 })
  @Mutation(() => Boolean, { description: 'Borra la cuenta propia y todo su contenido. Pide confirmar la identidad.' })
  async deleteMyAccount(
    @CurrentUser() actor: AuthenticatedUser,
    @Args('reauth') reauth: ReauthDto,
    @Client() client: ClientInfo,
  ): Promise<boolean> {
    await this.reauth.assert(actor, reauth, client);
    await this.users.remove(actor.id);

    return true;
  }

  // --- Contacto y seguimiento ------------------------------------------------

  @Public()
  @Query(() => UserContactType, {
    name: 'userContact',
    description: 'Sólo devuelve los campos que su dueño ha decidido mostrar.',
  })
  async contact(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<UserContact> {
    return this.users.getContact(id, viewer?.id ?? null);
  }

  @Public()
  @Scopes('user_follows')
  @Query(() => UserSummaryPage, { name: 'followers' })
  async followers(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => UserListQueryDto, nullable: true }) query: UserListQueryDto = {},
  ): Promise<Paginated<UserSummary>> {
    return this.users.followers(id, query, viewer?.id ?? null);
  }

  @Public()
  @Scopes('user_follows')
  @Query(() => UserSummaryPage, { name: 'following' })
  async following(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
    @Args('query', { type: () => UserListQueryDto, nullable: true }) query: UserListQueryDto = {},
  ): Promise<Paginated<UserSummary>> {
    return this.users.following(id, query, viewer?.id ?? null);
  }

  @Scopes('manage_follows')
  @RateLimit({ limit: 200, windowSeconds: 3600 })
  @Mutation(() => FollowResultType)
  async followUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowResult> {
    return this.users.follow(userId, id);
  }

  @Scopes('manage_follows')
  @Mutation(() => FollowResultType)
  async unfollowUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowResult> {
    return this.users.unfollow(userId, id);
  }

  @Mutation(() => FollowRequestResultType, { description: 'Quita a alguien de tus seguidores sin bloquearle.' })
  async removeFollower(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowRequestResult> {
    return this.users.removeFollower(userId, id);
  }

  @Query(() => FollowRequestPage, {
    name: 'myFollowRequests',
    description: 'Solicitudes de seguimiento que quedan por responder.',
  })
  async myFollowRequests(
    @CurrentUser('id') userId: string,
    @Args('query', { type: () => UserListQueryDto, nullable: true }) query: UserListQueryDto = {},
  ): Promise<Paginated<FollowRequest>> {
    return this.users.followRequests(userId, query);
  }

  @Mutation(() => FollowRequestResultType)
  async acceptFollowRequest(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowRequestResult> {
    return this.users.acceptFollowRequest(userId, id);
  }

  @Mutation(() => FollowRequestResultType)
  async rejectFollowRequest(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowRequestResult> {
    return this.users.rejectFollowRequest(userId, id);
  }

  // --- Administración -------------------------------------------------------

  @Roles('admin')
  @Query(() => UserPage, { name: 'users' })
  async list(
    @Args('query', { type: () => UserListQueryDto, nullable: true }) query: UserListQueryDto = {},
  ): Promise<Paginated<User>> {
    return this.users.list(query);
  }

  @Roles('admin')
  @Query(() => UserType, { name: 'user', description: 'Ficha completa de un usuario.' })
  async findOne(@Args('id', { type: () => ID }, ParseObjectIdPipe) id: string): Promise<User> {
    return this.users.findById(id);
  }

  @Roles('admin')
  @Mutation(() => UserType)
  async updateUserProfile(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateProfileDto,
  ): Promise<User> {
    return this.users.updateProfile(id, input);
  }

  @Roles('admin')
  @Mutation(() => MediaType)
  async updateUserAvatar(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Media> {
    return this.users.updateImage(id, 'avatar', file);
  }

  @Roles('admin')
  @Mutation(() => UserType)
  async setUserRole(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('role', { type: () => UserRole }) role: UserRole,
    @CurrentUser('id') actingUserId: string,
  ): Promise<User> {
    return this.users.setRole(id, role, actingUserId);
  }

  @Roles('admin')
  @Mutation(() => UserType, { description: 'Concede o retira la insignia de cuenta verificada.' })
  async setUserVerified(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('verified') verified: boolean,
  ): Promise<User> {
    return this.users.setVerified(id, verified);
  }

  @Roles('admin')
  @Mutation(() => UserType)
  async updateUserLocation(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateLocationDto,
  ): Promise<User> {
    return this.users.updateLocation(id, input);
  }

  @Roles('admin')
  @Mutation(() => Boolean)
  async deleteUser(@Args('id', { type: () => ID }, ParseObjectIdPipe) id: string): Promise<boolean> {
    await this.users.remove(id);

    return true;
  }
}
