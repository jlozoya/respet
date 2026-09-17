import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';

import { FullNamePipe } from '../pipes/full-name.pipe';

interface NamedUser {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  verified?: boolean;
}

/**
 * El nombre de una persona con su insignia de verificada, enlazado a su perfil.
 *
 * Lo pintan las publicaciones, los comentarios, las historias y el chat; en
 * todos lleva al mismo sitio y la insignia va pegada al nombre.
 */
@Component({
  selector: 'app-user-name',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IonIcon, FullNamePipe],
  template: `
    @if (user(); as person) {
      @if (link()) {
        <a class="name" [routerLink]="['/profile', person.name]">{{ person | fullName }}</a>
      } @else {
        <span class="name">{{ person | fullName }}</span>
      }
      @if (person.verified) {
        <ion-icon class="verified" name="checkmark-circle" />
      }
      @if (showHandle()) {
        <span class="handle">&#64;{{ person.name }}</span>
      }
    }
  `,
  styles: `
    :host {
      align-items: center;
      display: inline-flex;
      gap: 4px;
      max-width: 100%;
      min-width: 0;
    }

    .name {
      color: inherit;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    a.name:hover {
      text-decoration: underline;
    }

    .verified {
      color: #1877f2;
      flex: 0 0 auto;
      font-size: 0.95em;
    }

    .handle {
      color: var(--rs-text-2);
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class UserNameComponent {
  readonly user = input<NamedUser | null | undefined>(null);
  readonly link = input(true);
  readonly showHandle = input(false);
}
