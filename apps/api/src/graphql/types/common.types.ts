import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import type { Location, Media, PaginationMeta } from '@respet/shared';
import type { Type } from '@nestjs/common';

import { MediaType as MediaKind } from '../enums.js';

/**
 * Los tipos que ve la aplicación, uno por interfaz de `@respet/shared`.
 *
 * Las clases no llevan lógica: existen porque el esquema se construye a partir
 * de ellas —enfoque «code first»— y una interfaz de TypeScript se borra al
 * compilar, así que no deja nada que leer en tiempo de ejecución. Cada clase
 * declara `implements` su contrato compartido: si el servidor cambia la forma
 * de un `Post`, esto deja de compilar en lugar de servir un esquema mentiroso.
 *
 * Las fechas viajan como cadenas ISO-8601 y no como un escalar `DateTime`
 * propio: es lo que ya devuelven los mapeadores y lo que declara el contrato
 * compartido, de modo que convertirlas aquí sólo añadiría un sitio donde
 * perder la zona horaria.
 */

@ObjectType('PaginationMeta', { description: 'Cómo se reparte un listado en páginas.' })
export class PaginationMetaType implements PaginationMeta {
  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  perPage!: number;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  lastPage!: number;

  @Field()
  hasNextPage!: boolean;

  @Field()
  hasPreviousPage!: boolean;
}

/**
 * Construye el tipo `XPage` de un listado.
 *
 * GraphQL no tiene genéricos, así que cada página es un tipo propio. Esta
 * fábrica los fabrica todos iguales a partir del tipo que llevan dentro, en
 * lugar de repetir la misma clase veinte veces.
 */
export function Paginated<T>(classRef: Type<T>, name: string): Type<{ data: T[]; meta: PaginationMeta }> {
  @ObjectType(`${name}Page`, { description: `Página de ${name}.` })
  class PageType {
    @Field(() => [classRef])
    data!: T[];

    @Field(() => PaginationMetaType)
    meta!: PaginationMeta;
  }

  return PageType;
}

@ObjectType('Location', { description: 'Un sitio, con o sin coordenadas.' })
export class LocationType implements Location {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  country!: string | null;

  @Field(() => String, { nullable: true, description: 'Estado o provincia.' })
  state!: string | null;

  @Field(() => String, { nullable: true, description: 'Ciudad o municipio.' })
  city!: string | null;

  @Field(() => String, { nullable: true, description: 'Calle.' })
  route!: string | null;

  @Field(() => String, { nullable: true })
  streetNumber!: string | null;

  @Field(() => String, { nullable: true })
  postalCode!: string | null;

  @Field(() => Float, { nullable: true })
  lat!: number | null;

  @Field(() => Float, { nullable: true })
  lng!: number | null;
}

@ObjectType('Media', { description: 'Un archivo subido, normalmente una imagen.' })
export class MediaType implements Media {
  @Field(() => ID)
  id!: string;

  @Field(() => MediaKind)
  type!: MediaKind;

  @Field()
  url!: string;

  @Field()
  alt!: string;

  @Field(() => Int, { nullable: true })
  width!: number | null;

  @Field(() => Int, { nullable: true })
  height!: number | null;
}
