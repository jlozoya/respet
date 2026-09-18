import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { currentStep, totpAt } from '../src/auth/mfa/totp.js';
import { nextEvent, startHarness, tinyPng, type Harness } from './support/harness.js';

/**
 * La red social de punta a punta, por GraphQL, como la usa la aplicación.
 *
 * Las pruebas comparten estado a propósito y se leen en orden: Ana se registra,
 * activa la verificación en dos pasos, publica; Bruno la sigue, reacciona y le
 * escribe; una aplicación de terceros pide permiso a Ana. Cada paso comprueba
 * lo que el anterior dejó hecho.
 */

const SESSION = 'accessToken refreshToken sessionId user { id name }';

let h: Harness;
const ana = { token: '', refresh: '', id: '', password: 'ana-password-1' };
const bruno = { token: '', id: '' };
let postId = '';
let conversationId = '';

async function register(
  name: string,
  password: string,
): Promise<{ token: string; refresh: string; id: string }> {
  const result = await h.gql<{
    register: { accessToken: string; refreshToken: string; user: { id: string } };
  }>(`mutation($input: RegisterInput!) { register(input: $input) { ${SESSION} } }`, {
    input: {
      name,
      firstName: name,
      lastName: 'Prueba',
      email: `${name}@social-network.test`,
      password,
    },
  });

  expect(result.errors).toBeUndefined();

  return {
    token: result.data!.register.accessToken,
    refresh: result.data!.register.refreshToken,
    id: result.data!.register.user.id,
  };
}

beforeAll(async () => {
  h = await startHarness();
}, 60_000);

afterAll(async () => {
  await h?.close();
});

describe('sesiones', () => {
  it('registra y devuelve el perfil con el token de la sesión', async () => {
    Object.assign(ana, await register('ana', ana.password));
    Object.assign(bruno, await register('bruno', 'bruno-password-1'));

    const me = await h.gql<{ me: { id: string; mfaEnabled: boolean } }>(
      '{ me { id mfaEnabled } }',
      {},
      ana.token,
    );

    expect(me.data?.me).toEqual({ id: ana.id, mfaEnabled: false });
  });

  it('rota el refresh token y cierra la sesión si se reutiliza uno ya canjeado', async () => {
    const first = await h.gql<{ refreshTokens: { refreshToken: string; accessToken: string } }>(
      'mutation($t: String!) { refreshTokens(refreshToken: $t) { accessToken refreshToken } }',
      { t: ana.refresh },
    );

    expect(first.errors).toBeUndefined();

    // Reutilizar el token viejo pasado el margen de carrera se interpreta como
    // robo. Dentro del margen, en cambio, sólo se pide reintentar.
    const race = await h.gql(
      'mutation($t: String!) { refreshTokens(refreshToken: $t) { accessToken } }',
      {
        t: ana.refresh,
      },
    );

    expect(race.errors?.[0]?.extensions?.code).toBe('SERVER.REFRESH_RACE');

    ana.token = first.data!.refreshTokens.accessToken;
    ana.refresh = first.data!.refreshTokens.refreshToken;
  });

  it('cierra una sesión en el acto: el access token deja de valer sin esperar a que caduque', async () => {
    const login = await h.gql<{ login: { session: { accessToken: string; sessionId: string } } }>(
      `mutation { login(input: { email: "ana@social-network.test", password: "${ana.password}" }) { session { accessToken sessionId } } }`,
    );
    const other = login.data!.login.session;

    const sessions = await h.gql<{ mySessions: { id: string; current: boolean }[] }>(
      '{ mySessions { id current } }',
      {},
      ana.token,
    );

    expect(sessions.data!.mySessions.length).toBeGreaterThanOrEqual(2);

    await h.gql(
      'mutation($id: ID!) { revokeSession(id: $id) }',
      { id: other.sessionId },
      ana.token,
    );

    const rejected = await h.gql('{ me { id } }', {}, other.accessToken);

    expect(rejected.errors?.[0]?.extensions?.statusCode).toBe(401);
  });

  it('bloquea la cuenta tras varios intentos fallidos', async () => {
    let last: string | undefined;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const result = await h.gql(
        'mutation { login(input: { email: "nadie@social-network.test", password: "incorrecta1" }) { status } }',
      );
      last = result.errors?.[0]?.extensions?.code;
    }

    expect(last).toMatch(/SERVER\.(ACCOUNT_LOCKED|TOO_MANY_REQUESTS)/);
  });
});

