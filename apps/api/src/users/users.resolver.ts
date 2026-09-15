import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  FollowResult,
  Paginated,
  PublicProfile,
  User,
  UserContact,
  UserEmail,
  UserPermissions,
  UserPhone,
  UserSummary,
} from '@respet/shared';

import {
  CurrentUser,
  OptionalUser,
  Public,
  Roles,
  type AuthenticatedUser,
} from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { UserRole } from '../graphql/enums.js';
import {
  FollowResultType,
  PublicProfileType,
  UserContactType,
  UserEmailType,
  UserPage,
  UserPermissionsType,
  UserPhoneType,
  UserSummaryPage,
  UserType,
} from '../graphql/types/user.types.js';
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
 * La cuenta propia, las fichas públicas y la administración de usuarios.
 *
 * Con REST había que declarar cada operación dos veces —una bajo `/users/me` y
 * otra bajo `/users/:id` para la administración—, y el orden importaba para
 * que «me» no entrara por el parámetro. Aquí cada cosa tiene su nombre:
 * `updateProfile` es la propia y `updateUserProfile` la ajena.
 *
 * El perfil de quien consulta se pide con `me`, que vive en `AuthResolver`: es
 * la misma respuesta, y tenerla en dos sitios sólo daba ocasión de que una se
 * quedara atrás.
 */
@Resolver(() => UserType)
export class UsersResolver {
  constructor(private readonly users: UsersService) {}

  // --- Cuenta propia --------------------------------------------------------

  @Query(() => UserPermissionsType, {
    name: 'myPermissions',
    description: 'Preferencias de privacidad.',
  })
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
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateProfileDto,
  ): Promise<User> {
    return this.users.updateProfile(userId, input);
  }

  @Mutation(() => Boolean, {
    description: 'Pide un cambio de correo; se aplica al abrir el enlace enviado al nuevo.',
  })
  async requestEmailChange(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateEmailDto,
  ): Promise<boolean> {
    await this.users.requestEmailChange(userId, input);

    return true;
  }

  @Mutation(() => UserType)
  async updateLanguage(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateLanguageDto,
  ): Promise<User> {
    return this.users.updateLanguage(userId, input.lang);
  }

  @Mutation(() => UserType)
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Args('input') input: UpdateLocationDto,
  ): Promise<User> {
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
  async addEmails(
    @CurrentUser('id') userId: string,
    @Args('input') input: AddEmailsDto,
  ): Promise<UserEmail[]> {
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
  async addPhones(
    @CurrentUser('id') userId: string,
    @Args('input') input: AddPhonesDto,
  ): Promise<UserPhone[]> {
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

  @Mutation(() => Boolean, { description: 'Borra la cuenta propia y todo su contenido.' })
  async deleteMyAccount(@CurrentUser('id') userId: string): Promise<boolean> {
    await this.users.remove(userId);

    return true;
  }

  // --- Consulta pública -----------------------------------------------------

  @Public()
  @Query(() => PublicProfileType, {
    name: 'publicProfile',
    description: 'Ficha pública. Con sesión indica además si ya la sigues.',
  })
  async publicProfile(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PublicProfile> {
    return this.users.publicProfile(id, viewer?.id ?? null);
  }

  @Public()
  @Query(() => UserContactType, {
    name: 'userContact',
    description: 'Sólo devuelve los campos que su dueño ha decidido mostrar.',
  })
  async contact(@Args('id', { type: () => ID }, ParseObjectIdPipe) id: string): Promise<UserContact> {
    return this.users.getContact(id);
  }

  @Public()
  @Query(() => UserSummaryPage, { name: 'followers' })
  async followers(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('query', { type: () => UserListQueryDto, nullable: true })
    query: UserListQueryDto = {},
  ): Promise<Paginated<UserSummary>> {
    return this.users.followers(id, query);
  }

  @Public()
  @Query(() => UserSummaryPage, { name: 'following' })
  async following(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('query', { type: () => UserListQueryDto, nullable: true })
    query: UserListQueryDto = {},
  ): Promise<Paginated<UserSummary>> {
    return this.users.following(id, query);
  }

  @Mutation(() => FollowResultType)
  async followUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowResult> {
    return this.users.follow(userId, id);
  }

  @Mutation(() => FollowResultType)
  async unfollowUser(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FollowResult> {
    return this.users.unfollow(userId, id);
  }

  // --- Administración -------------------------------------------------------

  @Roles('admin')
  @Query(() => UserPage, { name: 'users' })
  async list(
    @Args('query', { type: () => UserListQueryDto, nullable: true })
    query: UserListQueryDto = {},
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
  @Mutation(() => UserType)
  async setUserRole(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('role', { type: () => UserRole }) role: UserRole,
    @CurrentUser('id') actingUserId: string,
  ): Promise<User> {
    return this.users.setRole(id, role, actingUserId);
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
