import { describe, expect, it } from 'vitest';

import { storyBackground, storyFont } from '../../components/stories/story-style';
import { formatDuration } from '../pipes/duration.pipe';
import { fullName } from '../pipes/full-name.pipe';
import { audienceIcon } from './audience';
import { dayLabel, sameDay } from './dates';
import { reactionEmoji, reactionLabel } from './reactions';

describe('formatDuration', () => {
  it('escribe los milisegundos como minutos y segundos', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9500)).toBe('0:10');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(null)).toBe('0:00');
  });
});

describe('fullName', () => {
  it('junta nombre y apellidos', () => {
    expect(fullName({ firstName: 'Ana', lastName: 'Ruiz', name: 'ana' })).toBe('Ana Ruiz');
  });

  it('recurre al nombre de usuario cuando no hay más', () => {
    expect(fullName({ name: 'ana' })).toBe('ana');
    expect(fullName(null)).toBe('');
  });
});

describe('audienceIcon', () => {
  it('da el icono de quién puede verlo', () => {
    expect(audienceIcon('public')).toBe('earth');
    expect(audienceIcon('followers')).toBe('people');
    expect(audienceIcon('only_me')).toBe('lock-closed');
  });
});

describe('reacciones', () => {
  it('tiene emoji y rótulo para cada una', () => {
    expect(reactionEmoji('love')).toBe('❤️');
    expect(reactionLabel('haha')).toBe('REACTIONS.HAHA');
  });
});

describe('historias', () => {
  it('cae en un fondo y una tipografía conocidos', () => {
    expect(storyBackground('ocean')).toContain('gradient');
    expect(storyBackground('lo-que-sea')).toBe(storyBackground('sunset'));
    expect(storyFont('typewriter')).toContain('Courier');
  });
});

describe('fechas', () => {
  it('sabe si dos momentos caen el mismo día', () => {
    // En hora local, que es como se leen los días en la pantalla.
    const manana = new Date(2026, 8, 17, 9, 0);
    const noche = new Date(2026, 8, 17, 23, 30);
    const otroDia = new Date(2026, 8, 18, 0, 30);

    expect(sameDay(manana, noche)).toBe(true);
    expect(sameDay(noche, otroDia)).toBe(false);
  });

  it('escribe «hoy» y «ayer» en lugar de la fecha', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(dayLabel(now.toISOString(), 'es', 'Hoy', 'Ayer')).toBe('Hoy');
    expect(dayLabel(yesterday.toISOString(), 'es', 'Hoy', 'Ayer')).toBe('Ayer');
    expect(dayLabel('2020-01-15T12:00:00.000Z', 'es', 'Hoy', 'Ayer')).toContain('2020');
  });
});
