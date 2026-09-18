import { Pipe, inject, type PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Una cifra en corto: 1234 es «1,2 mil» y 2 500 000, «2,5 M».
 *
 * Las cuentas de reacciones y seguidores crecen deprisa, y un número entero
 * no cabe en el hueco de un botón. `Intl.NumberFormat` lo hace en el idioma de
 * la interfaz sin tablas propias.
 */
@Pipe({ name: 'compactNumber' })
export class CompactNumberPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const locale = this.translate.currentLang() ?? 'es';

    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
      value,
    );
  }
}
