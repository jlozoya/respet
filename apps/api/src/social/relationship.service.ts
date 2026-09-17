import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { AppException, ErrorCode } from '../common/errors.js';
import { isValidObjectId, ObjectId, type Model, type Types } from '../database/mongoose.js';
import { Follow } from '../database/schemas/content.schema.js';
import { Audience, FollowState, MessagePolicy } from '../database/schemas/enums.js';
import { Block, User, UserPermissions } from '../database/schemas/user.schema.js';

/** Lo que hace falta saber para decidir si alguien puede ver algo. */
export interface ViewerContext {
  viewerId: string | null;
  /** A quiénes sigue, con la solicitud aceptada. */
  followingIds: Set<string>;
  /** Con quiénes hay un bloqueo, en cualquiera de los dos sentidos. */
  blockedIds: Set<string>;
}

/**
 * Cómo se relacionan dos personas: si se siguen, si se han bloqueado y, a
 * partir de ahí, qué puede ver o hacer una respecto de la otra.
 *
 * Es la única fuente de estas reglas. Antes cada servicio miraba los
 * seguimientos a su manera; con perfiles privados, audiencias y bloqueos,
 * repetir la lógica en el muro, las historias, el chat y los directos era
 * garantizar que alguno se equivocara.
 */
@Injectable()
export class RelationshipService {
  constructor(
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    @InjectModel(Block.name) private readonly blocks: Model<Block>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
  ) {}

  /** Seguimientos y bloqueos de quien mira, de una vez, para filtrar listados enteros. */
  async viewerContext(viewerId: string | null): Promise<ViewerContext> {
    if (!viewerId) {
      return { viewerId: null, followingIds: new Set(), blockedIds: new Set() };
    }

    const [following, blocked] = await Promise.all([
      this.followingIds(viewerId),
      this.blockedIds(viewerId),
    ]);

    return { viewerId, followingIds: new Set(following.map(String)), blockedIds: blocked };
  }

  /** A quién sigue alguien, sólo solicitudes aceptadas. */
  async followingIds(userId: string): Promise<Types.ObjectId[]> {
    const docs = await this.follows
      .find({ followerId: userId, pending: { $ne: true } })
      .select('followeeId')
      .lean();

    return docs.map((doc) => doc.followeeId);
  }

  async followerIds(userId: string): Promise<Types.ObjectId[]> {
    const docs = await this.follows
      .find({ followeeId: userId, pending: { $ne: true } })
      .select('followerId')
      .lean();

    return docs.map((doc) => doc.followerId);
  }

  /** Con quién hay un bloqueo, en cualquiera de los dos sentidos. */
  async blockedIds(userId: string): Promise<Set<string>> {
    const docs = await this.blocks
      .find({ $or: [{ blockerId: userId }, { blockedId: userId }] })
      .select('blockerId blockedId')
      .lean();

    return new Set(
      docs.map((doc) => (String(doc.blockerId) === userId ? String(doc.blockedId) : String(doc.blockerId))),
    );
  }

  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    if (a === b) {
      return false;
    }

