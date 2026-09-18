import type { Types } from '../database/mongoose.js';
import type {
  Bulletin,
  Comment,
  Location,
  Media,
  Order,
  OrderItem,
  Payment,
  Post,
  Product,
  PublicProfile,
  ReactionCount,
  SocialLink,
  SupportTicket,
  User,
  UserPermissions,
  UserSummary,
  Warehouse,
} from '@social-network/shared';

import { MessagePolicy, ReactionType } from '../database/schemas/enums.js';
import type {
  Audience,
  AuthProvider,
  FollowState,
  Gender,
  MediaType,
  PaymentProvider,
  PaymentStatus,
  PostKind,
  OrderState,
  UserRole,
} from '../database/schemas/enums.js';

/**
 * Traducción de los documentos de Mongo a los contratos públicos de la API.
 *
 * Todo lo que sale del servidor pasa por aquí. Concentrarlo en un módulo evita
 * la fuga accidental de campos sensibles —`passwordHash` sobre todo— y
 * garantiza que tres cosas se serialicen siempre igual: los `ObjectId` como
 * cadenas, las fechas en ISO-8601 y el dinero en unidades, no en los céntimos
 * con los que se guarda.
 */

/** Cómo llega un documento leído con `.lean()`: identificador y campos. */
type Doc<T> = T & { _id: Types.ObjectId | string };

