import { Field, InputType, PartialType } from '@nestjs/graphql';
import type { CreateBulletinRequest } from '@respet/shared';
import { Transform } from 'class-transformer';
import { IsDateString, IsString, Length } from 'class-validator';

import { SearchQueryDto } from '../../common/dto/pagination.dto.js';
import { trim } from '../../common/dto/transforms.js';

@InputType('CreateBulletinInput')
export class CreateBulletinDto implements CreateBulletinRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title!: string;

  @Field()
  @IsString()
  @Length(1, 10_000)
  description!: string;

  @Field({ description: 'Fecha del aviso, en formato ISO-8601 (2026-09-10).' })
  @IsDateString({ strict: true })
  date!: string;
}

@InputType('UpdateBulletinInput')
export class UpdateBulletinDto extends PartialType(CreateBulletinDto) {}

@InputType('BulletinListQueryInput')
export class BulletinListQueryDto extends SearchQueryDto {}
