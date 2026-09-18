import { Field, ID, InputType, Int } from '@nestjs/graphql';
import type { CreateStoryRequest } from '@social-network/shared';
import { STORY_BACKGROUNDS, STORY_FONTS } from '@social-network/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { trim } from '../../common/dto/transforms.js';
import { Audience, StoryKind } from '../../graphql/enums.js';

@InputType('CreateStoryInput')
export class CreateStoryDto implements CreateStoryRequest {
  @Field(() => StoryKind, { nullable: true, description: 'Sólo hace falta para las de texto; con archivo se deduce.' })
  @IsOptional()
  @IsEnum(StoryKind)
  kind?: StoryKind;

  @Field(() => String, { nullable: true, description: 'El texto de una historia de texto, o el pie de una foto.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  text?: string;

  @Field(() => String, { nullable: true, description: `Fondo: ${STORY_BACKGROUNDS.join(', ')}.` })
  @IsOptional()
  @IsIn(STORY_BACKGROUNDS)
  background?: string;

  @Field(() => String, { nullable: true, description: `Tipografía: ${STORY_FONTS.join(', ')}.` })
  @IsOptional()
  @IsIn(STORY_FONTS)
  font?: string;

  @Field(() => Audience, { nullable: true, defaultValue: 'followers' })
  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;

  @Field(() => Int, { nullable: true, description: 'Duración de un vídeo, por si el servidor no puede medirla.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60_000)
  durationMs?: number;
}

@InputType('StoryHighlightInput')
export class StoryHighlightDto {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  title!: string;

  @Field(() => [ID])
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  storyIds!: string[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  coverStoryId?: string;
}
