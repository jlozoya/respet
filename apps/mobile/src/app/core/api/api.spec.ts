import { describe, expect, it } from 'vitest';

import { previewOf } from './chat.service';
import { operationNameOf } from './graphql-client.service';
import { notificationLink } from './notifications.service';
import { applyPostChange } from './posts.service';

describe('operationNameOf', () => {
  it('saca el nombre de la operación del documento', () => {
    expect(
      operationNameOf('query Posts($query: PostListQueryInput) { posts { data { id } } }'),
    ).toBe('Posts');
    expect(
      operationNameOf('mutation CreatePost($input: CreatePostInput!) { createPost { id } }'),
    ).toBe('CreatePost');
    expect(operationNameOf('subscription ChatEvents { chatEvents { type } }')).toBe('ChatEvents');
  });

  it('devuelve vacío en una operación sin nombre', () => {
    expect(operationNameOf('{ me { id } }')).toBe('');
  });
});

describe('applyPostChange', () => {
  const posts = [
    { id: 'a', reactionCount: 1 },
    { id: 'b', reactionCount: 0 },
  ];

  it('mezcla los cambios en la publicación que toca', () => {
    const result = applyPostChange(posts, {
      type: 'updated',
      id: 'b',
      changes: { reactionCount: 5 },
    });

    expect(result[1]).toEqual({ id: 'b', reactionCount: 5 });
    // Las demás se quedan como estaban, con la misma referencia.
    expect(result[0]).toBe(posts[0]);
  });

  it('quita la publicación borrada', () => {
    expect(applyPostChange(posts, { type: 'deleted', id: 'a' }).map((post) => post.id)).toEqual([
      'b',
    ]);
  });
});

describe('previewOf', () => {
  it('resume el último mensaje para la bandeja', () => {
    expect(previewOf({ kind: 'text', body: 'Hola', deleted: false })).toBe('Hola');
    expect(previewOf({ kind: 'image', body: null, deleted: false })).toBe('📷');
    expect(previewOf({ kind: 'audio', body: null, deleted: false })).toBe('🎤');
  });

  it('no enseña nada de un mensaje retirado', () => {
    expect(previewOf({ kind: 'text', body: 'Hola', deleted: true })).toBe('');
  });
});

describe('notificationLink', () => {
  const base = {
    id: '1',
    actorCount: 1,
    actors: [
      { id: 'u1', name: 'ana', firstName: 'Ana', lastName: 'Ruiz', avatar: null, verified: false },
    ],
    commentId: null,
    liveStreamId: null,
    postId: null,
    storyId: null,
    preview: null,
    thumbnail: null,
    read: false,
    createdAt: '',
    updatedAt: '',
  };

  it('lleva al perfil de quien te sigue', () => {
    expect(notificationLink({ ...base, type: 'follow' })).toBe('/profile/ana');
  });

  it('lleva a la publicación comentada', () => {
    expect(notificationLink({ ...base, type: 'comment', postId: 'p1' })).toBe('/post/p1');
  });

  it('lleva al directo que ha empezado', () => {
    expect(notificationLink({ ...base, type: 'live_started', liveStreamId: 'l1' })).toBe(
      '/live/l1',
    );
  });

  it('lleva a seguridad con un aviso de la cuenta', () => {
    expect(notificationLink({ ...base, type: 'security_alert' })).toBe('/settings/security');
  });
});
