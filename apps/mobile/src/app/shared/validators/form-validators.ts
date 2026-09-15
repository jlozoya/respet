import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores de formulario propios.
 *
 * Devuelven claves de traducción en lugar de mensajes, para que sea la
 * plantilla quien decida el idioma. Sustituyen al `ValidationService` anterior,
 * que declaraba los validadores como métodos estáticos sin tipar y buscaba el
 * mensaje en un objeto indexado por cadena.
 */

/** Mensaje traducible para el primer error de un control. */
export function firstErrorKey(control: AbstractControl | null): string | null {
  if (!control?.errors || (!control.touched && !control.dirty)) {
    return null;
  }

  const [key] = Object.keys(control.errors);

  return key ? (ERROR_MESSAGES[key] ?? 'FORM.INVALID') : null;
}

const ERROR_MESSAGES: Record<string, string> = {
  required: 'FORM.REQUIRED',
  email: 'FORM.EMAIL',
  minlength: 'FORM.MIN',
  maxlength: 'FORM.MAX',
  min: 'FORM.MIN',
  max: 'FORM.MAX',
  weakPassword: 'FORM.PASSWORD',
  invalidPhone: 'FORM.PHONE',
  passwordMismatch: 'FORM.PASSWORD_MISMATCH',
};

/**
 * Contraseña con al menos ocho caracteres, una letra y un dígito.
 *
 * Coincide con lo que valida el servidor en `RegisterDto`: si aquí se aceptara
 * algo más laxo, el formulario dejaría enviar datos que la API va a rechazar.
 */
export function passwordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');

    if (!value) {
      return null;
    }

    const strong = value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value);

    return strong ? null : { weakPassword: true };
  };
}

/** Teléfono internacional, con un formato deliberadamente permisivo. */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();

    if (!value) {
      return null;
    }

    return /^\+?[\d\s().-]{6,20}$/.test(value) ? null : { invalidPhone: true };
  };
}

/** Comprueba que dos controles del mismo grupo coinciden. */
export function matchFields(field: string, confirmation: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const first: unknown = group.get(field)?.value;
    const second: unknown = group.get(confirmation)?.value;

    if (!first || !second || first === second) {
      return null;
    }

    // El error se marca también en el control de confirmación, que es donde la
    // plantilla lo enseña.
    group.get(confirmation)?.setErrors({ passwordMismatch: true });

    return { passwordMismatch: true };
  };
}
