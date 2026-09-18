import { Field, InputType, PartialType } from '@nestjs/graphql';
import type { CreateWarehouseRequest } from '@social-network/shared';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateNested } from 'class-validator';

import { LocationDto } from '../../../common/dto/location.dto.js';
import { SearchQueryDto } from '../../../common/dto/pagination.dto.js';
import { trim } from '../../../common/dto/transforms.js';

@InputType('CreateWarehouseInput')
export class CreateWarehouseDto implements CreateWarehouseRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @Field(() => LocationDto, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto | null;
}

@InputType('UpdateWarehouseInput')
export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

@InputType('WarehouseListQueryInput')
export class WarehouseListQueryDto extends SearchQueryDto {}
