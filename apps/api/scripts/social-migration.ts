import type { mongo } from 'mongoose';

type Db = mongo.Db;
type ObjectId = mongo.ObjectId;

/**
 * Pone al día una base de la versión anterior para la red social completa.
 *
 * Se puede ejecutar tantas veces como se quiera: cada paso comprueba lo que ya
 * está hecho y sólo toca lo que falta. No borra nada de lo antiguo salvo los
 * refresh tokens, que con el sistema de sesiones nuevo ya no sirven —quien
 * tuviera la sesión abierta tendrá que volver a entrar—.
 *
 * Lo usan `npm run migrate:social` y el seed, que escribe documentos a mano y
 * se apoya en esto para dejar contadores y claves como los dejaría la API.
 */
export async function migrateToSocial(db: Db, log: (message: string) => void = console.log): Promise<void> {
  await votesToReactions(db, log);
  await normalizeUsers(db, log);
  await normalizePosts(db, log);
  await rebuildHashtags(db, log);
  await normalizeComments(db, log);
  await normalizeChat(db, log);
  await reportsToGeneric(db, log);
  await dropLegacySessions(db, log);
}

/**
 * Los votos a favor pasan a ser «me gusta».
 *
 * Los votos en contra no tienen equivalente entre las reacciones —Facebook no
 * tiene «no me gusta»— y se quedan en su colección, sin borrar.
 */
async function votesToReactions(db: Db, log: (message: string) => void): Promise<void> {
  const votes = db.collection('post_votes');
  const reactions = db.collection('post_reactions');
  let migrated = 0;

  for await (const vote of votes.find({ value: 'up' })) {
    const result = await reactions.updateOne(
      { postId: vote['postId'], userId: vote['userId'] },
      {
        $setOnInsert: {
          postId: vote['postId'],
          userId: vote['userId'],
          type: 'like',
          createdAt: vote['createdAt'] ?? new Date(),
          updatedAt: vote['updatedAt'] ?? new Date(),
        },
      },
      { upsert: true },
    );

    migrated += result.upsertedCount;
  }

  log(`  reacciones: ${migrated} votos convertidos en «me gusta»`);
}

async function normalizeUsers(db: Db, log: (message: string) => void): Promise<void> {
  const users = db.collection('users');
  const result = await users.updateMany(
    { mfaEnabled: { $exists: false } },
    { $set: { mfaEnabled: false, verified: false, bio: null, website: null, coverId: null, lastSeenAt: null } },
  );

  await db.collection('user_permissions').updateMany(
    { showOnlineStatus: { $exists: false } },
    { $set: { showOnlineStatus: true, storyReplyPolicy: 'everyone', loginAlerts: true } },
  );

  log(`  cuentas: ${result.modifiedCount} con los campos nuevos`);
}

/**
 * Recalcula las cifras que la API guarda en cada publicación.
 *
 * Antes se contaban en cada lectura; ahora viven en el documento y se ajustan
 * con cada cambio. Aquí se calculan desde cero, así que también sirve para
 * cuadrarlas si alguna vez se descuadran.
 */
