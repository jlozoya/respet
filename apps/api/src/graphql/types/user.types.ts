import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  AuthSession,
  AuthTokens,
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  PublicProfile,
  SocialLink,
  User,
  UserContact,
  UserEmail,
  UserPermissions,
  UserPhone,
  UserSummary,
} from '@respet/shared';

import { AuthProvider, FollowState, Gender, MessagePolicy, UserRole } from '../enums.js';
import { LocationType, MediaType, Paginated } from './common.types.js';

@ObjectType('SocialLink', { description: 'Cuenta externa enlazada a la del usuario.' })
export class SocialLinkType implements SocialLink {
  @Field(() => ID)
  id!: string;

  @Field(() => AuthProvider)
  provider!: AuthProvider;

  @Field()
  externalId!: string;
}

@ObjectType('UserPermissions', { description: 'Qué enseña cada persona y quién puede acercarse.' })
export class UserPermissionsType implements UserPermissions {
  @Field()
  showMainEmail!: boolean;

  @Field()
  showAlternativeEmails!: boolean;

  @Field()
  showMainPhone!: boolean;

  @Field()
  showAlternativePhones!: boolean;

  @Field()
  showLocation!: boolean;

  @Field()
  receiveMailAds!: boolean;

  @Field(() => MessagePolicy, { description: 'Quién puede escribir por primera vez.' })
  messagePolicy!: MessagePolicy;

  @Field({ description: 'Con el perfil privado, seguir pasa por solicitud.' })
  privateProfile!: boolean;
}

@ObjectType('UserEmail')
export class UserEmailType implements UserEmail {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;
}

@ObjectType('UserPhone')
export class UserPhoneType implements UserPhone {
  @Field(() => ID)
  id!: string;

  @Field()
  phone!: string;
}

@ObjectType('UserSummary', { description: 'El autor de algo: lo justo para pintar una firma.' })
export class UserSummaryType implements UserSummary {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field(() => MediaType, { nullable: true })
  avatar!: MediaType | null;
}

@ObjectType('User', { description: 'Ficha completa. Nunca incluye credenciales.' })
export class UserType implements User {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field(() => Gender, { nullable: true })
  gender!: Gender | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  birthday!: string | null;

  @Field()
  lang!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => AuthProvider)
  provider!: AuthProvider;

  @Field()
  emailVerified!: boolean;

  @Field(() => MediaType, { nullable: true })
  avatar!: MediaType | null;

  @Field(() => LocationType, { nullable: true })
  location!: LocationType | null;

  @Field(() => UserPermissionsType, { nullable: true })
  permissions!: UserPermissionsType | null;

  @Field(() => [SocialLinkType])
  socialLinks!: SocialLinkType[];

  @Field(() => Int)
  followerCount!: number;

  @Field(() => Int)
  followingCount!: number;

  @Field(() => FollowState, {
    nullable: true,
    description: 'Nulo para quien no ha iniciado sesión, y también en la propia ficha.',
  })
  followState!: FollowState | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('UserContact', {
  description: 'Datos de contacto ya filtrados según lo que su dueño enseña.',
})
export class UserContactType implements UserContact {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => [UserEmailType])
  emails!: UserEmailType[];

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => [UserPhoneType])
  phones!: UserPhoneType[];

  @Field(() => LocationType, { nullable: true })
  location!: LocationType | null;
}

@ObjectType('PublicProfile', { description: 'Lo que puede ver cualquiera, con o sin cuenta.' })
export class PublicProfileType implements PublicProfile {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field(() => MediaType, { nullable: true })
  avatar!: MediaType | null;

  @Field(() => Int)
  postCount!: number;

  @Field(() => Int)
  followerCount!: number;

  @Field(() => Int)
  followingCount!: number;

  @Field(() => FollowState, { nullable: true })
  followState!: FollowState | null;

  @Field()
  createdAt!: string;
}

@ObjectType('FollowResult', { description: 'Cómo queda el seguimiento tras cambiarlo.' })
export class FollowResultType implements FollowResult {
  @Field(() => Int)
  followerCount!: number;

  @Field(() => FollowState)
  followState!: FollowState;
}

@ObjectType('FollowRequest', { description: 'Solicitud de seguimiento sin responder.' })
export class FollowRequestType implements FollowRequest {
  @Field(() => ID)
  id!: string;

  @Field(() => UserSummaryType, { description: 'Quien pide seguir.' })
  requester!: UserSummaryType;

  @Field()
  createdAt!: string;
}

@ObjectType('AuthTokens', { description: 'Par de tokens emitido al autenticarse.' })
export class AuthTokensType implements AuthTokens {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field()
  tokenType!: 'Bearer';

  @Field(() => Int, { description: 'Vida del `accessToken`, en segundos.' })
  expiresIn!: number;
}

@ObjectType('AuthSession', { description: 'Los tokens y la persona a la que pertenecen.' })
export class AuthSessionType extends AuthTokensType implements AuthSession {
  @Field(() => UserType)
  user!: UserType;
}

export const UserPage = Paginated(UserType, 'User');
export const UserSummaryPage = Paginated(UserSummaryType, 'UserSummary');
export const FollowRequestPage = Paginated(FollowRequestType, 'FollowRequest');

@ObjectType('FollowRequestResult', { description: 'Seguidores tras responder una solicitud.' })
export class FollowRequestResultType implements FollowRequestResult {
  @Field(() => Int)
  followerCount!: number;
}
