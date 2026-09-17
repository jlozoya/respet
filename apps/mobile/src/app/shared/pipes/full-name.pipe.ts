import { Pipe, type PipeTransform } from '@angular/core';

interface Named {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

/**
 * Nombre y apellidos, o el nombre de usuario si no hay.
 *
 * Es lo que se enseña como firma: el nombre de usuario va aparte, en gris, como
 * hace Facebook.
 */
@Pipe({ name: 'fullName' })
export class FullNamePipe implements PipeTransform {
  transform(user: Named | null | undefined): string {
    return fullName(user);
  }
}

export function fullName(user: Named | null | undefined): string {
  if (!user) {
    return '';
  }

  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return full || user.name || '';
}
