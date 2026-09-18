import { Injectable, inject } from '@angular/core';
import { TranslateDefaultParser, type InterpolationParameters } from '@ngx-translate/core';

import { BrandingService } from '../branding/branding.service';

type InterpolateFunction = (params?: InterpolationParameters) => string;

/**
 * El nombre de la marca, disponible en cualquier traducción.
 *
 * Los textos no lo llevan escrito: dejan el hueco `{{app}}` —«Sobre {{app}}»,
 * «Al continuar, {{app}} podrá…»— y esto lo rellena con el nombre de la
 * instalación en cada interpolación. Así el mismo juego de traducciones vale
 * para cualquiera que despliegue esto, y cambiar el nombre no obliga a tocar
 * mil cadenas.
 *
 * Lo que venga en los parámetros de la llamada manda, por si alguna pantalla
 * quiere nombrar a otra aplicación —la de un tercero pidiendo permisos, por
 * ejemplo— con esa misma clave.
 */
@Injectable()
export class AppNameParser extends TranslateDefaultParser {
  private readonly branding = inject(BrandingService);

  override interpolate(
    expr: InterpolateFunction | string,
    params?: InterpolationParameters,
  ): string | undefined {
    return super.interpolate(expr, { app: this.branding.name(), ...params });
  }
}
