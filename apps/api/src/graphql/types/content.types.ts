import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  Analytics,
  Bulletin,
  SupportTicket,
  UsersRegistrationPoint,
} from '@social-network/shared';

import { MediaType, Paginated } from './common.types.js';

/*
  Las publicaciones y los comentarios viven ahora en `social.types.ts`, junto
  a las reacciones y el buscador. Aquí queda lo institucional: avisos,
  contacto y cifras.
*/

@ObjectType('Bulletin', { description: 'Aviso publicado por la administración.' })
export class BulletinType implements Bulletin {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  date!: string;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('SupportTicket', { description: 'Mensaje del formulario de contacto.' })
export class SupportTicketType implements SupportTicket {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field()
  message!: string;

  @Field()
  lang!: string;

  @Field()
  createdAt!: string;
}

@ObjectType({ description: 'Cuentas por género.' })
export class GenderBreakdown {
  @Field(() => Int)
  male!: number;

  @Field(() => Int)
  female!: number;

  @Field(() => Int, { description: 'Quienes prefieren no decirlo.' })
  unspecified!: number;

  @Field(() => Int, { description: 'Quienes no han contestado.' })
  unknown!: number;
}

@ObjectType({ description: 'Cuentas por tramo de edad.' })
export class AgeBreakdown {
  @Field(() => Int)
  children!: number;

  @Field(() => Int)
  teens!: number;

  @Field(() => Int)
  youngAdults!: number;

  @Field(() => Int)
  adults!: number;

  @Field(() => Int)
  unknown!: number;
}

@ObjectType({ description: 'Cuentas por forma de autenticarse.' })
export class ProviderBreakdown {
  @Field(() => Int)
  password!: number;

  @Field(() => Int)
  google!: number;

  @Field(() => Int)
  facebook!: number;

  @Field(() => Int)
  apple!: number;
}

@ObjectType('Analytics', { description: 'Cifras generales de la plataforma.' })
export class AnalyticsType implements Analytics {
  @Field(() => Int)
  usersTotal!: number;

  @Field(() => Int)
  supportTotal!: number;

  @Field(() => Int)
  postsTotal!: number;

  @Field(() => Int)
  ordersTotal!: number;

  @Field(() => GenderBreakdown)
  gender!: GenderBreakdown;

  @Field(() => AgeBreakdown)
  ages!: AgeBreakdown;

  @Field(() => ProviderBreakdown)
  providers!: ProviderBreakdown;
}

@ObjectType('UsersRegistrationPoint', { description: 'Altas dentro de un intervalo.' })
export class UsersRegistrationPointType implements UsersRegistrationPoint {
  @Field({ description: 'Inicio del intervalo, en formato ISO-8601.' })
  date!: string;

  @Field(() => Int)
  users!: number;
}

export const BulletinPage = Paginated(BulletinType, 'Bulletin');
export const SupportTicketPage = Paginated(SupportTicketType, 'SupportTicket');
