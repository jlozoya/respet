import { Field, Float, InputType } from '@nestjs/graphql';
import type { LocationInput } from '@social-network/shared';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Ubicación tal y como la envía la app, normalmente desde Google Maps.
 *
 * Las clases de este directorio y de los `dto/` de cada dominio son ahora los
 * tipos de entrada del esquema de GraphQL: `@Field` declara la forma y
 * `class-validator` sigue poniendo los límites que el esquema no sabe
 * expresar —una longitud máxima, un correo bien formado—.
 */
@InputType('LocationInput')
export class LocationDto implements LocationInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string | null;

  @Field(() => String, { nullable: true, description: 'Estado o provincia.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string | null;

  @Field(() => String, { nullable: true, description: 'Ciudad o municipio.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string | null;

  @Field(() => String, { nullable: true, description: 'Calle.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  route?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  streetNumber?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  postalCode?: string | null;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number | null;
}
