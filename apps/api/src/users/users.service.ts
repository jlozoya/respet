import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  Media,
  Paginated,
  User,
  UserContact,
  UserEmail as UserEmailDto,
  UserPermissions as UserPermissionsDto,
  UserPhone as UserPhoneDto,
  UserRole,
  UserSummary,
} from '@social-network/shared';

import { AuthService } from '../auth/auth.service.js';
import { SessionService } from '../auth/session/session.service.js';
import { AppException, ErrorCode } from '../common/errors.js';
import {
  POPULATE_USER,
  toLocation,
  toMedia,
  toPermissions,
  toUser,
  toUserSummary,
} from '../common/mappers.js';
import { upsertLocation } from '../common/utils/location.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { escapeRegex } from '../common/utils/regex.js';
import { isValidObjectId, type Model } from '../database/mongoose.js';
import { Follow, Location, Post } from '../database/schemas/content.schema.js';
import { FollowState, NotificationType, SessionEndReason } from '../database/schemas/enums.js';
import {
  SocialLink,
  User as UserDoc,
  UserEmail,
  UserPermissions,
  UserPhone,
} from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';
import { AccountCleanup } from './account-cleanup.service.js';
import type { PendingUpload } from '../media/upload.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventBusService } from '../realtime/event-bus.service.js';
import { DomainEvent, Topic } from '../realtime/topics.js';
import { RelationshipService } from '../social/relationship.service.js';
import type {
  AddEmailsDto,
  AddPhonesDto,
  UpdateEmailDto,
  UpdateLocationDto,
  UpdatePermissionsDto,
  UpdateProfileDto,
  UserListQueryDto,
} from './dto/user.dto.js';

