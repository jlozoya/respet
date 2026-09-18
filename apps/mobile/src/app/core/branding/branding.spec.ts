import { describe, expect, it } from 'vitest';

import { contrastOf, rgbOf, shadeOf, tintOf } from './color';

/**
 * El color de la marca lo decide quien despliega, así que los tonos que Ionic
 * necesita alrededor se calculan aquí. Si esto se rompe, la interfaz sale con
 * botones ilegibles y nadie se entera hasta verlo.
 */
describe('tonos de la marca', () => {
  it('convierte a la tripleta que espera Ionic', () => {
    expect(rgbOf('#f05a22')).toBe('240, 90, 34');
    expect(rgbOf('f05a22')).toBe('240, 90, 34');
  });

  it('admite la forma corta de tres dígitos', () => {
    expect(rgbOf('#fff')).toBe('255, 255, 255');
  });

  it('con un color imposible se queda en negro en lugar de reventar', () => {
    expect(rgbOf('rojo')).toBe('0, 0, 0');
  });

  it('el tono de pulsado es más oscuro y el de fondo más claro', () => {
    expect(shadeOf('#f05a22')).toBe('#d34f1e');
    expect(tintOf('#f05a22')).toBe('#f26b38');
  });

  it('elige el texto que se lee encima', () => {
    expect(contrastOf('#f05a22')).toBe('#ffffff');
    expect(contrastOf('#1c1e21')).toBe('#ffffff');
    expect(contrastOf('#f7b928')).toBe('#000000');
    expect(contrastOf('#ffffff')).toBe('#000000');
  });
});