const id = (value: Types.ObjectId | string | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** Identificador de una referencia que puede venir poblada o sin poblar. */
export function toId(value: Types.ObjectId | string | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function toIso(value: Date): string;
export function toIso(value: Date | null | undefined): string | null;
export function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Sólo la parte de fecha, para los campos que no tienen hora que enseñar. */
export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

/**
 * De céntimos a unidades.
 *
 * En la base el dinero son enteros, porque Mongo no tiene `DECIMAL` y con coma
 * flotante se pierden céntimos al sumar. Hacia fuera se sigue hablando en
 * pesos, que es lo que la aplicación ya entendía.
 */
export function fromCents(value: number): number {
  return round2(value / 100);
}

/** De unidades a céntimos, para guardar. */
export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

/** Redondeo a dos decimales, evitando los arrastres de la coma flotante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Relaciones que hay que poblar en cada consulta.
 *
 * Son los virtuales que declaran los esquemas. Vivir en un solo sitio evita
 * que una pantalla reciba la publicación sin autor porque su consulta olvidó
 * pedirlo.
 */
export const POPULATE_USER_SUMMARY = { path: 'author', populate: { path: 'avatar' } } as const;

export const POPULATE_POST = [
  { path: 'author', populate: { path: 'avatar' } },
  { path: 'location' },
  { path: 'media' },
  { path: 'mentions', select: 'name firstName lastName avatarId verified', populate: { path: 'avatar' } },
  {
    path: 'sharedPost',
    populate: [
      { path: 'author', populate: { path: 'avatar' } },
      { path: 'media' },
      { path: 'location' },
    ],
  },
];

export const POPULATE_USER = [
  { path: 'avatar' },
  { path: 'cover' },
  { path: 'location' },
  { path: 'permissions' },
  { path: 'socialLinks' },
];

export const POPULATE_PRODUCT = [
  { path: 'warehouse', populate: [{ path: 'location' }, { path: 'media' }] },
  { path: 'media' },
];

export const POPULATE_ORDER = [
  { path: 'customer', populate: { path: 'avatar' } },
  { path: 'roundsman', populate: { path: 'avatar' } },
  { path: 'origin' },
  { path: 'destination' },
  { path: 'items', populate: { path: 'product', populate: { path: 'media' } } },
];

// --- Documentos tal y como llegan de Mongo ---------------------------------

interface LocationDoc {
  country: string | null;
  state: string | null;
  city: string | null;
  route: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
}

export interface MediaDoc {
  type: MediaType;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationMs?: number | null;
  posterUrl?: string | null;
  fileName?: string | null;
}

export interface UserSummaryDoc {
  name: string;
  firstName: string;
  lastName: string;
  verified?: boolean;
  avatar?: Doc<MediaDoc> | null;
}

interface PermissionsDoc {
  showMainEmail: boolean;
  showAlternativeEmails: boolean;
  showMainPhone: boolean;
  showAlternativePhones: boolean;
  showLocation: boolean;
  receiveMailAds: boolean;
  /* Opcionales: los documentos anteriores a estos ajustes no los traen. */
  messagePolicy?: MessagePolicy;
  privateProfile?: boolean;
  showOnlineStatus?: boolean;
  storyReplyPolicy?: MessagePolicy;
  loginAlerts?: boolean;
}

interface UserDoc extends UserSummaryDoc {
  email: string;
  gender: Gender | null;
  phone: string | null;
  birthday: Date | null;
  lang: string;
  role: UserRole;
  provider: AuthProvider;
  emailVerified: boolean;
  cover?: Doc<MediaDoc> | null;
  bio?: string | null;
  website?: string | null;
  mfaEnabled?: boolean;
  location?: Doc<LocationDoc> | null;
  permissions?: Doc<PermissionsDoc> | null;
  socialLinks?: Doc<{ provider: AuthProvider; externalId: string }>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDoc {
  description: string;
  kind: PostKind;
  audience?: Audience;
  locationAccuracy: number;
  hashtags?: string[];
  commentsDisabled?: boolean;
  editedAt?: Date | null;
  reactions?: Partial<Record<ReactionType, number>>;
  reactionCount?: number;
  commentCount?: number;
  shareCount?: number;
  sharedPostId?: Types.ObjectId | null;
  author?: Doc<UserSummaryDoc> | null;
  location?: Doc<LocationDoc> | null;
  media?: Doc<MediaDoc>[];
  mentions?: Doc<UserSummaryDoc>[];
  sharedPost?: Doc<PostDoc> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentDoc {
  postId: Types.ObjectId | string;
  parentId?: Types.ObjectId | string | null;
  body: string;
  likeCount?: number;
  replyCount?: number;
  editedAt?: Date | null;
  deletedAt: Date | null;
  author?: Doc<UserSummaryDoc> | null;
  mentions?: Doc<UserSummaryDoc>[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Traducciones -----------------------------------------------------------

export function toLocation(doc: Doc<LocationDoc> | null | undefined): Location | null {
  if (!doc) {
    return null;
  }

  return {
    id: id(doc._id),
    country: doc.country,
    state: doc.state,
    city: doc.city,
    route: doc.route,
    streetNumber: doc.streetNumber,
    postalCode: doc.postalCode,
    lat: doc.lat,
    lng: doc.lng,
  };
}

export function toMedia(doc: Doc<MediaDoc>): Media {
  return {
    id: id(doc._id),
    type: doc.type,
    url: doc.url,
    alt: doc.alt,
    width: doc.width,
    height: doc.height,
    mimeType: doc.mimeType ?? null,
    sizeBytes: doc.sizeBytes ?? null,
    durationMs: doc.durationMs ?? null,
    posterUrl: doc.posterUrl ?? null,
    fileName: doc.fileName ?? null,
  };
}

export function toMediaOrNull(doc: Doc<MediaDoc> | null | undefined): Media | null {
  return doc ? toMedia(doc) : null;
}

/** La firma de alguien que ya no existe: sus mensajes y comentarios siguen en pie. */
export const GHOST_USER: UserSummary = {
  id: '',
  name: '',
  firstName: '',
  lastName: '',
  avatar: null,
  verified: false,
};

export function toUserSummary(doc: Doc<UserSummaryDoc> | null | undefined): UserSummary {
  if (!doc) {
    return GHOST_USER;
  }

  return {
    id: id(doc._id),
    name: doc.name,
    firstName: doc.firstName,
    lastName: doc.lastName,
    avatar: toMediaOrNull(doc.avatar),
    verified: doc.verified ?? false,
  };
}

export function toPermissions(doc: Doc<PermissionsDoc> | null | undefined): UserPermissions | null {
  if (!doc) {
    return null;
  }

  return {
    showMainEmail: doc.showMainEmail,
    showAlternativeEmails: doc.showAlternativeEmails,
    showMainPhone: doc.showMainPhone,
    showAlternativePhones: doc.showAlternativePhones,
    showLocation: doc.showLocation,
    receiveMailAds: doc.receiveMailAds,
    // Las cuentas creadas antes de que existieran estos ajustes no los llevan
    // en el documento: se leen con el mismo valor que da el esquema a las
    // nuevas, en lugar de salir vacíos.
    messagePolicy: doc.messagePolicy ?? MessagePolicy.Everyone,
    privateProfile: doc.privateProfile ?? false,
    showOnlineStatus: doc.showOnlineStatus ?? true,
    storyReplyPolicy: doc.storyReplyPolicy ?? MessagePolicy.Everyone,
    loginAlerts: doc.loginAlerts ?? true,
  };
}

export function toUser(
  doc: Doc<UserDoc>,
  extra: {
    followerCount?: number;
    followingCount?: number;
    followState?: FollowState | null;
  } = {},
): User {
  return {
    id: id(doc._id),
    name: doc.name,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    gender: doc.gender,
    phone: doc.phone,
    birthday: toDateOnly(doc.birthday),
    lang: doc.lang,
    role: doc.role,
    provider: doc.provider,
    emailVerified: doc.emailVerified,
    avatar: toMediaOrNull(doc.avatar),
    cover: toMediaOrNull(doc.cover),
    bio: doc.bio ?? null,
    website: doc.website ?? null,
    verified: doc.verified ?? false,
    mfaEnabled: doc.mfaEnabled ?? false,
    location: toLocation(doc.location),
    permissions: toPermissions(doc.permissions),
    socialLinks: (doc.socialLinks ?? []).map(toSocialLink),
    followerCount: extra.followerCount ?? 0,
    followingCount: extra.followingCount ?? 0,
    followState: extra.followState ?? null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toSocialLink(doc: Doc<{ provider: AuthProvider; externalId: string }>): SocialLink {
  return { id: id(doc._id), provider: doc.provider, externalId: doc.externalId };
}

/** Las reacciones presentes, de la más usada a la menos. */
export function toReactionSummary(
  reactions: Partial<Record<ReactionType, number>> | null | undefined,
): ReactionCount[] {
  return Object.values(ReactionType)
    .map((type) => ({ type, count: reactions?.[type] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Lo que cada publicación sabe de quien la mira. */
export interface PostViewerState {
  myReaction: ReactionType | null;
  saved: boolean;
  authorFollowState: FollowState | null;
  commentPreview: Comment[];
}

const SIN_ESPECTADOR: PostViewerState = {
  myReaction: null,
  saved: false,
  authorFollowState: null,
  commentPreview: [],
};

/**
 * Publicación tal y como la ve quien la pide.
 *
 * La publicación compartida se traduce un solo nivel: si comparte a su vez
 * otra, ésa no se despliega —igual que en Facebook, donde compartir lo
 * compartido apunta al original—.
 */
export function toPost(
  doc: Doc<PostDoc>,
  viewer: PostViewerState = SIN_ESPECTADOR,
  options: { sharedPostVisible?: boolean } = {},
): Post {
  const shared = doc.sharedPost;
  const sharedVisible = options.sharedPostVisible ?? true;

  return {
    id: id(doc._id),
    description: doc.description,
    kind: doc.kind,
    audience: doc.audience ?? 'public',
    locationAccuracy: doc.locationAccuracy,
    author: toUserSummary(doc.author),
    location: toLocation(doc.location),
    media: (doc.media ?? []).map(toMedia),
    hashtags: doc.hashtags ?? [],
    mentions: (doc.mentions ?? []).map((mention) => toUserSummary(mention)),
    sharedPost: shared && sharedVisible ? toPost({ ...shared, sharedPost: null }) : null,
    sharedPostUnavailable: Boolean(doc.sharedPostId) && (!shared || !sharedVisible),
    reactionCount: doc.reactionCount ?? 0,
    reactionSummary: toReactionSummary(doc.reactions),
    myReaction: viewer.myReaction,
    commentCount: doc.commentCount ?? 0,
    shareCount: doc.shareCount ?? 0,
    saved: viewer.saved,
    commentsDisabled: doc.commentsDisabled ?? false,
    authorFollowState: viewer.authorFollowState,
    commentPreview: viewer.commentPreview,
    editedAt: toIso(doc.editedAt ?? null),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export function toPublicProfile(
  doc: Doc<
    UserSummaryDoc & {
      cover?: Doc<MediaDoc> | null;
      bio?: string | null;
      website?: string | null;
      lastSeenAt?: Date | null;
      createdAt: Date;
    }
  >,
  extra: Omit<
    PublicProfile,
    'id' | 'name' | 'firstName' | 'lastName' | 'avatar' | 'cover' | 'bio' | 'website' | 'verified' | 'createdAt'
  >,
): PublicProfile {
  return {
    id: id(doc._id),
    name: doc.name,
    firstName: doc.firstName,
    lastName: doc.lastName,
    avatar: toMediaOrNull(doc.avatar),
    cover: toMediaOrNull(doc.cover),
    bio: doc.bio ?? null,
    website: doc.website ?? null,
    verified: doc.verified ?? false,
    createdAt: toIso(doc.createdAt),
    ...extra,
  };
}

export function toComment(doc: Doc<CommentDoc>, likedByMe = false): Comment {
  const deleted = doc.deletedAt !== null && doc.deletedAt !== undefined;

  return {
    id: id(doc._id),
    postId: id(doc.postId),
    parentId: toId(doc.parentId ?? null),
    // El cuerpo de un comentario retirado no se envía: la aplicación pinta el
    // hueco con su propio texto traducido.
    body: deleted ? '' : doc.body,
    author: toUserSummary(doc.author),
    mentions: deleted ? [] : (doc.mentions ?? []).map((mention) => toUserSummary(mention)),
    likeCount: doc.likeCount ?? 0,
    likedByMe,
    replyCount: doc.replyCount ?? 0,
    deleted,
    editedAt: toIso(doc.editedAt ?? null),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export function toBulletin(
  doc: Doc<{
    title: string;
    description: string;
    date: Date;
    media?: Doc<MediaDoc> | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Bulletin {
  return {
    id: id(doc._id),
    title: doc.title,
    description: doc.description,
    date: toDateOnly(doc.date) ?? '',
    media: toMediaOrNull(doc.media),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

interface WarehouseDoc {
  name: string;
  description: string | null;
  location?: Doc<LocationDoc> | null;
  media?: Doc<MediaDoc> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toWarehouse(doc: Doc<WarehouseDoc>): Warehouse {
  return {
    id: id(doc._id),
    name: doc.name,
    description: doc.description,
    location: toLocation(doc.location),
    media: toMediaOrNull(doc.media),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

interface ProductDoc {
  name: string;
  description: string;
  stock: number;
  price: number;
  warehouse?: Doc<WarehouseDoc> | null;
  media?: Doc<MediaDoc>[];
  createdAt: Date;
  updatedAt: Date;
}

export function toProduct(doc: Doc<ProductDoc>): Product {
  return {
    id: id(doc._id),
    name: doc.name,
    description: doc.description,
    stock: doc.stock,
    price: fromCents(doc.price),
    warehouse: doc.warehouse ? toWarehouse(doc.warehouse) : null,
    media: (doc.media ?? []).map(toMedia),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

interface OrderItemDoc {
  productId: Types.ObjectId | string;
  quantity: number;
  unitPrice: number;
  product?: Doc<ProductDoc> | null;
}

export function toOrderItem(doc: Doc<OrderItemDoc>): OrderItem {
  const unitPrice = fromCents(doc.unitPrice);

  return {
    id: id(doc._id),
    productId: id(doc.productId),
    product: doc.product ? toProduct(doc.product) : null,
    quantity: doc.quantity,
    unitPrice,
    subtotal: round2(unitPrice * doc.quantity),
  };
}

interface OrderDoc {
  state: OrderState;
  total: number;
  customer?: Doc<UserSummaryDoc> | null;
  roundsman?: Doc<UserSummaryDoc> | null;
  items?: Doc<OrderItemDoc>[];
  origin?: Doc<LocationDoc> | null;
  destination?: Doc<LocationDoc> | null;
  takeOutDate: Date | null;
  deliveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toOrder(doc: Doc<OrderDoc>): Order {
  return {
    id: id(doc._id),
    state: doc.state,
    total: fromCents(doc.total),
    customer: toUserSummary(doc.customer),
    roundsman: doc.roundsman ? toUserSummary(doc.roundsman) : null,
    items: (doc.items ?? []).map(toOrderItem),
    origin: toLocation(doc.origin),
    destination: toLocation(doc.destination),
    takeOutDate: toIso(doc.takeOutDate),
    deliveryDate: toIso(doc.deliveryDate),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export function toPayment(
  doc: Doc<{
    orderId: Types.ObjectId | string;
    provider: PaymentProvider;
    status: PaymentStatus;
    amount: number;
    currency: string;
    externalId: string | null;
    createdAt: Date;
  }>,
): Payment {
  return {
    id: id(doc._id),
    orderId: id(doc.orderId),
    provider: doc.provider,
    status: doc.status,
    amount: fromCents(doc.amount),
    currency: doc.currency,
    externalId: doc.externalId,
    createdAt: toIso(doc.createdAt),
  };
}

export function toSupportTicket(
  doc: Doc<{
    name: string;
    email: string;
    phone: string | null;
    message: string;
    lang: string;
    createdAt: Date;
  }>,
): SupportTicket {
  return {
    id: id(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    message: doc.message,
    lang: doc.lang,
    createdAt: toIso(doc.createdAt),
  };
}