    return (
      (await this.blocks.exists({
        $or: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      })) !== null
    );
  }

  async hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return (await this.blocks.exists({ blockerId, blockedId })) !== null;
  }

  async followState(viewerId: string | null, targetId: string): Promise<FollowState | null> {
    if (!viewerId || viewerId === targetId) {
      return null;
    }

    const follow = await this.follows.findOne({ followerId: viewerId, followeeId: targetId }).select('pending').lean();

    if (!follow) {
      return FollowState.None;
    }

    return follow.pending ? FollowState.Requested : FollowState.Following;
  }

  /** En qué punto sigue quien mira a cada una de estas personas. */
  async followStates(viewerId: string | null, targetIds: string[]): Promise<Map<string, FollowState>> {
    const states = new Map<string, FollowState>();

    if (!viewerId) {
      return states;
    }

    const ids = [...new Set(targetIds.filter((id) => id && id !== viewerId && isValidObjectId(id)))];

    for (const id of ids) {
      states.set(id, FollowState.None);
    }

    if (ids.length === 0) {
      return states;
    }

    const docs = await this.follows
      .find({ followerId: viewerId, followeeId: { $in: ids } })
      .select('followeeId pending')
      .lean();

    for (const doc of docs) {
      states.set(String(doc.followeeId), doc.pending ? FollowState.Requested : FollowState.Following);
    }

    return states;
  }

  async isPrivate(userId: string): Promise<boolean> {
    const doc = await this.permissions.findOne({ userId }).select('privateProfile').lean();

    return doc?.privateProfile === true;
  }

  /**
   * Si quien mira puede ver el contenido de alguien: sus publicaciones, sus
   * historias, sus seguidores.
   *
   * Lo propio siempre; con un bloqueo por medio, nunca; con el perfil
   * privado, sólo quien lo sigue.
   */
  async canViewContentOf(viewerId: string | null, ownerId: string): Promise<boolean> {
    if (viewerId === ownerId) {
      return true;
    }

    if (viewerId && (await this.isBlockedBetween(viewerId, ownerId))) {
      return false;
    }

    if (!(await this.isPrivate(ownerId))) {
      return true;
    }

    return (await this.followState(viewerId, ownerId)) === FollowState.Following;
  }

  /** Lanza «privado» si quien mira no puede ver el contenido de alguien. */
  async assertCanViewContentOf(viewerId: string | null, ownerId: string): Promise<void> {
    if (!(await this.canViewContentOf(viewerId, ownerId))) {
      throw AppException.forbiddenWith(ErrorCode.PrivateContent, 'This content is private');
    }
  }

  /**
   * Si quien mira puede ver algo con esa audiencia.
   *
   * Síncrono y con el contexto ya cargado, para filtrar listados enteros sin
   * una consulta por elemento.
   */
  canSee(
    context: ViewerContext,
    item: { ownerId: string; audience: Audience; ownerPrivate: boolean },
  ): boolean {
    if (context.viewerId === item.ownerId) {
      return true;
    }

    if (context.blockedIds.has(item.ownerId) || item.audience === Audience.OnlyMe) {
      return false;
    }

    if (item.audience === Audience.Followers || item.ownerPrivate) {
      return context.followingIds.has(item.ownerId);
    }

    return true;
  }

  /**
   * Filtro de Mongo con las publicaciones que puede ver quien mira.
   *
   * La versión en consulta de `canSee`, para el muro y los listados.
   */
  visiblePostsFilter(context: ViewerContext, ownerField = 'userId'): Record<string, unknown> {
    const blocked = [...context.blockedIds].map((id) => new ObjectId(id));
    const following = [...context.followingIds].map((id) => new ObjectId(id));

    const visible: Record<string, unknown>[] = [
      { audience: Audience.Public, authorPrivate: { $ne: true } },
    ];

    if (following.length > 0) {
      visible.push({ [ownerField]: { $in: following }, audience: { $in: [Audience.Public, Audience.Followers] } });
    }

    if (context.viewerId) {
      visible.push({ [ownerField]: new ObjectId(context.viewerId) });
    }

    return {
      $and: [
        ...(blocked.length > 0 ? [{ [ownerField]: { $nin: blocked } }] : []),
        { $or: visible },
      ],
    };
  }

  /**
   * Si `writerId` puede abrir una conversación con `targetId`.
   *
   * Lo decide la destinataria en sus ajustes: cualquiera, sólo a quienes
   * sigue, o nadie. Con «sólo a quienes sigo» lo que se mira es que ella siga
   * a quien escribe —no al revés—: la idea es que no lleguen mensajes de
   * desconocidos, y seguir a alguien no es autorizarle a escribirte.
   */
  async canMessage(writerId: string, targetId: string, policyField: 'messagePolicy' | 'storyReplyPolicy' = 'messagePolicy'): Promise<boolean> {
    if (writerId === targetId) {
      return false;
    }

    if (await this.isBlockedBetween(writerId, targetId)) {
      return false;
    }

    const doc = await this.permissions.findOne({ userId: targetId }).select(policyField).lean();
    const policy = doc?.[policyField] ?? MessagePolicy.Everyone;

    if (policy === MessagePolicy.Everyone) {
      return true;
    }

    if (policy === MessagePolicy.Following) {
      return (await this.followState(targetId, writerId)) === FollowState.Following;
    }

    return false;
  }

  /** Cuántos de los que sigue quien mira siguen también a esta persona. */
  async mutualFollowerCount(viewerId: string | null, targetId: string): Promise<number> {
    if (!viewerId || viewerId === targetId) {
      return 0;
    }

    const following = await this.followingIds(viewerId);

    if (following.length === 0) {
      return 0;
    }

    return this.follows.countDocuments({
      followeeId: targetId,
      followerId: { $in: following },
      pending: { $ne: true },
    });
  }

  /** Los usuarios existentes con esos nombres, sin los bloqueados. Para resolver menciones. */
  async resolveUsernames(names: string[], authorId: string): Promise<Types.ObjectId[]> {
    if (names.length === 0) {
      return [];
    }

    const [users, blocked] = await Promise.all([
      this.users.find({ name: { $in: names } }).select('_id').lean(),
      this.blockedIds(authorId),
    ]);

    return users.filter((user) => !blocked.has(String(user._id))).map((user) => user._id);
  }
}
