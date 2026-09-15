import { Field, InputType } from '@nestjs/graphql';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SocialLoginRequest,
} from '@respet/shared';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { AuthProvider, Gender } from '../../graphql/enums.js';
import { normalizeEmail, trim } from '../../common/dto/transforms.js';

/** Longitud mínima recomendada por NIST SP 800-63B. */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

@InputType('LoginInput')
export class LoginDto implements LoginRequest {
  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(190)
  email!: string;

  @Field()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password!: string;
}

@InputType('SocialLoginInput')
export class SocialLoginDto implements SocialLoginRequest {
  /**
   * El proveedor, que nunca puede ser `password`.
   *
   * El enumerado del esquema los lista todos porque es el mismo que describe
   * una cuenta ya creada; aquí sólo valen los externos.
   */
  @Field(() => AuthProvider)
  @IsIn(['google', 'facebook', 'apple'])
  provider!: 'google' | 'facebook' | 'apple';

  @Field({ description: 'idToken en Google y Apple; accessToken en Facebook.' })
  @IsString()
  @Length(10, 4096)
  token!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;
}

@InputType('RegisterInput')
export class RegisterDto implements RegisterRequest {
  @Field({ description: 'Nombre visible dentro de la aplicación.' })
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  lastName!: string;

  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(190)
  email!: string;

  @Field()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  @Matches(/[a-zA-Z]/, { message: 'password must contain at least one letter' })
  @Matches(/\d/, { message: 'password must contain at least one digit' })
  password!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field(() => String, { nullable: true, description: 'Fecha de nacimiento, en ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthday?: string;
}

@InputType('ForgotPasswordInput')
export class ForgotPasswordDto implements ForgotPasswordRequest {
  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(190)
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;
}

@InputType('ResetPasswordInput')
export class ResetPasswordDto implements ResetPasswordRequest {
  @Field()
  @IsString()
  @Length(10, 200)
  token!: string;

  @Field()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  @Matches(/[a-zA-Z]/, { message: 'password must contain at least one letter' })
  @Matches(/\d/, { message: 'password must contain at least one digit' })
  password!: string;
}

@InputType('ChangePasswordInput')
export class ChangePasswordDto implements ChangePasswordRequest {
  @Field()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  currentPassword!: string;

  @Field()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  @Matches(/[a-zA-Z]/, { message: 'newPassword must contain at least one letter' })
  @Matches(/\d/, { message: 'newPassword must contain at least one digit' })
  newPassword!: string;
}

/** El token que llega por la cadena de consulta del enlace del correo. */
export class VerifyEmailQueryDto {
  @IsString()
  @Length(10, 200)
  token!: string;
}
