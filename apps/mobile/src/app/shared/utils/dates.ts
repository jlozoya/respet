/** Cierto si las dos fechas caen el mismo día, en la hora local. */
export function sameDay(a: string | Date, b: string | Date): boolean {
  const first = new Date(a);
  const second = new Date(b);

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/** «Hoy», «Ayer» o la fecha, para separar los días de un hilo. */
export function dayLabel(value: string, locale: string, today: string, yesterday: string): string {
  const date = new Date(value);
  const now = new Date();
  const before = new Date(now);
  before.setDate(now.getDate() - 1);

  if (sameDay(date, now)) {
    return today;
  }

  if (sameDay(date, before)) {
    return yesterday;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}

/** Hora corta: «14:05». */
export function shortTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
