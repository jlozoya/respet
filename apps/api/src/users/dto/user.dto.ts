import { Field, InputType } from '@nestjs/graphql';
import type {
  AddEmailsRequest,
  AddPhonesRequest,
  UpdateEmailRequest,
  UpdateLanguageRequest,
  UpdateLocationRequest,
  UpdatePermissionsRequest,
  UpdateProfileRequest,
} from '@social-network/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { USERNAME } from '../../auth/dto/auth.dto.js';
import { LocationDto } from '../../common/dto/location.dto.js';
import { SearchQueryDto } from '../../common/dto/pagination.dto.js';
import { Gender, MessagePolicy, UserRole } from '../../graphql/enums.js';
import { normalizeEmail, normalizeEmailEach, trim, trimEach } from '../../common/dto/transforms.js';

/** Formato laxo a propósito: los teléfonos internacionales varían mucho. */
const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;

@InputType('UpdateProfileInput')
export class UpdateProfileDto implements UpdateProfileRequest {
  /*
    El nombre viaja en la dirección del perfil, así que se exige apto para una
    web: minúsculas, dígitos, guion y guion bajo, empezando y acabando en
    letra o número. El mismo patrón que valida la aplicación antes de enviar.
  */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 30)
  @Matches(USERNAME, { message: 'name must be url friendly' })
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @Field(() => String, { nullable: true, description: 'Fecha de nacimiento, en ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthday?: string | null;

  @Field(() => String, { nullable: true, description: 'Presentación breve, hasta 280 caracteres.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(280)
  bio?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_object, value) => value !== null && value !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'website must be a valid URL' })
  @MaxLength(200)
  website?: string | null;
}

@InputType('UpdateEmailInput')
export class UpdateEmailDto implements UpdateEmailRequest {
  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(190)
  email!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Contraseña actual. Obligatoria en cuentas con contraseña.',
  })
  @IsOptional()
  @IsString()
  @Length(8, 128)
  password?: string;
}

@InputType('UpdateLanguageInput')
export class UpdateLanguageDto implements UpdateLanguageRequest {
  @Field()
  @IsString()
  @Length(2, 5)
  lang!: string;
}

@InputType('UpdateLocationInput')
export class UpdateLocationDto implements UpdateLocationRequest {
  @Field(() => LocationDto, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto | null;
}

@InputType('UpdatePermissionsInput')
export class UpdatePermissionsDto implements UpdatePermissionsRequest {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showMainEmail?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showAlternativeEmails?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showMainPhone?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showAlternativePhones?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showLocation?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  receiveMailAds?: boolean;

  @Field(() => MessagePolicy, { nullable: true })
  @IsOptional()
  @IsEnum(MessagePolicy)
  messagePolicy?: MessagePolicy;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  privateProfile?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @Field(() => MessagePolicy, { nullable: true })
  @IsOptional()
  @IsEnum(MessagePolicy)
  storyReplyPolicy?: MessagePolicy;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  loginAlerts?: boolean;
}

@InputType('AddEmailsInput')
export class AddEmailsDto implements AddEmailsRequest {
  @Field(() => [String])
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @Transform(normalizeEmailEach)
  @IsEmail({}, { each: true, message: 'emails must contain valid addresses' })
  emails!: string[];
}

@InputType('AddPhonesInput')
export class AddPhonesDto implements AddPhonesRequest {
  @Field(() => [String])
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @Transform(trimEach)
  @IsNotEmpty({ each: true })
  @Matches(PHONE_PATTERN, { each: true, message: 'phones must contain valid phone numbers' })
  phones!: string[];
}

@InputType('UserListQueryInput')
export class UserListQueryDto extends SearchQueryDto {
  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
