import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  firstErrorKey,
  matchFields,
  passwordValidator,
  phoneValidator,
  usernameValidator,
} from './form-validators';

describe('passwordValidator', () => {
  const validate = passwordValidator();

  it('exige ocho caracteres con letra y número', () => {
    expect(validate(new FormControl('social1234'))).toBeNull();
    expect(validate(new FormControl('corta1'))).toEqual({ weakPassword: true });
    expect(validate(new FormControl('sinnumeros'))).toEqual({ weakPassword: true });
  });

  it('deja pasar el campo vacío, que ya cubre `required`', () => {
    expect(validate(new FormControl(''))).toBeNull();
  });
});

describe('usernameValidator', () => {
  const validate = usernameValidator();

  it('acepta los nombres que caben en una dirección', () => {
    expect(validate(new FormControl('ana_ruiz'))).toBeNull();
    expect(validate(new FormControl('ana-99'))).toBeNull();
  });

  it('rechaza mayúsculas, espacios y acentos', () => {
    expect(validate(new FormControl('Ana'))).toEqual({ invalidUsername: true });
    expect(validate(new FormControl('ana ruiz'))).toEqual({ invalidUsername: true });
    expect(validate(new FormControl('añana'))).toEqual({ invalidUsername: true });
  });
});

describe('phoneValidator', () => {
  it('es deliberadamente permisivo', () => {
    expect(phoneValidator()(new FormControl('+34 618 22 33 44'))).toBeNull();
    expect(phoneValidator()(new FormControl('no es un teléfono'))).toEqual({ invalidPhone: true });
  });
});

describe('matchFields', () => {
  it('marca el error en el campo de confirmación', () => {
    const group = new FormGroup(
      { password: new FormControl('social1234'), confirmation: new FormControl('otra1234') },
      { validators: matchFields('password', 'confirmation') },
    );

    expect(group.errors).toEqual({ passwordMismatch: true });
    expect(group.controls.confirmation.errors).toEqual({ passwordMismatch: true });
  });
});

describe('firstErrorKey', () => {
  it('sólo habla cuando el campo ya se ha tocado', () => {
    const control = new FormControl('', { validators: () => ({ required: true }) });

    expect(firstErrorKey(control)).toBeNull();

    control.markAsTouched();

    expect(firstErrorKey(control)).toBe('FORM.REQUIRED');
  });
});
