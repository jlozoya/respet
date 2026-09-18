import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { firstErrorKey } from '../validators/form-validators';

/**
 * Mensaje de error de un control de formulario.
 *
 * Sólo aparece cuando el control ya se ha tocado, para no señalar en rojo un
 * formulario que todavía no se ha empezado a rellenar.
 *
 * El control no es una señal, así que se escuchan sus eventos —cambio de valor,
 * de estado, de «tocado»— para volver a calcular el mensaje: sin eso, con
 * `OnPush`, el aviso se quedaría con el primer estado que vio.
 */
@Component({
  selector: 'app-control-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (message(); as key) {
      <span class="message" role="alert">{{ key | translate: params() }}</span>
    }
  `,
  styles: `
    .message {
      color: var(--ion-color-danger);
      display: block;
      font-size: 0.8125rem;
      padding: 2px 4px 0;
    }
  `,
})
export class ControlMessagesComponent {
  readonly control = input.required<AbstractControl | null>();

  private readonly version = signal(0);

  constructor() {
    effect((onCleanup) => {
      const control = this.control();

      if (!control) {
        return;
      }

      const subscription = control.events.subscribe(() =>
        this.version.update((value) => value + 1),
      );
      onCleanup(() => subscription.unsubscribe());
    });
  }

  readonly message = computed(() => {
    this.version();

    return firstErrorKey(this.control());
  });

  /**
   * Parámetros de interpolación del mensaje.
   *
   * `minlength` y `maxlength` traen la longitud exigida, que la traducción
   * puede insertar con `{{ requiredLength }}`.
   */
  readonly params = computed<Record<string, unknown>>(() => {
    this.version();
    const errors = this.control()?.errors;

    if (!errors) {
      return {};
    }

    const detail: unknown =
      errors['minlength'] ?? errors['maxlength'] ?? errors['min'] ?? errors['max'];

    return typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : {};
  });
}
