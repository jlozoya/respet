import { Field, ID, InputType, Int } from '@nestjs/graphql';
import type {
  ConversationListQuery,
  CreateGroupRequest,
  MessageListQuery,
  SendMessageRequest,
} from '@respet/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { trim } from '../../common/dto/transforms.js';

/** Personas por grupo, sin contar a quien lo crea. */
export const MAX_GROUP_MEMBERS = 250;

@InputType('SendMessageInput')
export class SendMessageDto implements SendMessageRequest {
  @Field(() => String, {
    nullable: true,
    description: 'Identificador del cliente: reintentar con el mismo no duplica el mensaje.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, { message: 'clientId must be 8-64 url-safe characters' })
  clientId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @Field(() => ID, { nullable: true, description: 'El mensaje al que se contesta.' })
  @IsOptional()
  @IsMongoId()
  replyToId?: string;

  @Field(() => ID, { nullable: true, description: 'Una publicación que se comparte por privado.' })
  @IsOptional()
  @IsMongoId()
  sharedPostId?: string;

  @Field(() => Int, { nullable: true, description: 'Duración de una nota de voz, en milisegundos.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(15 * 60 * 1000)
  durationMs?: number;
}

@InputType('MessageListQueryInput')
export class MessageListQueryDto implements MessageListQuery {
  @Field(() => ID, { nullable: true, description: 'Mensajes anteriores a este, para seguir hacia atrás.' })
  @IsOptional()
  @IsMongoId()
  before?: string;

  @Field(() => ID, { nullable: true, description: 'Mensajes posteriores a este, para ponerse al día.' })
  @IsOptional()
  @IsMongoId()
  after?: string;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@InputType('CreateGroupInput')
export class CreateGroupDto implements CreateGroupRequest {
  @Field()
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  title!: string;

  @Field(() => [ID])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_MEMBERS)
  @IsMongoId({ each: true })
  memberIds!: string[];
}

@InputType('ConversationListQueryInput')
export class ConversationListQueryDto implements ConversationListQuery {
  @Field(() => Boolean, { nullable: true, description: 'Las archivadas en lugar de la bandeja.' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @Field(() => String, { nullable: true, description: 'Filtra por nombre del grupo o de la otra persona.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  search?: string;
}
