import { Field, ID, InputType, Int } from '@nestjs/graphql';
import type { MessageListQuery, SendMessageRequest } from '@respet/shared';
import { Transform } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Length, Max, Min } from 'class-validator';

@InputType('SendMessageInput')
export class SendMessageDto implements SendMessageRequest {
  @Field()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 4000)
  body!: string;
}

@InputType('MessageListQueryInput')
export class MessageListQueryDto implements MessageListQuery {
  @Field(() => ID, {
    nullable: true,
    description: 'Devuelve los mensajes anteriores a este id, para seguir hacia atrás.',
  })
  @IsOptional()
  @IsMongoId()
  before?: string;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
