import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  FollowRequest,
  FollowRequestResult,
  FollowResult,
  Media,
  Paginated,
  PublicProfile,
  User,
  UserContact,
  UserEmail as UserEmailDto,
  UserPermissions as UserPermissionsDto,
  UserPhone as UserPhoneDto,
  UserRole,
  UserSummary,
} from '@respet/shared';
import { FollowState } from '../database/schemas/enums.js';
import { isValidObjectId } from '../database/mongoose.js';
import type { Model } from '../database/mongoose.js';

import { AuthService } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { TokenService } from '../auth/token.service.js';
import { AppException, ErrorCode } from '../common/errors.js';
import {
  POPULATE_USER,
  toLocation,
  toMedia,
  toPublicProfile,
  toUser,
  toUserSummary,
} from '../common/mappers.js';
import { upsertLocation } from '../common/utils/location.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { escapeRegex } from '../common/utils/regex.js';
import {
  Comment,
  Follow,
  Location,
  Media as MediaDoc,
  Post,
  PostReport,
  PostVote,
} from '../database/schemas/content.schema.js';
import {
  SocialLink,
  User as UserDoc,
  UserEmail,
  UserPermissions,
  UserPhone,
} from '../database/schemas/user.schema.js';
import { MediaService } from '../media/media.service.js';
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
    @InjectModel(PostVote.name) private readonly votes: Model<PostVote>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(PostReport.name) private readonly reports: Model<PostReport>,
    @InjectModel(MediaDoc.name) private readonly mediaModel: Model<MediaDoc>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
    private readonly media: MediaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async findById(id: string, viewerId: string | null = null): Promise<User> {
    const doc = await this.findDocOrFail(id);

    return toUser(doc as never, await this.followInfo(id, viewerId));
  }

  /**
   * Ficha pública, la que ve cualquiera.
   *
   * `findById` devuelve el usuario entero y está reservada a la administración;
   * una red social necesita además esta versión reducida, sin datos de
   * contacto, para que se pueda visitar un perfil sin ser administrador.
   */
  async publicProfile(id: string, viewerId: string | null = null): Promise<PublicProfile> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('User');
    }

    const doc = await this.users
      .findById(id)
      .select('name firstName lastName avatarId createdAt')
      .populate('avatar')
      .lean();

    if (!doc) {
      throw AppException.notFound('User');
    }

    const [info, postCount] = await Promise.all([
      this.followInfo(id, viewerId),
      this.posts.countDocuments({ userId: id }),
    ]);

    return toPublicProfile(doc as never, {
      followerCount: info.followerCount,
      followingCount: info.followingCount,
      followState: info.followState,
      postCount,
    });
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

    const pending = await this.isPrivate(followeeId);

    await this.follows.updateOne(
      { followerId, followeeId },
      { $setOnInsert: { followerId, followeeId, pending } },
      { upsert: true },
    );

    return {
      followerCount: await this.countFollowers(followeeId),
      followState: await this.followStateOf(followerId, followeeId),
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
    await this.follows.deleteOne({ followerId, followeeId });

    return {
      followerCount: await this.countFollowers(followeeId),
      followState: FollowState.None,
    };
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
              requester: toUserSummary(quien as never),
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
  ): Promise<{ _id: unknown }> {
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

  /** Cierto si esta persona exige solicitud para que la sigan. */
  private async isPrivate(userId: string): Promise<boolean> {
    const doc = await this.permissions.findOne({ userId }).select('privateProfile').lean();

    return doc?.privateProfile ?? false;
  }

  /** En qué punto está el seguimiento entre dos personas. */
  private async followStateOf(followerId: string, followeeId: string): Promise<FollowState> {
    const doc = await this.follows.findOne({ followerId, followeeId }).select('pending').lean();

    if (!doc) {
      return FollowState.None;
    }

    return doc.pending ? FollowState.Requested : FollowState.Following;
  }

  /**
   * Quiénes siguen a esta persona, de lo más reciente a lo más antiguo.
   *
   * Las solicitudes pendientes quedan fuera: aparecen en `followRequests`, y
   * sólo para quien tiene que responderlas.
   */
  async followers(id: string, query: UserListQueryDto): Promise<Paginated<UserSummary>> {
    return this.listFollows({ followeeId: id, pending: { $ne: true } }, 'followerId', query);
  }

  /** A quiénes sigue esta persona. */
  async following(id: string, query: UserListQueryDto): Promise<Paginated<UserSummary>> {
    return this.listFollows({ followerId: id, pending: { $ne: true } }, 'followeeId', query);
  }

  /**
   * Las dos listas de seguimiento son la misma consulta con los extremos
   * cambiados: se filtra por un lado de la relación y se traen las personas del
   * otro.
   */
  private async listFollows(
    where: Filtro,
    campo: 'followerId' | 'followeeId',
    query: UserListQueryDto,
  ): Promise<Paginated<UserSummary>> {
    const id = String(Object.values(where)[0]);
    await this.assertExists(id);

    const { skip, take, page, perPage } = toPage(query);

    const [docs, total] = await Promise.all([
      this.follows.find(where).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      this.follows.countDocuments(where),
    ]);

    const ids = docs.map((doc) => doc[campo]);
    const gente = await this.users.find({ _id: { $in: ids } }).populate('avatar').lean();

    // Se reordenan como venían: `find` los devuelve en el orden de la
    // colección, no en el de la lista de identificadores.
    const porId = new Map(gente.map((persona) => [String(persona._id), persona]));
    const ordenados = ids
      .map((id) => porId.get(String(id)))
      .filter((persona) => persona !== undefined);

    return paginate(ordenados.map((doc) => toUserSummary(doc as never)), total, page, perPage);
  }

  /** Seguidores de verdad: las solicitudes sin responder no suman. */
  private async countFollowers(id: string): Promise<number> {
    return this.follows.countDocuments({ followeeId: id, pending: { $ne: true } });
  }

  /**
   * Cifras de seguimiento y en qué punto está quien mira.
   *
   * Sin sesión no hay respuesta a lo último —`null`—, y en la ficha de uno
   * mismo tampoco: un botón de «seguir» sobre el propio perfil no significa
   * nada. Las dos cifras cuentan sólo lo aceptado; una solicitud pendiente no
   * es un seguidor todavía.
   */
  private async followInfo(
    id: string,
    viewerId: string | null,
  ): Promise<{ followerCount: number; followingCount: number; followState: FollowState | null }> {
    const ajeno = viewerId !== null && viewerId !== id;
    const [followerCount, followingCount, followState] = await Promise.all([
      this.countFollowers(id),
      this.follows.countDocuments({ followerId: id, pending: { $ne: true } }),
      ajeno ? this.followStateOf(viewerId, id) : Promise.resolve(null),
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

    return paginate(docs.map((doc) => toUser(doc as never)), total, page, perPage);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    await this.users.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.birthday !== undefined
            ? { birthday: dto.birthday ? new Date(dto.birthday) : null }
            : {}),
        },
      },
    );

    return this.findById(id);
  }

  /**
   * Cambia la dirección de correo.
   *
   * El cambio no surte efecto hasta que se confirma desde el enlace que se
   * envía a la dirección nueva: sólo así se comprueba que existe y que es del
   * usuario. Mientras tanto la cuenta conserva el correo anterior.
   */
  async requestEmailChange(id: string, dto: UpdateEmailDto): Promise<void> {
    const user = await this.users
      .findById(id)
      .select('email name lang passwordHash')
      .lean();

    if (!user) {
      throw AppException.notFound('User');
    }

    if (user.email === dto.email) {
      return;
    }

    if (user.passwordHash) {
      if (!dto.password) {
        throw AppException.badRequest(
          ErrorCode.ValidationFailed,
          'password is required to change the email address',
        );
      }

      if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
        throw AppException.invalidCredentials();
      }
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

  async updateAvatar(id: string, file: Express.Multer.File): Promise<Media> {
    const current = await this.users.findById(id).select('avatarId name').lean();

    if (!current) {
      throw AppException.notFound('User');
    }

    const created = await this.media.createFromUpload(file, 'avatar', {
      alt: `Avatar de ${current.name}`,
    });

    await this.users.updateOne({ _id: id }, { $set: { avatarId: created.id } });

    // El anterior se borra después de apuntar el nuevo, para que la cuenta no
    // se quede sin avatar si algo falla por el camino.
    if (current.avatarId) {
      await this.media.remove(String(current.avatarId));
    }

    const doc = await this.mediaModel.findById(created.id).lean();

    if (!doc) {
      throw AppException.notFound('Media');
    }

    return toMedia(doc);
  }

  async getPermissions(id: string): Promise<UserPermissionsDto> {
    // Con `upsert` y `new` siempre hay documento, pero el tipo admite nulo
    // porque la misma llamada sin `upsert` podría no encontrar nada.
    const doc = await this.permissions.findOneAndUpdate(
      { userId: id },
      { $setOnInsert: { userId: id } },
      { upsert: true, new: true },
    );

    if (!doc) {
      throw AppException.notFound('User');
    }

    return {
      showMainEmail: doc.showMainEmail,
      showAlternativeEmails: doc.showAlternativeEmails,
      showMainPhone: doc.showMainPhone,
      showAlternativePhones: doc.showAlternativePhones,
      showLocation: doc.showLocation,
      receiveMailAds: doc.receiveMailAds,
      messagePolicy: doc.messagePolicy,
      privateProfile: doc.privateProfile,
    };
  }

  async updatePermissions(id: string, dto: UpdatePermissionsDto): Promise<UserPermissionsDto> {
    await this.permissions.updateOne(
      { userId: id },
      { $set: { ...dto }, $setOnInsert: { userId: id } },
      { upsert: true },
    );

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
  async getContact(id: string): Promise<UserContact> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('User');
    }

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

  /**
   * Borra una cuenta y todo lo que colgaba de ella.
   *
   * Antes lo hacían las claves foráneas en cascada. Aquí no hay quien lo haga,
   * así que se enumera: sus publicaciones —con los votos, comentarios y
   * denuncias que colgaban de ellas—, lo que haya escrito o votado en las
   * ajenas, los seguimientos en ambos sentidos, sus datos de contacto y sus
   * credenciales. Olvidar una de estas colecciones no da error: deja basura
   * apuntando a una cuenta que ya no existe.
   */
  async remove(id: string): Promise<void> {
    await this.assertExists(id);

    const posts = await this.posts.find({ userId: id }).select('_id').lean();
    const postIds = posts.map((post) => post._id);

    const [avatar, archivos] = await Promise.all([
      this.users.findById(id).select('avatarId').lean(),
      this.mediaModel.find({ postId: { $in: postIds } }).select('_id').lean(),
    ]);

    const mediaIds = [
      ...(avatar?.avatarId ? [String(avatar.avatarId)] : []),
      ...archivos.map((doc) => String(doc._id)),
    ];

    await this.tokens.revokeAllForUser(id);

    await Promise.all([
      // Lo que colgaba de sus publicaciones.
      this.votes.deleteMany({ postId: { $in: postIds } }),
      this.comments.deleteMany({ postId: { $in: postIds } }),
      this.reports.deleteMany({ postId: { $in: postIds } }),
      // Lo que dejó en las publicaciones de otros.
      this.votes.deleteMany({ userId: id }),
      this.comments.deleteMany({ userId: id }),
      this.reports.deleteMany({ reporterId: id }),
      // Los seguimientos van en los dos sentidos.
      this.follows.deleteMany({ $or: [{ followerId: id }, { followeeId: id }] }),
      // Y sus cosas.
      this.posts.deleteMany({ userId: id }),
      this.emails.deleteMany({ userId: id }),
      this.phones.deleteMany({ userId: id }),
      this.socialLinks.deleteMany({ userId: id }),
      this.permissions.deleteMany({ userId: id }),
    ]);

    await this.users.deleteOne({ _id: id });
    await this.media.removeMany(mediaIds);
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