async function normalizePosts(db: Db, log: (message: string) => void): Promise<void> {
  const posts = db.collection('posts');
  const privateUsers = new Set(
    (await db.collection('user_permissions').find({ privateProfile: true }).project({ userId: 1 }).toArray()).map(
      (doc) => String(doc['userId']),
    ),
  );

  const reactionRows = await db
    .collection('post_reactions')
    .aggregate<{ _id: { postId: ObjectId; type: string }; total: number }>([
      { $group: { _id: { postId: '$postId', type: '$type' }, total: { $sum: 1 } } },
    ])
    .toArray();
  const commentRows = await db
    .collection('comments')
    .aggregate<{ _id: ObjectId; total: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$postId', total: { $sum: 1 } } },
    ])
    .toArray();
  const mediaRows = await db
    .collection('media')
    .aggregate<{ _id: ObjectId; total: number }>([
      { $match: { postId: { $ne: null } } },
      { $group: { _id: '$postId', total: { $sum: 1 } } },
    ])
    .toArray();

  const reactionsByPost = new Map<string, Record<string, number>>();

  for (const row of reactionRows) {
    const key = String(row._id.postId);
    const summary = reactionsByPost.get(key) ?? {};
    summary[row._id.type] = row.total;
    reactionsByPost.set(key, summary);
  }

  const comments = new Map(commentRows.map((row) => [String(row._id), row.total]));
  const media = new Map(mediaRows.map((row) => [String(row._id), row.total]));
  let updated = 0;

  for await (const post of posts.find({}, { projection: { _id: 1, userId: 1, description: 1, audience: 1 } })) {
    const id = String(post._id);
    const summary = reactionsByPost.get(id) ?? {};
    const description = typeof post['description'] === 'string' ? post['description'] : '';

    await posts.updateOne(
      { _id: post._id },
      {
        $set: {
          audience: post['audience'] ?? 'public',
          authorPrivate: privateUsers.has(String(post['userId'])),
          reactions: {
            like: summary['like'] ?? 0,
            love: summary['love'] ?? 0,
            care: summary['care'] ?? 0,
            haha: summary['haha'] ?? 0,
            wow: summary['wow'] ?? 0,
            sad: summary['sad'] ?? 0,
            angry: summary['angry'] ?? 0,
          },
          reactionCount: Object.values(summary).reduce((sum, value) => sum + value, 0),
          commentCount: comments.get(id) ?? 0,
          mediaCount: media.get(id) ?? 0,
          hashtags: extractHashtags(description),
        },
        $setOnInsert: {},
      },
    );

    await posts.updateOne(
      { _id: post._id, shareCount: { $exists: false } },
      { $set: { shareCount: 0, mentionIds: [], sharedPostId: null, commentsDisabled: false, editedAt: null } },
    );

    updated += 1;
  }

  log(`  publicaciones: ${updated} con sus cifras recalculadas`);
}

