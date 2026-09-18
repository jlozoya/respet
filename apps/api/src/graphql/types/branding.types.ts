import { Field, ObjectType } from '@nestjs/graphql';
import type { Branding } from '@social-network/shared';

/**
 * La marca, tal y como la pide la aplicación antes de pintar nada.
 *
 * Es pública a propósito: la pantalla de entrada tiene que saber cómo se llama
 * esto y de qué color es sin haber iniciado sesión.
 */
@ObjectType('Branding', { description: 'Nombre, colores, logotipo y enlaces de esta instalación.' })
export class BrandingType implements Branding {
  @Field({ description: 'El nombre, tal cual aparece en los textos.' })
  name!: string;

  @Field({ description: 'Una línea, debajo del nombre en la pantalla de entrada.' })
  tagline!: string;

  @Field({ description: 'Dos o tres líneas para la página «acerca de».' })
  description!: string;

  @Field(() => String, { nullable: true, description: 'Logotipo horizontal para la cabecera.' })
  logoUrl!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Icono cuadrado para la pestaña y los correos.',
  })
  iconUrl!: string | null;

  @Field({ description: 'Color principal, en hexadecimal.' })
  brandColor!: string;

  @Field({ description: 'Degradado de los adornos.' })
  brandGradient!: string;

  @Field(() => String, { nullable: true })
  website!: string | null;

  @Field(() => String, { nullable: true })
  publicMail!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => String, { nullable: true })
  facebook!: string | null;

  @Field(() => String, { nullable: true })
  instagram!: string | null;
}
