import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Query, Resolver } from '@nestjs/graphql';
import type { Branding } from '@social-network/shared';

import { Public } from '../common/decorators/index.js';
import { BrandingType } from '../graphql/types/branding.types.js';

/**
 * La marca de esta instalación.
 *
 * Una sola consulta, pública y sin argumentos: la aplicación la pide antes de
 * pintar la primera pantalla para saber cómo se llama esto, de qué color es y
 * qué logotipo poner. Sale entera de las variables `APP_*`, de modo que
 * cambiar el nombre es reiniciar el contenedor, no recompilar.
 */
@Injectable()
@Resolver(() => BrandingType)
export class BrandingResolver {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Query(() => BrandingType, {
    name: 'branding',
    description: 'Nombre, colores, logotipo y enlaces de esta instalación.',
  })
  branding(): Branding {
    return this.config.getOrThrow<Branding>('branding');
  }
}