async function rebuildHashtags(db: Db, log: (message: string) => void): Promise<void> {
  const rows = await db
    .collection('posts')
    .aggregate<{ _id: string; total: number; last: Date }>([
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', total: { $sum: 1 }, last: { $max: '$createdAt' } } },
    ])
    .toArray();

  for (const row of rows) {
    await db.collection('hashtags').updateOne(
      { tag: row._id },
      { $set: { postCount: row.total, lastUsedAt: row.last, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }

  log(`  etiquetas: ${rows.length}`);
}

async function normalizeComments(db: Db, log: (message: string) => void): Promise<void> {
  const result = await db
    .collection('comments')
    .updateMany(
      { parentId: { $exists: false } },
      { $set: { parentId: null, mentionIds: [], likeCount: 0, replyCount: 0, editedAt: null } },
    );

  log(`  comentarios: ${result.modifiedCount} con los campos nuevos`);
}

/**
 * El chat de dos pasa a admitir grupos.
 *
 * Cada conversación existente es de dos: se le pone su clave de pareja —la que
 * hace idempotente abrirla—, los mensajes con imagen pasan su archivo a la
 * lista de adjuntos y cada participante recupera su contador de no leídos.
 */
async function normalizeChat(db: Db, log: (message: string) => void): Promise<void> {
  const conversations = db.collection('conversations');
  const members = db.collection('conversation_members');
  const messages = db.collection('messages');
  const seenKeys = new Set<string>();
  let keyed = 0;

  for await (const conversation of conversations.find({ type: { $exists: false } })) {
    const participants = await members.find({ conversationId: conversation._id }).project({ userId: 1 }).toArray();
    const ids = participants.map((doc) => String(doc['userId'])).sort();
    const directKey = ids.length === 2 ? ids.join(':') : null;
    // Si por un error antiguo había dos conversaciones para la misma pareja, la
    // segunda se queda sin clave: sigue existiendo, pero no choca con el índice.
    const usable = directKey && !seenKeys.has(directKey) && !(await conversations.findOne({ directKey }));

    if (usable && directKey) {
      seenKeys.add(directKey);
    }

    const last = await messages.find({ conversationId: conversation._id }).sort({ _id: -1 }).limit(1).next();

    await conversations.updateOne(
      { _id: conversation._id },
      {
        $set: {
          type: 'direct',
          directKey: usable ? directKey : null,
          title: null,
          photoId: null,
          createdById: participants[0]?.['userId'] ?? null,
          lastMessageId: last?._id ?? null,
          lastSenderId: last?.['senderId'] ?? null,
        },
      },
    );

    keyed += 1;
  }

  const attachments = await messages.updateMany(
    { attachmentIds: { $exists: false } },
    [
      {
        $set: {
          attachmentIds: { $cond: [{ $ifNull: ['$mediaId', false] }, ['$mediaId'], []] },
          reactions: [],
          hiddenFor: [],
          replyToId: null,
          sharedPostId: null,
          storyId: null,
          system: null,
          clientId: null,
          editedAt: null,
        },
      },
      { $unset: 'mediaId' },
    ],
  );

  let counted = 0;

  for await (const member of members.find({ role: { $exists: false } })) {
    const lastReadAt = member['lastReadAt'] as Date | null | undefined;
    const unread = await messages.countDocuments({
      conversationId: member['conversationId'] as ObjectId,
      senderId: { $ne: member['userId'] as ObjectId },
      deletedAt: null,
      ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
    });

    await members.updateOne(
      { _id: member._id },
      {
        $set: {
          role: 'member',
          leftAt: null,
          unreadCount: unread,
          archived: false,
          pinnedAt: null,
          clearedAt: null,
          lastDeliveredAt: member['lastReadAt'] ?? null,
          lastReadMessageId: null,
        },
      },
    );

    counted += 1;
  }

  log(`  chat: ${keyed} conversaciones, ${attachments.modifiedCount} mensajes y ${counted} participaciones al día`);
}

async function reportsToGeneric(db: Db, log: (message: string) => void): Promise<void> {
  let migrated = 0;

  for await (const report of db.collection('post_reports').find()) {
    const post = await db
      .collection('posts')
      .findOne({ _id: report['postId'] as ObjectId }, { projection: { userId: 1 } });
    const result = await db.collection('reports').updateOne(
      { targetType: 'post', targetId: report['postId'], reporterId: report['reporterId'] },
      {
        $setOnInsert: {
          targetType: 'post',
          targetId: report['postId'],
          targetOwnerId: post?.['userId'] ?? null,
          reporterId: report['reporterId'],
          reason: report['reason'],
          status: report['status'] ?? 'pending',
          reviewedById: null,
          reviewedAt: null,
          createdAt: report['createdAt'] ?? new Date(),
          updatedAt: report['updatedAt'] ?? new Date(),
        },
      },
      { upsert: true },
    );

    migrated += result.upsertedCount;
  }

  log(`  denuncias: ${migrated} pasadas al registro general`);
}

async function dropLegacySessions(db: Db, log: (message: string) => void): Promise<void> {
  const collections = await db.listCollections({ name: 'refresh_tokens' }).toArray();

  if (collections.length === 0) {
    return;
  }

  const { deletedCount } = await db.collection('refresh_tokens').deleteMany({});

  log(`  sesiones antiguas: ${deletedCount} refresh tokens retirados (hay que volver a entrar)`);
}

/** Igual que `extractHashtags` de la API; se repite para que el script no arranque Nest. */
function extractHashtags(text: string): string[] {
  const tags = new Set<string>();

  for (const match of text.matchAll(/(?:^|[^\p{L}\p{N}_&])#(\p{L}[\p{L}\p{N}_]{0,49})/gu)) {
    const tag = match[1]?.toLowerCase();

    if (tag) {
      tags.add(tag);
    }
  }

  return [...tags].slice(0, 30);
}
