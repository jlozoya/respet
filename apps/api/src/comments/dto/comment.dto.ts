import { Field, ID, InputType } from '@nestjs/graphql';
import type { CommentListQuery, CreateCommentRequest, UpdateCommentRequest } from '@social-network/shared';
import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { trim } from '../../common/dto/transforms.js';

@InputType('CreateCommentInput')
export class CreateCommentDto implements CreateCommentRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  body!: string;

  @Field(() => ID, { nullable: true, description: 'El comentario al que se responde.' })
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}

@InputType('UpdateCommentInput')
export class UpdateCommentDto implements UpdateCommentRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  body!: string;
}

@InputType('CommentListQueryInput')
export class CommentListQueryDto extends PaginationQueryDto implements CommentListQuery {
  @Field(() => ID, { nullable: true, description: 'Las respuestas de este comentario, en lugar de los de primer nivel.' })
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}
