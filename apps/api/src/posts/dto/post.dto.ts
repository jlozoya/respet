import { Field, Float, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import type { CreatePostRequest } from '@respet/shared';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { LocationDto } from '../../common/dto/location.dto.js';
import { SearchQueryDto } from '../../common/dto/pagination.dto.js';
import { PostFeed, PostKind } from '../../graphql/enums.js';

/** Tope del difuminado de ubicación, en kilómetros. */
export const MAX_LOCATION_ACCURACY_KM = 25;

@InputType('CreatePostInput')
export class CreatePostDto implements CreatePostRequest {
  @Field()
  @IsString()
  @Length(1, 5000)
  description!: string;

  @Field(() => PostKind)
  @IsEnum(PostKind)
  kind!: PostKind;

  @Field(() => LocationDto, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto | null;

  @Field(() => Int, {
    nullable: true,
    description:
      'Radio de difuminado en kilómetros. 0 publica la ubicación exacta; útil para no revelar un domicilio.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_LOCATION_ACCURACY_KM)
  locationAccuracy?: number;
}

@InputType('UpdatePostInput')
export class UpdatePostDto extends PartialType(CreatePostDto) {}

@InputType('PostListQueryInput')
export class PostListQueryDto extends SearchQueryDto {
  @Field(() => PostKind, { nullable: true })
  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @Field(() => PostFeed, {
    nullable: true,
    description:
      '`following` limita el muro a las publicaciones de quienes sigue el usuario —y a las suyas—. Sin sesión se ignora.',
  })
  @IsOptional()
  @IsEnum(PostFeed)
  feed?: PostFeed;

  @Field(() => ID, { nullable: true, description: 'Filtra por autor.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(-90)
  @Max(90)
  lat?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(-180)
  @Max(180)
  lng?: number;

  @Field(() => Float, { nullable: true, description: 'Radio de búsqueda en kilómetros.' })
  @IsOptional()
  @Min(0.1)
  @Max(20_000)
  radiusKm?: number;
}

@InputType('ReportPostInput')
export class ReportPostDto {
  @Field({ description: 'Motivo de la denuncia, tal y como lo escribe quien la envía.' })
  @IsString()
  @Length(10, 500)
  reason!: string;
}
