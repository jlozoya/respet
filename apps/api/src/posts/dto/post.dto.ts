import { Field, Float, ID, InputType, Int, OmitType, PartialType } from '@nestjs/graphql';
import type { CreatePostRequest, PostListQuery, UpdatePostRequest } from '@social-network/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { LocationDto } from '../../common/dto/location.dto.js';
import { SearchQueryDto } from '../../common/dto/pagination.dto.js';
import { trim } from '../../common/dto/transforms.js';
import { Audience, PostFeed, PostKind, ReactionType } from '../../graphql/enums.js';

/** Tope del difuminado de ubicación, en kilómetros. */
export const MAX_LOCATION_ACCURACY_KM = 25;

@InputType('CreatePostInput')
export class CreatePostDto implements CreatePostRequest {
  @Field(() => String, {
    nullable: true,
    description: 'Puede ir vacío si la publicación lleva fotos o comparte otra.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field(() => PostKind, { nullable: true, defaultValue: 'general' })
  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @Field(() => Audience, { nullable: true, defaultValue: 'public' })
  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;

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

  @Field(() => ID, { nullable: true, description: 'La publicación que se comparte.' })
  @IsOptional()
  @IsMongoId()
  sharedPostId?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  commentsDisabled?: boolean;
}

@InputType('UpdatePostInput')
export class UpdatePostDto
  extends PartialType(OmitType(CreatePostDto, ['sharedPostId'] as const))
  implements UpdatePostRequest {}

@InputType('PostListQueryInput')
export class PostListQueryDto extends SearchQueryDto implements PostListQuery {
  @Field(() => PostKind, { nullable: true })
  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @Field(() => PostFeed, {
    nullable: true,
    description:
      '`home` —el de portada— mezcla lo de quienes sigues con lo destacado; `following`, sólo lo de quienes sigues; `discover`, todo lo público.',
  })
  @IsOptional()
  @IsEnum(PostFeed)
  feed?: PostFeed;

  @Field(() => ID, { nullable: true, description: 'Filtra por autor.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @Field(() => String, { nullable: true, description: 'Filtra por etiqueta, sin la almohadilla.' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^#?[\p{L}\p{N}_]{1,50}$/u, { message: 'hashtag must be a valid tag' })
  hashtag?: string;

  @Field(() => Boolean, { nullable: true, description: 'Sólo publicaciones con fotos o vídeos.' })
  @IsOptional()
  @IsBoolean()
  withMediaOnly?: boolean;

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
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}

@InputType('ReactorListQueryInput')
export class ReactorListQueryDto extends SearchQueryDto {
  @Field(() => ReactionType, { nullable: true, description: 'Sólo quienes reaccionaron así.' })
  @IsOptional()
  @IsEnum(ReactionType)
  type?: ReactionType;
}
