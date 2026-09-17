import type { Audience } from '@respet/shared';

/** El icono que acompaña a quién puede ver algo: el mundo, la gente o un candado. */
export function audienceIcon(audience: Audience): string {
  switch (audience) {
    case 'public':
      return 'earth';
    case 'followers':
      return 'people';
    default:
      return 'lock-closed';
  }
}

export const AUDIENCES: readonly { value: Audience; label: string; hint: string; icon: string }[] = [
  { value: 'public', label: 'AUDIENCE.PUBLIC', hint: 'AUDIENCE.PUBLIC_HINT', icon: 'earth' },
  { value: 'followers', label: 'AUDIENCE.FOLLOWERS', hint: 'AUDIENCE.FOLLOWERS_HINT', icon: 'people' },
  { value: 'only_me', label: 'AUDIENCE.ONLY_ME', hint: 'AUDIENCE.ONLY_ME_HINT', icon: 'lock-closed' },
];
