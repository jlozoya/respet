import { Pipe, inject, type PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Antigüedad de una fecha en palabras: «ahora», «hace 5 min», «ayer».
 *
 * Usa `Intl.RelativeTimeFormat`, que trae el navegador, en lugar de arrastrar
 * una biblioteca de fechas entera para esto. El idioma sale de
 * `TranslateService`, así que cambia con el de la interfaz.
 */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const locale = this.translate.currentLang() ?? 'es';
    const elapsed = Date.now() - date.getTime();

    if (elapsed < MINUTE) {
      return this.translate.instant('TIME.NOW') as string;
    }

    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });

    if (elapsed < HOUR) {
      return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
    }

    if (elapsed < DAY) {
      return relative.format(-Math.floor(elapsed / HOUR), 'hour');
    }

    if (elapsed < WEEK) {
      return relative.format(-Math.floor(elapsed / DAY), 'day');
    }

    // Pasada una semana, la fecha concreta dice más que «hace 3 semanas».
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
  }
}
