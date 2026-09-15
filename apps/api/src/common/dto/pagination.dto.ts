import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { DEFAULT_PER_PAGE, MAX_PER_PAGE } from '../utils/pagination.js';

/**
 * Base de los listados paginados.
 *
 * `isAbstract` la deja fuera del esquema: no es un tipo que nadie pida, sino
 * los campos que heredan los tipos de entrada de cada listado.
 */
@InputType({ isAbstract: true })
export class PaginationQueryDto {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PER_PAGE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
  perPage?: number = DEFAULT_PER_PAGE;
}

@InputType({ isAbstract: true })
export class SearchQueryDto extends PaginationQueryDto {
  @Field(() => String, { nullable: true, description: 'Texto libre a buscar.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
