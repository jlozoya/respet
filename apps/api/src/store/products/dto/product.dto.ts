import { Field, Float, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import type { CreateProductRequest } from '@social-network/shared';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { SearchQueryDto } from '../../../common/dto/pagination.dto.js';
import { trim } from '../../../common/dto/transforms.js';

@InputType('CreateProductInput')
export class CreateProductDto implements CreateProductRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(2, 190)
  name!: string;

  @Field()
  @IsString()
  @Length(1, 5000)
  description!: string;

  @Field(() => Int, { description: 'Existencias disponibles.' })
  @IsInt()
  @Min(0)
  stock!: number;

  @Field(() => Float, { description: 'Precio unitario, con dos decimales.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  price!: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  warehouseId?: string | null;
}

@InputType('UpdateProductInput')
export class UpdateProductDto extends PartialType(CreateProductDto) {}

@InputType('ProductListQueryInput')
export class ProductListQueryDto extends SearchQueryDto {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  warehouseId?: string;
}
