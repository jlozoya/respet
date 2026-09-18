import { Field, InputType } from '@nestjs/graphql';
import type {
  CreateAppRequest,
  OAuthAuthorizeRequest,
  UpdateAppRequest,
  UpdateWebhookRequest,
} from '@social-network/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { trim } from '../../common/dto/transforms.js';
import { OAuthClientType } from '../../graphql/enums.js';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };

@InputType('CreateDeveloperAppInput')
export class CreateAppDto implements CreateAppRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  websiteUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  privacyPolicyUrl?: string;

  @Field(() => OAuthClientType, {
    nullable: true,
    defaultValue: 'confidential',
    description: '`public` para apps móviles o de navegador, que usan PKCE en lugar de secreto.',
  })
  @IsOptional()
  @IsEnum(OAuthClientType)
  clientType?: OAuthClientType;

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  redirectUris!: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedScopes?: string[];
}

@InputType('UpdateDeveloperAppInput')
export class UpdateAppDto implements UpdateAppRequest {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl(URL_OPTIONS)
  websiteUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl(URL_OPTIONS)
  privacyPolicyUrl?: string | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  redirectUris?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedScopes?: string[];
}

@InputType('UpdateWebhookInput')
export class UpdateWebhookDto implements UpdateWebhookRequest {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl(URL_OPTIONS)
  url!: string | null;

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  events!: string[];

  @Field()
  @IsBoolean()
  active!: boolean;
}

@InputType('OAuthAuthorizeInput', { description: 'Los parámetros de `/oauth/authorize`, tal cual llegan en la URL.' })
export class OAuthAuthorizeDto implements OAuthAuthorizeRequest {
  @Field()
  @IsString()
  @Length(8, 64)
  clientId!: string;

  @Field()
  @IsString()
  @MaxLength(500)
  redirectUri!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  state?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  responseType?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(43, 128)
  codeChallenge?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  codeChallengeMethod?: string;
}

@InputType('OAuthCodeExchangeInput')
export class OAuthCodeExchangeDto {
  @Field()
  @IsString()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @Field()
  @IsString()
  code!: string;

  @Field()
  @IsString()
  redirectUri!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(43, 128)
  codeVerifier?: string;
}

@InputType('OAuthRefreshInput')
export class OAuthRefreshDto {
  @Field()
  @IsString()
  clientId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @Field()
  @IsString()
  refreshToken!: string;
}
