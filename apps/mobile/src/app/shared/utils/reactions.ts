import { REACTION_EMOJI, type ReactionType } from '@social-network/shared';

/** Las reacciones en el orden en que se ofrecen, como en Facebook. */
export const REACTIONS: readonly ReactionType[] = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];

export function reactionEmoji(type: ReactionType): string {
  return REACTION_EMOJI[type];
}

/** Clave de traducción del nombre de una reacción: «Me gusta», «Me encanta»… */
export function reactionLabel(type: ReactionType): string {
  return `REACTIONS.${type.toUpperCase()}`;
}

/** El color con que se pinta el botón una vez elegida la reacción. */
export function reactionColor(type: ReactionType): string {
  switch (type) {
    case 'like':
      return 'var(--rs-reaction-like)';
    case 'love':
      return 'var(--rs-reaction-love)';
    case 'angry':
      return 'var(--rs-reaction-angry)';
    default:
      return 'var(--rs-reaction-yellow)';
  }
}

/** Los emojis que se ofrecen para reaccionar a un mensaje o una historia. */
export const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;
