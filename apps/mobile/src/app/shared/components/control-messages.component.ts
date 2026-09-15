import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { IonNote } from '@ionic/angular/ion-note';
import { TranslatePipe } from '@ngx-translate/core';

import { firstErrorKey } from '../validators/form-validators';

/**
 * Mensaje de error de un control de formulario.
 *
 * Sólo aparece cuando el control ya se ha tocado, para no señalar en rojo un
 * formulario que el usuario todavía no ha empezado a rellenar.
 */
@Component({
  selector: 'app-control-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonNote],
  template: `
    @if (message(); as key) {
      <ion-note color="danger" class="message">{{ key | translate: params() }}</ion-note>
    }
  `,
  styles: `
    .message {
      display: block;
      font-size: 0.8rem;
      padding: 4px 16px 0;
    }
  `,
})
export class ControlMessagesComponent {
  readonly control = input.required<AbstractControl | null>();

  readonly message = computed(() => firstErrorKey(this.control()));

  /**
   * Parámetros de interpolación del mensaje.
   *
   * `minlength` y `maxlength` traen la longitud exigida, que la traducción
   * puede insertar con `{{ requiredLength }}`.
   */
  readonly params = computed<Record<string, unknown>>(() => {
    const errors = this.control()?.errors;

    if (!errors) {
      return {};
    }

    const detail: unknown =
      errors['minlength'] ?? errors['maxlength'] ?? errors['min'] ?? errors['max'];

    return typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : {};
  });
}