describe('verificación en dos pasos', () => {
  let secret = '';
  let recoveryCodes: string[] = [];

  it('pide la contraseña para empezar y activa la app con un código', async () => {
    const withoutPassword = await h.gql('mutation { beginTotpSetup { secret } }', {}, ana.token);

    expect(withoutPassword.errors?.[0]?.extensions?.code).toBe('SERVER.REAUTH_REQUIRED');

    const setup = await h.gql<{ beginTotpSetup: { secret: string; qrCodeDataUrl: string } }>(
      'mutation($r: ReauthInput) { beginTotpSetup(reauth: $r) { secret qrCodeDataUrl } }',
      { r: { password: ana.password } },
      ana.token,
    );

    secret = setup.data!.beginTotpSetup.secret;
    expect(setup.data!.beginTotpSetup.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const confirm = await h.gql<{ confirmTotpSetup: { codes: string[] } }>(
      'mutation($code: String!) { confirmTotpSetup(input: { code: $code }) { codes } }',
      { code: totpAt(secret, currentStep()) },
      ana.token,
    );

    expect(confirm.errors).toBeUndefined();
    recoveryCodes = confirm.data!.confirmTotpSetup.codes;
    expect(recoveryCodes).toHaveLength(10);
  });

  it('pide el segundo factor al entrar y lo completa con un código de recuperación', async () => {
    const login = await h.gql<{
      login: { status: string; session: null; challenge: { token: string } };
    }>(
      `mutation { login(input: { email: "ana@social-network.test", password: "${ana.password}" }) { status session { accessToken } challenge { token } } }`,
    );

    expect(login.data!.login.status).toBe('mfa_required');
    expect(login.data!.login.session).toBeNull();

    const wrong = await h.gql(
      'mutation($t: String!) { completeMfaLogin(input: { challengeToken: $t, method: totp, code: "000000" }) { accessToken } }',
      { t: login.data!.login.challenge.token },
    );

    expect(wrong.errors?.[0]?.extensions?.code).toBe('SERVER.INVALID_MFA_CODE');

    const done = await h.gql<{
      completeMfaLogin: { accessToken: string; trustedDeviceToken: string };
    }>(
      'mutation($t: String!, $c: String!) { completeMfaLogin(input: { challengeToken: $t, method: recovery_code, code: $c, trustDevice: true }) { accessToken trustedDeviceToken } }',
      { t: login.data!.login.challenge.token, c: recoveryCodes[0] },
    );

    expect(done.errors).toBeUndefined();
    expect(done.data!.completeMfaLogin.trustedDeviceToken).toBeTruthy();

    // Con el dispositivo de confianza ya no se pregunta.
    const trusted = await h.gql<{ login: { status: string; session: { accessToken: string } } }>(
      'mutation($d: String!) { login(input: { email: "ana@social-network.test", password: "ana-password-1", trustedDeviceToken: $d }) { status session { accessToken } } }',
      { d: done.data!.completeMfaLogin.trustedDeviceToken },
    );

    expect(trusted.data!.login.status).toBe('authenticated');
    ana.token = trusted.data!.login.session.accessToken;
  });
});

describe('publicaciones, reacciones y avisos', () => {
  it('publica con una foto subida en la propia mutación', async () => {
    const png = await tinyPng();
    const result = await h.upload<{
      createPost: { id: string; media: { type: string; url: string }[]; hashtags: string[] };
    }>(
      'mutation($input: CreatePostInput!, $files: [Upload!]) { createPost(input: $input, files: $files) { id media { type url } hashtags } }',
      {
        input: { description: 'Hola #EnPruebas desde las pruebas', audience: 'public' },
        files: [null],
      },
      { 'files.0': { name: 'foto.png', type: 'image/png', data: png } },
      ana.token,
    );

    expect(result.errors).toBeUndefined();
    postId = result.data!.createPost.id;
    expect(result.data!.createPost.media).toHaveLength(1);
    expect(result.data!.createPost.media[0].url).toMatch(/\.webp$/);
    expect(result.data!.createPost.hashtags).toEqual(['enpruebas']);
  });

  it('rechaza un archivo que no es lo que dice ser', async () => {
    const result = await h.upload(
      'mutation($file: Upload!) { updateMyAvatar(file: $file) { id } }',
      { file: null },
      {
        file: {
          name: 'foto.png',
          type: 'image/png',
          data: Buffer.from('<html><script>alert(1)</script></html>'),
        },
      },
      ana.token,
    );

    expect(result.errors?.[0]?.extensions?.code).toBe('SERVER.UNSUPPORTED_MEDIA');
  });

  it('avisa en vivo a la autora cuando alguien reacciona', async () => {
    const client = h.ws(ana.token);
    const event = nextEvent<{
      notificationEvents: { notification: { type: string; actors: { id: string }[] } };
    }>(
      client,
      'subscription { notificationEvents { type unreadCount notification { type actors { id } } } }',
      {},
      (data) => data.notificationEvents.notification?.type === 'reaction',
    );

    await event.ready;

    const reaction = await h.gql<{ reactToPost: { reactionCount: number; myReaction: string } }>(
      'mutation($id: ID!) { reactToPost(id: $id, type: love) { reactionCount myReaction } }',
      { id: postId },
      bruno.token,
    );

    expect(reaction.data!.reactToPost).toEqual({ reactionCount: 1, myReaction: 'love' });

    const received = await event.promise;

    expect(received.notificationEvents.notification.actors[0].id).toBe(bruno.id);
  });

  it('cuenta comentarios y respuestas y los enseña bajo la tarjeta', async () => {
    const comment = await h.gql<{ createComment: { id: string } }>(
      'mutation($p: ID!) { createComment(postId: $p, input: { body: "¡Qué bien, @ana!" }) { id } }',
      { p: postId },
      bruno.token,
    );

    await h.gql(
      'mutation($p: ID!, $c: ID!) { createComment(postId: $p, input: { body: "Gracias", parentId: $c }) { id } }',
      { p: postId, c: comment.data!.createComment.id },
      ana.token,
    );

    const post = await h.gql<{
      post: { commentCount: number; commentPreview: { replyCount: number }[] };
    }>(
      'query($id: ID!) { post(id: $id) { commentCount commentPreview { replyCount } } }',
      { id: postId },
      bruno.token,
    );

    expect(post.data!.post.commentCount).toBe(2);
    expect(post.data!.post.commentPreview[0].replyCount).toBe(1);
  });

  it('respeta la privacidad: con el perfil privado sólo lo ven los seguidores', async () => {
    await h.gql(
      'mutation { updatePermissions(input: { privateProfile: true }) { privateProfile } }',
      {},
      ana.token,
    );

    const hidden = await h.gql(
      'query($id: ID!) { post(id: $id) { id } }',
      { id: postId },
      bruno.token,
    );

    expect(hidden.errors?.[0]?.extensions?.code).toBe('SERVER.NOT_FOUND');

    const follow = await h.gql<{ followUser: { followState: string } }>(
      'mutation($id: ID!) { followUser(id: $id) { followState } }',
      { id: ana.id },
      bruno.token,
    );

    expect(follow.data!.followUser.followState).toBe('requested');

    const requests = await h.gql<{ myFollowRequests: { data: { id: string }[] } }>(
      '{ myFollowRequests { data { id } } }',
      {},
      ana.token,
    );

    await h.gql(
      'mutation($id: ID!) { acceptFollowRequest(id: $id) { followerCount } }',
      { id: requests.data!.myFollowRequests.data[0].id },
      ana.token,
    );

    const visible = await h.gql(
      'query($id: ID!) { post(id: $id) { id } }',
      { id: postId },
      bruno.token,
    );

    expect(visible.errors).toBeUndefined();
  });
});

describe('chat', () => {
  it('no duplica un mensaje reenviado con el mismo clientId y lo entrega en vivo', async () => {
    const start = await h.gql<{ startConversation: { id: string } }>(
      'mutation($u: ID!) { startConversation(userId: $u) { id } }',
      { u: ana.id },
      bruno.token,
    );

    conversationId = start.data!.startConversation.id;

    const client = h.ws(ana.token);
    const event = nextEvent<{
      chatEvents: { type: string; message: { body: string; status: string | null } };
    }>(
      client,
      'subscription { chatEvents { type message { body status } } }',
      {},
      (data) => data.chatEvents.type === 'message_created',
    );

    await event.ready;

    const send = (): Promise<{ data: { sendMessage: { id: string } } | null }> =>
      h.gql<{ sendMessage: { id: string } }>(
        'mutation($c: ID!) { sendMessage(conversationId: $c, input: { clientId: "cliente-00000001", body: "Hola Ana" }) { id } }',
        { c: conversationId },
        bruno.token,
      );

    const first = await send();
    const retry = await send();

    expect(retry.data!.sendMessage.id).toBe(first.data!.sendMessage.id);

    const received = await event.promise;

    expect(received.chatEvents.message.body).toBe('Hola Ana');
    // El estado de entrega sólo lo ve quien envía.
    expect(received.chatEvents.message.status).toBeNull();
  });

  it('marca el mensaje como leído para quien lo envió', async () => {
    await h.gql(
      'mutation($c: ID!) { markConversationRead(id: $c) }',
      { c: conversationId },
      ana.token,
    );

    const messages = await h.gql<{ messages: { data: { status: string }[] } }>(
      'query($c: ID!) { messages(conversationId: $c) { data { status } } }',
      { c: conversationId },
      bruno.token,
    );

    expect(messages.data!.messages.data.at(-1)!.status).toBe('read');
  });
});

describe('historias', () => {
  it('publica una historia de texto y aparece sin ver en la barra de quien sigue', async () => {
    const created = await h.gql<{ createStory: { id: string; kind: string } }>(
      'mutation { createStory(input: { text: "Buenos días", background: "ocean" }) { id kind } }',
      {},
      ana.token,
    );

    expect(created.data!.createStory.kind).toBe('text');

    const feed = await h.gql<{ storyFeed: { user: { id: string }; hasUnseen: boolean }[] }>(
      '{ storyFeed { user { id } hasUnseen } }',
      {},
      bruno.token,
    );

    expect(feed.data!.storyFeed).toContainEqual({ user: { id: ana.id }, hasUnseen: true });

    await h.gql(
      'mutation($id: ID!) { markStoryViewed(id: $id) }',
      { id: created.data!.createStory.id },
      bruno.token,
    );

    const viewers = await h.gql<{ storyViewers: { meta: { total: number } } }>(
      'query($id: ID!) { storyViewers(id: $id) { meta { total } } }',
      { id: created.data!.createStory.id },
      ana.token,
    );

    expect(viewers.data!.storyViewers.meta.total).toBe(1);
  });
});

describe('API para terceros', () => {
  it('autoriza una aplicación con OAuth y limita lo que puede hacer a sus permisos', async () => {
    const created = await h.gql<{
      createDeveloperApp: { app: { id: string; clientId: string }; clientSecret: string };
    }>(
      'mutation { createDeveloperApp(input: { name: "Mi app", redirectUris: ["https://example.com/callback"], allowedScopes: ["user_posts"] }) { app { id clientId } clientSecret } }',
      {},
      bruno.token,
    );
    const { app, clientSecret } = created.data!.createDeveloperApp;

    // En desarrollo, sólo su dueño puede autorizarla.
    const foreign = await h.gql(
      'mutation($i: OAuthAuthorizeInput!) { approveOAuthAuthorization(input: $i) { redirectTo } }',
      {
        i: {
          clientId: app.clientId,
          redirectUri: 'https://example.com/callback',
          scope: 'user_posts',
        },
      },
      ana.token,
    );

    expect(foreign.errors).toBeDefined();

    const approved = await h.gql<{ approveOAuthAuthorization: { redirectTo: string } }>(
      'mutation($i: OAuthAuthorizeInput!) { approveOAuthAuthorization(input: $i) { redirectTo } }',
      {
        i: {
          clientId: app.clientId,
          redirectUri: 'https://example.com/callback',
          scope: 'user_posts',
          state: 'xyz',
        },
      },
      bruno.token,
    );
    const redirect = new URL(approved.data!.approveOAuthAuthorization.redirectTo);

    expect(redirect.searchParams.get('state')).toBe('xyz');

    const tokenResponse = await fetch(`${h.url}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: redirect.searchParams.get('code') ?? '',
        redirect_uri: 'https://example.com/callback',
        client_id: app.clientId,
        client_secret: clientSecret,
      }),
    });
    const tokens = (await tokenResponse.json()) as { access_token: string; scope: string };

    expect(tokenResponse.status).toBe(200);
    expect(tokens.scope).toBe('public_profile user_posts');

    const me = await h.gql<{ me: { id: string } }>('{ me { id } }', {}, tokens.access_token);

    expect(me.data!.me.id).toBe(bruno.id);

    const forbidden = await h.gql('{ mySessions { id } }', {}, tokens.access_token);

    expect(forbidden.errors?.[0]?.extensions?.code).toBe('SERVER.INSUFFICIENT_SCOPE');

    const authorized = await h.gql<{ authorizedApps: { id: string }[] }>(
      '{ authorizedApps { id } }',
      {},
      bruno.token,
    );

    await h.gql(
      'mutation($id: ID!) { revokeAuthorizedApp(id: $id) }',
      { id: authorized.data!.authorizedApps[0].id },
      bruno.token,
    );

    const revoked = await h.gql('{ me { id } }', {}, tokens.access_token);

    expect(revoked.errors?.[0]?.extensions?.statusCode).toBe(401);
  });

  it('rechaza consultas demasiado profundas o costosas', async () => {
    const deep = await h.gql(
      '{ posts { data { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { sharedPost { id } } } } } } } } } } } } } }',
    );

    expect(deep.errors?.[0]?.extensions?.code).toBe('SERVER.QUERY_TOO_COMPLEX');
  });
});
