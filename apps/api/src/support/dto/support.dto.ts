import { Field, InputType } from '@nestjs/graphql';
import type { CreateSupportRequest } from '@social-network/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { SearchQueryDto } from '../../common/dto/pagination.dto.js';
import { normalizeEmail, trim } from '../../common/dto/transforms.js';

@InputType('CreateSupportInput')
export class CreateSupportDto implements CreateSupportRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name!: string;

  @Field()
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(190)
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[\d\s().-]{6,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @Field()
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  message!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;
}

@InputType('SupportListQueryInput')
export class SupportListQueryDto extends SearchQueryDto {}