/** Filtro de búsqueda, tal y como lo entiende `find`. */
type Filtro = Record<string, unknown>;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserDoc.name) private readonly users: Model<UserDoc>,
    @InjectModel(UserPermissions.name) private readonly permissions: Model<UserPermissions>,
    @InjectModel(UserEmail.name) private readonly emails: Model<UserEmail>,
    @InjectModel(UserPhone.name) private readonly phones: Model<UserPhone>,
    @InjectModel(SocialLink.name) private readonly socialLinks: Model<SocialLink>,
    @InjectModel(Follow.name) private readonly follows: Model<Follow>,
    @InjectModel(Post.name) private readonly posts: Model<Post>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
    private readonly media: MediaService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly relationships: RelationshipService,
    private readonly notifications: NotificationsService,
    private readonly bus: EventBusService,
    private readonly cleanup: AccountCleanup,
  ) {}

  async findById(id: string, viewerId: string | null = null): Promise<User> {
    const doc = await this.findDocOrFail(id);

    return toUser(doc as never, await this.followInfo(id, viewerId));
  }

  /**
   * Empieza a seguir a alguien, o lo solicita.
   *
   * Sin reciprocidad: es lo que permite armar un muro de seguidos sin esperar
   * a nadie. Con el perfil privado, en cambio, el vínculo nace pendiente y no
   * cuenta hasta que su dueño responda.
   *
   * Repetir la llamada no añade nada —el índice único sobre el par lo impide—
   * y tampoco reabre lo ya resuelto: `$setOnInsert` sólo escribe al crear, así
   * que volver a pulsar sobre una solicitud pendiente la deja como está en
   * lugar de reiniciarla.
   */
  async follow(followerId: string, followeeId: string): Promise<FollowResult> {
    if (followerId === followeeId) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'You cannot follow yourself');
    }

    await this.assertExists(followeeId);

    if (await this.relationships.isBlockedBetween(followerId, followeeId)) {
      throw AppException.forbiddenWith(ErrorCode.Blocked, 'You cannot follow this person');
    }

    const pending = await this.relationships.isPrivate(followeeId);

    const result = await this.follows.updateOne(
      { followerId, followeeId },
      { $setOnInsert: { followerId, followeeId, pending } },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      await this.notifications.notify({
        recipientId: followeeId,
        actorId: followerId,
        type: pending ? NotificationType.FollowRequest : NotificationType.Follow,
      });

      if (!pending) {
        await this.bus.publish(Topic.domain(DomainEvent.FollowCreated), { followerId, followeeId });
      }
    }

    return {
      followerCount: await this.countFollowers(followeeId),
      followState:
        (await this.relationships.followState(followerId, followeeId)) ?? FollowState.None,
    };
  }

  /**
   * Deja de seguir, o retira la solicitud.
   *
   * Es la misma operación: en los dos casos se borra el vínculo, y quien lo
   * pidió puede desdecirse mientras no le hayan contestado.
   */
  async unfollow(followerId: string, followeeId: string): Promise<FollowResult> {
    await this.assertExists(followeeId);

    const existing = await this.follows.findOneAndDelete({ followerId, followeeId }).lean();

    if (existing) {
      await this.notifications.retract({
        recipientId: followeeId,
        actorId: followerId,
        type: existing.pending ? NotificationType.FollowRequest : NotificationType.Follow,
      });
    }

    return {
      followerCount: await this.countFollowers(followeeId),
      followState: FollowState.None,
    };
  }

  /** Quita a alguien de tus seguidores sin bloquearle, como en Instagram. */
  async removeFollower(userId: string, followerId: string): Promise<FollowRequestResult> {
    await this.follows.deleteOne({ followerId, followeeId: userId });

    return { followerCount: await this.countFollowers(userId) };
  }

  /**
   * Las solicitudes que a alguien le quedan por responder.
   *
   * Sólo llegan aquí las de un perfil privado, que es el único que las genera;
   * en uno público la lista sale vacía porque seguir no espera a nadie.
   */
  async followRequests(userId: string, query: UserListQueryDto): Promise<Paginated<FollowRequest>> {
    const where = { followeeId: userId, pending: true };
    const { skip, take, page, perPage } = toPage(query);

    const [docs, total] = await Promise.all([
      this.follows.find(where).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      this.follows.countDocuments(where),
    ]);

    const solicitantes = await this.users
      .find({ _id: { $in: docs.map((doc) => doc.followerId) } })
      .populate('avatar')
      .lean();
    const porId = new Map(solicitantes.map((doc) => [String(doc._id), doc]));

    // Se recorre el orden de las solicitudes, no el de las personas: la
    // consulta de usuarios no garantiza ninguno, y aquí manda la fecha.
    const filas = docs.flatMap((doc) => {
      const quien = porId.get(String(doc.followerId));

      return quien
        ? [
            {
              id: String(doc._id),
              requester: toUserSummary(quien),
              createdAt: doc.createdAt.toISOString(),
            },
          ]
        : [];
    });

    return paginate(filas, total, page, perPage);
  }

  /** Acepta una solicitud: el vínculo deja de estar pendiente y ya cuenta. */
  async acceptFollowRequest(userId: string, requestId: string): Promise<FollowRequestResult> {
    const doc = await this.findPendingRequest(userId, requestId);

    await this.follows.updateOne({ _id: doc._id }, { $set: { pending: false } });

    const requesterId = String(doc.followerId);

    await this.notifications.retract({
      recipientId: userId,
      actorId: requesterId,
      type: NotificationType.FollowRequest,
    });
    await this.notifications.notify({
      recipientId: requesterId,
      actorId: userId,
      type: NotificationType.FollowAccepted,
    });
    await this.bus.publish(Topic.domain(DomainEvent.FollowCreated), {
      followerId: requesterId,
      followeeId: userId,
    });

    return { followerCount: await this.countFollowers(userId) };
  }

  /**
   * Rechaza una solicitud.
   *
   * Se borra el vínculo en lugar de marcarlo como rechazado: guardar el «no»
   * sólo serviría para impedir que se vuelva a pedir, y quien rechaza no ha
   * pedido bloquear a nadie.
   */
  async rejectFollowRequest(userId: string, requestId: string): Promise<FollowRequestResult> {
    const doc = await this.findPendingRequest(userId, requestId);

    await this.follows.deleteOne({ _id: doc._id });
    await this.notifications.retract({
      recipientId: userId,
      actorId: String(doc.followerId),
      type: NotificationType.FollowRequest,
    });

    return { followerCount: await this.countFollowers(userId) };
  }

  /**
   * Busca una solicitud pendiente dirigida a esta persona.
   *
   * Se filtra también por destinatario: sin eso, cualquiera con el
   * identificador de una solicitud podría responder a la de otro.
   */
  private async findPendingRequest(
    userId: string,
    requestId: string,
  ): Promise<Follow & { _id: unknown }> {
    if (!isValidObjectId(requestId)) {
      throw AppException.notFound('FollowRequest');
    }

    const doc = await this.follows
      .findOne({ _id: requestId, followeeId: userId, pending: true })
      .lean();

    if (!doc) {
      throw AppException.notFound('FollowRequest');
    }

    return doc;
  }

  /**
   * Quiénes siguen a esta persona, de lo más reciente a lo más antiguo.
   *
   * Con el perfil privado, la lista es tan privada como lo publicado: sólo la
   * ven sus seguidores.
   */
  async followers(
    id: string,
    query: UserListQueryDto,
    viewerId: string | null,
  ): Promise<Paginated<UserSummary>> {
    await this.relationships.assertCanViewContentOf(viewerId, id);

    return this.listFollows(
      { followeeId: id, pending: { $ne: true } },
      'followerId',
      query,
      viewerId,
    );
  }

  /** A quiénes sigue esta persona. */
  async following(
    id: string,
    query: UserListQueryDto,
    viewerId: string | null,
  ): Promise<Paginated<UserSummary>> {
    await this.relationships.assertCanViewContentOf(viewerId, id);

    return this.listFollows(
      { followerId: id, pending: { $ne: true } },
      'followeeId',
      query,
      viewerId,
    );
  }

  /**
   * Las dos listas de seguimiento son la misma consulta con los extremos
   * cambiados: se filtra por un lado de la relación y se traen las personas del
   * otro. Quien tiene un bloqueo con quien mira no aparece.
   */
  private async listFollows(
    where: Filtro,
    campo: 'followerId' | 'followeeId',
    query: UserListQueryDto,
    viewerId: string | null,
  ): Promise<Paginated<UserSummary>> {
    const id = String(Object.values(where)[0]);
    await this.assertExists(id);

    const blocked = viewerId ? [...(await this.relationships.blockedIds(viewerId))] : [];
    const filter = blocked.length > 0 ? { ...where, [campo]: { $nin: blocked } } : where;
    const { skip, take, page, perPage } = toPage(query);

    const [docs, total] = await Promise.all([
      this.follows.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      this.follows.countDocuments(filter),
    ]);

    const ids = docs.map((doc) => doc[campo]);
    const gente = await this.users
      .find({ _id: { $in: ids } })
      .populate('avatar')
      .lean();

    // Se reordenan como venían: `find` los devuelve en el orden de la
    // colección, no en el de la lista de identificadores.
    const porId = new Map(gente.map((persona) => [String(persona._id), persona]));
    const ordenados = ids
      .map((personId) => porId.get(String(personId)))
      .filter((persona) => persona !== undefined);

    return paginate(
      ordenados.map((doc) => toUserSummary(doc as never)),
      total,
      page,
      perPage,
    );
  }

  /** Seguidores de verdad: las solicitudes sin responder no suman. */
  private async countFollowers(id: string): Promise<number> {
    return this.follows.countDocuments({ followeeId: id, pending: { $ne: true } });
  }

  private async followInfo(
    id: string,
    viewerId: string | null,
  ): Promise<{ followerCount: number; followingCount: number; followState: FollowState | null }> {
    const [followerCount, followingCount, followState] = await Promise.all([
      this.countFollowers(id),
      this.follows.countDocuments({ followerId: id, pending: { $ne: true } }),
      this.relationships.followState(viewerId, id),
    ]);

    return { followerCount, followingCount, followState };
  }

  private async assertExists(id: string): Promise<void> {
    if (!isValidObjectId(id) || !(await this.users.exists({ _id: id }))) {
      throw AppException.notFound('User');
    }
  }

  async list(query: UserListQueryDto): Promise<Paginated<User>> {
    const { skip, take, page, perPage } = toPage(query);
    const where = this.buildSearchFilter(query);

    const [docs, total] = await Promise.all([
      this.users
        .find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate(POPULATE_USER)
        .lean(),
      this.users.countDocuments(where),
    ]);

    return paginate(
      docs.map((doc) => toUser(doc as never)),
      total,
      page,
      perPage,
    );
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    if (dto.name !== undefined && (await this.users.exists({ name: dto.name, _id: { $ne: id } }))) {
      throw AppException.conflict(ErrorCode.Conflict, 'That username is already taken');
    }

    await this.users.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio || null } : {}),
          ...(dto.website !== undefined ? { website: dto.website || null } : {}),
          ...(dto.birthday !== undefined
            ? { birthday: dto.birthday ? new Date(dto.birthday) : null }
            : {}),
        },
      },
    );

    await this.bus.publish(Topic.domain(DomainEvent.UserUpdated), { userId: id });

    return this.findById(id);
  }

  /**
   * Cambia la dirección de correo.
   *
   * El cambio no surte efecto hasta que se confirma desde el enlace que se
   * envía a la dirección nueva: sólo así se comprueba que existe y que es del
   * usuario. Mientras tanto la cuenta conserva el correo anterior. Quien llama
   * ya ha confirmado su identidad.
   */
  async requestEmailChange(id: string, dto: UpdateEmailDto): Promise<void> {
    const user = await this.users.findById(id).select('email name lang').lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (user.email === dto.email) {
      return;
    }

    if (await this.users.exists({ email: dto.email })) {
      throw AppException.conflict(
        ErrorCode.UserAlreadyExists,
        'That email address is already registered',
      );
    }

    await this.auth.sendVerificationEmail(id, dto.email, user.name, user.lang);
  }

  async updateLanguage(id: string, lang: string): Promise<User> {
    await this.users.updateOne({ _id: id }, { $set: { lang } });

    return this.findById(id);
  }

  async updateLocation(id: string, dto: UpdateLocationDto): Promise<User> {
    const current = await this.users.findById(id).select('locationId').lean();

    if (!current) {
      throw AppException.notFound('User');
    }

    const locationId = await upsertLocation(
      this.locations,
      current.locationId ? String(current.locationId) : null,
      dto.location,
    );

    await this.users.updateOne({ _id: id }, { $set: { locationId: locationId ?? null } });

    return this.findById(id);
  }

  async setRole(id: string, role: UserRole, actingUserId: string): Promise<User> {
    if (id === actingUserId) {
      // Sin esta comprobación, la última persona con rol de administrador
      // podría degradarse a sí misma y dejar el sistema sin nadie que pueda
      // volver a repartir permisos.
      throw AppException.forbidden('You cannot change your own role');
    }

    await this.assertExists(id);
    await this.users.updateOne({ _id: id }, { $set: { role } });

    return this.findById(id);
  }

  async setVerified(id: string, verified: boolean): Promise<User> {
    await this.assertExists(id);
    await this.users.updateOne({ _id: id }, { $set: { verified } });

    return this.findById(id);
  }

  /** Sube una foto de perfil o de portada y sustituye la anterior. */
  async updateImage(id: string, kind: 'avatar' | 'cover', upload: PendingUpload): Promise<Media> {
    const field = kind === 'avatar' ? 'avatarId' : 'coverId';
    const current = await this.users.findById(id).select(`${field} name`).lean();

    if (!current) {
      throw AppException.notFound('User');
    }

    const stored = await this.media.storeUpload(upload, {
      accept: ['image'],
      preset: kind,
      uploaderId: id,
      alt: `${kind === 'avatar' ? 'Avatar' : 'Portada'} de ${current.name}`,
    });

    await this.users.updateOne({ _id: id }, { $set: { [field]: stored._id } });

    // El anterior se borra después de apuntar el nuevo, para que la cuenta no
    // se quede sin imagen si algo falla por el camino.
    const previous = current[field];

    if (previous) {
      await this.media.remove(String(previous));
    }

    await this.bus.publish(Topic.domain(DomainEvent.UserUpdated), { userId: id });

    return toMedia(stored);
  }

  async removeImage(id: string, kind: 'avatar' | 'cover'): Promise<void> {
    const field = kind === 'avatar' ? 'avatarId' : 'coverId';
    const current = await this.users.findById(id).select(field).lean();
    const previous = current?.[field];

    if (!previous) {
      return;
    }

    await this.users.updateOne({ _id: id }, { $set: { [field]: null } });
    await this.media.remove(String(previous));
  }

  async getPermissions(id: string): Promise<UserPermissionsDto> {
    // Con `upsert` y `new` siempre hay documento, pero el tipo admite nulo
    // porque la misma llamada sin `upsert` podría no encontrar nada.
    const doc = await this.permissions
      .findOneAndUpdate(
        { userId: id },
        { $setOnInsert: { userId: id } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean();

    const permissions = toPermissions(doc);

    if (!permissions) {
      throw AppException.notFound('User');
    }

    return permissions;
  }

  /**
   * Cambia los ajustes de privacidad.
   *
   * Pasar el perfil a privado marca lo ya publicado para que el muro deje de
   * enseñárselo a quien no sigue. Volverlo público acepta de golpe las
   * solicitudes pendientes, como hace Instagram: ya no hay nada que decidir.
   */
  async updatePermissions(id: string, dto: UpdatePermissionsDto): Promise<UserPermissionsDto> {
    const before = await this.permissions.findOne({ userId: id }).select('privateProfile').lean();

    await this.permissions.updateOne(
      { userId: id },
      { $set: { ...dto }, $setOnInsert: { userId: id } },
      { upsert: true },
    );

    if (
      dto.privateProfile !== undefined &&
      dto.privateProfile !== (before?.privateProfile ?? false)
    ) {
      await this.posts.updateMany({ userId: id }, { $set: { authorPrivate: dto.privateProfile } });

      if (!dto.privateProfile) {
        await this.follows.updateMany(
          { followeeId: id, pending: true },
          { $set: { pending: false } },
        );
      }
    }

    return this.getPermissions(id);
  }

  async addEmails(id: string, dto: AddEmailsDto): Promise<UserEmailDto[]> {
    // Uno a uno con `upsert`: el índice único sobre el par descarta los
    // repetidos sin que un duplicado tire toda la operación.
    for (const email of dto.emails) {
      await this.emails.updateOne(
        { userId: id, email },
        { $setOnInsert: { userId: id, email } },
        { upsert: true },
      );
    }

    return this.listEmails(id);
  }

  async addPhones(id: string, dto: AddPhonesDto): Promise<UserPhoneDto[]> {
    for (const phone of dto.phones) {
      await this.phones.updateOne(
        { userId: id, phone },
        { $setOnInsert: { userId: id, phone } },
        { upsert: true },
      );
    }

    return this.listPhones(id);
  }

  async listEmails(id: string): Promise<UserEmailDto[]> {
    const docs = await this.emails.find({ userId: id }).sort({ createdAt: 1 }).lean();

    return docs.map((doc) => ({ id: String(doc._id), email: doc.email }));
  }

  async listPhones(id: string): Promise<UserPhoneDto[]> {
    const docs = await this.phones.find({ userId: id }).sort({ createdAt: 1 }).lean();

    return docs.map((doc) => ({ id: String(doc._id), phone: doc.phone }));
  }

  async removeEmail(userId: string, emailId: string): Promise<void> {
    // El filtro por `userId` es lo que impide borrar el correo de otra persona
    // pasando un identificador ajeno.
    const { deletedCount } = await this.emails.deleteOne({ _id: emailId, userId });

    if (deletedCount === 0) {
      throw AppException.notFound('Email');
    }
  }

  async removePhone(userId: string, phoneId: string): Promise<void> {
    const { deletedCount } = await this.phones.deleteOne({ _id: phoneId, userId });

    if (deletedCount === 0) {
      throw AppException.notFound('Phone');
    }
  }

  async removeSocialLink(userId: string, linkId: string): Promise<void> {
    const user = await this.users.findById(userId).select('passwordHash').lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    const vinculos = await this.socialLinks.countDocuments({ userId });

    if (!user.passwordHash && vinculos <= 1) {
      // Quitar el último vínculo de una cuenta sin contraseña la dejaría
      // inaccesible para siempre.
      throw AppException.badRequest(
        ErrorCode.WrongSocialLinkId,
        'Set a password before unlinking your only sign-in method',
      );
    }

    const { deletedCount } = await this.socialLinks.deleteOne({ _id: linkId, userId });

    if (deletedCount === 0) {
      throw AppException.notFound('Social link');
    }
  }

  /**
   * Datos de contacto de un usuario, filtrados por sus preferencias.
   *
   * El filtrado se hace aquí, en el servidor: en el backend anterior algunas
   * pantallas recibían el objeto completo y decidían en el cliente qué
   * ocultar, lo que sólo escondía los datos a la vista.
   */
  async getContact(id: string, viewerId: string | null): Promise<UserContact> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('User');
    }

    await this.relationships.assertCanViewContentOf(viewerId, id);

    const user = await this.users
      .findById(id)
      .select('name email phone locationId')
      .populate('location')
      .lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    const [permisos, emails, phones] = await Promise.all([
      this.permissions.findOne({ userId: id }).lean(),
      this.listEmails(id),
      this.listPhones(id),
    ]);

    return {
      id: String(user._id),
      name: user.name,
      // Sin documento de permisos se aplica el criterio más restrictivo.
      email: permisos?.showMainEmail ? user.email : null,
      emails: permisos?.showAlternativeEmails ? emails : [],
      phone: permisos?.showMainPhone ? user.phone : null,
      phones: permisos?.showAlternativePhones ? phones : [],
      location: permisos?.showLocation
        ? toLocation((user as { location?: never }).location ?? null)
        : null,
    };
  }

  /** Borra una cuenta y todo lo que colgaba de ella. Quien llama ya confirmó la identidad. */
  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.sessions.revokeAllForUser(id, SessionEndReason.AccountDeleted);
    await this.cleanup.purge(id);
  }

  private async findDocOrFail(id: string): Promise<Record<string, unknown>> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('User');
    }

    const doc = await this.users.findById(id).populate(POPULATE_USER).lean();

    if (!doc) {
      throw AppException.notFound('User');
    }

    return doc as unknown as Record<string, unknown>;
  }

  private buildSearchFilter(query: UserListQueryDto): Filtro {
    const filtros: Filtro[] = [];

    if (query.role) {
      filtros.push({ role: query.role });
    }

    if (query.search?.trim()) {
      const search = escapeRegex(query.search.trim());

      filtros.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      });
    }

    return filtros.length > 0 ? { $and: filtros } : {};
  }
}
