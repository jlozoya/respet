import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { Conversation, Message, MessagePage } from '@respet/shared';

import { MessageKind } from '../enums.js';
import { MediaType } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('Message')
export class MessageType implements Message {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => MessageKind)
  kind!: MessageKind;

  @Field(() => String, { nullable: true, description: 'Nulo en imágenes y en los retirados.' })
  body!: string | null;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field(() => UserSummaryType)
  sender!: UserSummaryType;

  @Field({ description: 'Cierto si su autor lo retiró; el hilo lo enseña como eliminado.' })
  deleted!: boolean;

  @Field()
  createdAt!: string;
}

@ObjectType('Conversation')
export class ConversationType implements Conversation {
  @Field(() => ID)
  id!: string;

  @Field(() => UserSummaryType, { description: 'La otra persona.' })
  peer!: UserSummaryType;

  @Field(() => String, { nullable: true })
  lastMessageAt!: string | null;

  @Field(() => String, { nullable: true, description: 'Resumen del último mensaje, para la lista.' })
  lastPreview!: string | null;

  @Field(() => Int)
  unreadCount!: number;

  @Field()
  muted!: boolean;
}

/**
 * Tramo de un hilo.
 *
 * No usa la paginación por número de página del resto de la API:
 * un hilo crece por arriba mientras se lee, y numerar páginas haría que los
 * mensajes se repitieran o se saltaran al llegar uno nuevo. Se pagina por
 * cursor, hacia atrás desde el más reciente.
 */
@ObjectType('MessagePage')
export class MessagePageType implements MessagePage {
  @Field(() => [MessageType])
  data!: MessageType[];

  @Field(() => ID, { nullable: true, description: 'Id desde el que pedir el siguiente tramo.' })
  nextCursor!: string | null;
}
