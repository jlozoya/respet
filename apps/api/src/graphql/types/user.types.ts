import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  BlockedUser,
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  OnlineContact,
  PublicProfile,
  SocialLink,
  User,
  UserContact,
  UserEmail,
  UserPermissions,
  UserPhone,
  UserSuggestion,
  UserSummary,
} from '@social-network/shared';

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

  @Field({
    description:
      'Con el perfil privado, seguir pasa por solicitud y lo publicado es para los seguidores.',
  })
  privateProfile!: boolean;

  @Field({ description: 'Si los demás ven cuándo está conectada.' })
  showOnlineStatus!: boolean;

  @Field(() => MessagePolicy, { description: 'Quién puede contestar a sus historias.' })
  storyReplyPolicy!: MessagePolicy;

  @Field({ description: 'Correo de aviso al entrar desde un dispositivo nuevo.' })
  loginAlerts!: boolean;
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

  @Field({ description: 'Nombre de usuario.' })
  name!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field(() => MediaType, { nullable: true })
  avatar!: MediaType | null;

  @Field({ description: 'Insignia de cuenta verificada.' })
  verified!: boolean;
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

  @Field(() => MediaType, { nullable: true, description: 'Foto de portada.' })
  cover!: MediaType | null;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => String, { nullable: true })
  website!: string | null;

  @Field()
  verified!: boolean;

  @Field({ description: 'Si tiene activa la verificación en dos pasos.' })
  mfaEnabled!: boolean;

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

  @Field(() => MediaType, { nullable: true })
  cover!: MediaType | null;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => String, { nullable: true })
  website!: string | null;

  @Field()
  verified!: boolean;

  @Field(() => Int)
  postCount!: number;

  @Field(() => Int)
  followerCount!: number;

  @Field(() => Int)
  followingCount!: number;

  @Field(() => FollowState, { nullable: true })
  followState!: FollowState | null;

  @Field()
  isPrivate!: boolean;

  @Field({ description: 'Si quien mira puede ver sus publicaciones e historias.' })
  canViewContent!: boolean;

  @Field()
  blockedByViewer!: boolean;

  @Field()
  hasActiveStory!: boolean;

  @Field()
  hasUnseenStory!: boolean;

  @Field(() => Boolean, { nullable: true, description: 'Nulo si no comparte su estado.' })
  isOnline!: boolean | null;

  @Field(() => String, { nullable: true })
  lastSeenAt!: string | null;

  @Field()
  canMessage!: boolean;

  @Field(() => Int)
  mutualFollowerCount!: number;

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

@ObjectType('FollowRequestResult', { description: 'Seguidores tras responder una solicitud.' })
export class FollowRequestResultType implements FollowRequestResult {
  @Field(() => Int)
  followerCount!: number;
}

@ObjectType('UserSuggestion', { description: 'Alguien que quizá conozcas.' })
export class UserSuggestionType implements UserSuggestion {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field(() => Int)
  mutualCount!: number;

  @Field(() => [UserSummaryType])
  mutuals!: UserSummaryType[];
}

@ObjectType('OnlineContact', { description: 'Una persona que sigues, con su estado de conexión.' })
export class OnlineContactType implements OnlineContact {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field()
  online!: boolean;

  @Field(() => String, { nullable: true })
  lastSeenAt!: string | null;
}

@ObjectType('BlockedUser')
export class BlockedUserType implements BlockedUser {
  @Field(() => UserSummaryType)
  user!: UserSummaryType;

  @Field()
  blockedAt!: string;
}

export const UserPage = Paginated(UserType, 'User');
export const UserSummaryPage = Paginated(UserSummaryType, 'UserSummary');
export const FollowRequestPage = Paginated(FollowRequestType, 'FollowRequest');
