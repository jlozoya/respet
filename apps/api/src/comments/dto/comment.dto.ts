import { Field, InputType } from '@nestjs/graphql';
import type { CreateCommentRequest } from '@respet/shared';
import { IsString, Length } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

@InputType('CreateCommentInput')
export class CreateCommentDto implements CreateCommentRequest {
  @Field()
  @IsString()
  @Length(1, 2000)
  body!: string;
}

@InputType('UpdateCommentInput')
export class UpdateCommentDto extends CreateCommentDto {}

@InputType('CommentListQueryInput')
export class CommentListQueryDto extends PaginationQueryDto {}
