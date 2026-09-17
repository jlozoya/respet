import type {
  Audience,
  AuthProvider,
  FollowState,
  Gender,
  MediaType,
  MessagePolicy,
  OrderState,
  PaymentProvider,
  PaymentStatus,
  PostKind,
  ReactionType,
  ReportStatus,
  ReportTarget,
  UserRole,
} from './enums.js';

/**
 * Representación pública de una ubicación geográfica.
 *
 * Reemplaza a las antiguas tablas `addresses` y `directions`, que eran
 * idénticas y estaban duplicadas.
 */
export interface Location {
  id: string;
  country: string | null;
  /** Estado o provincia. */
  state: string | null;
  /** Ciudad o municipio. */
  city: string | null;
  /** Calle. */
  route: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
}

/** Un archivo: imagen, vídeo, audio o documento. */
export interface Media {
  id: string;
  type: MediaType;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Duración de vídeos y audios, en milisegundos. */
  durationMs: number | null;
  /** Fotograma de portada de un vídeo. */
  posterUrl: string | null;
  /** Nombre con el que se descarga un documento. */
  fileName: string | null;
}

export interface SocialLink {
  id: string;
  provider: AuthProvider;
  externalId: string;
}

export interface UserPermissions {
  showMainEmail: boolean;
  showAlternativeEmails: boolean;
  showMainPhone: boolean;
  showAlternativePhones: boolean;
  showLocation: boolean;
  receiveMailAds: boolean;
  /** Quién puede escribir por primera vez. */
  messagePolicy: MessagePolicy;
  /**
   * Con el perfil privado, seguir deja de ser inmediato y lo publicado sólo lo
   * ven los seguidores aceptados.
   */
  privateProfile: boolean;
  /** Si los demás ven cuándo está conectada. */
  showOnlineStatus: boolean;
  /** Quién puede contestar a sus historias. */
  storyReplyPolicy: MessagePolicy;
  /** Correo de aviso al entrar desde un dispositivo nuevo. */
  loginAlerts: boolean;
}

export interface UserEmail {
  id: string;
  email: string;
}

export interface UserPhone {
  id: string;
  phone: string;
}

/** Usuario tal y como lo expone la API. Nunca incluye credenciales. */
export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;
  phone: string | null;
  birthday: string | null;
  lang: string;
  role: UserRole;
  provider: AuthProvider;
  emailVerified: boolean;
  avatar: Media | null;
  cover: Media | null;
  bio: string | null;
  website: string | null;
  verified: boolean;
  /** Si la cuenta tiene activo el segundo factor. */
  mfaEnabled: boolean;
  location: Location | null;
  permissions: UserPermissions | null;
  socialLinks: SocialLink[];
  followerCount: number;
  followingCount: number;
  /** Nulo para quien no ha iniciado sesión, y también en la propia ficha. */
  followState: FollowState | null;
  createdAt: string;
  updatedAt: string;
}

/** Datos de contacto de un usuario, filtrados según sus permisos de privacidad. */
export interface UserContact {
  id: string;
  name: string;
  email: string | null;
  emails: UserEmail[];
  phone: string | null;
  phones: UserPhone[];
  location: Location | null;
}

/** Autor embebido en publicaciones, comentarios y mensajes: lo justo para una firma. */
export interface UserSummary {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar: Media | null;
  verified: boolean;
}

/** Cifras de seguimiento de una persona, y en qué punto está quien mira. */
export interface FollowInfo {
  followerCount: number;
  followingCount: number;
  /** Nulo para quien no ha iniciado sesión, y en la propia ficha. */
  followState: FollowState | null;
}

/**
 * Ficha pública de una persona.
 *
 * Lo que puede ver cualquiera, con o sin cuenta. No lleva correo ni teléfono:
 * esos viven en `UserContact`, que el servidor filtra según lo que su dueño
 * haya decidido mostrar.
 */
export interface PublicProfile extends FollowInfo {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar: Media | null;
  cover: Media | null;
  bio: string | null;
  website: string | null;
  verified: boolean;
  postCount: number;
  /** Perfil privado: seguir es una solicitud y lo publicado se reserva a los seguidores. */
  isPrivate: boolean;
  /** Cierto si quien mira puede ver sus publicaciones e historias. */
  canViewContent: boolean;
  /** Cierto si quien mira la tiene bloqueada. */
  blockedByViewer: boolean;
  /** Cierto si tiene historias vigentes que quien mira puede ver. */
  hasActiveStory: boolean;
  /** Cierto si de esas historias queda alguna sin ver. */
  hasUnseenStory: boolean;
  /** Nulo si no comparte su estado o no hay sesión. */
  isOnline: boolean | null;
  lastSeenAt: string | null;
  /** Cierto si quien mira puede escribirle. */
  canMessage: boolean;
  /** Cuántos de los que sigue quien mira la siguen a ella. */
  mutualFollowerCount: number;
  createdAt: string;
}

/** Cuántas reacciones de un tipo tiene algo. */
export interface ReactionCount {
  type: ReactionType;
  count: number;
}

export interface Post {
  id: string;
  description: string;
  kind: PostKind;
  audience: Audience;
  locationAccuracy: number;
  author: UserSummary;
  location: Location | null;
  media: Media[];
  hashtags: string[];
  mentions: UserSummary[];
  /** La publicación compartida, si ésta comparte otra. Nula si ya no existe o no se puede ver. */
  sharedPost: Post | null;
  /** Cierto si compartía algo que ya no está disponible. */
  sharedPostUnavailable: boolean;
  reactionCount: number;
  /** Las reacciones presentes, de la más usada a la menos. */
  reactionSummary: ReactionCount[];
  /** La reacción de quien mira, o nula. */
  myReaction: ReactionType | null;
  commentCount: number;
  shareCount: number;
  /** Cierto si quien mira la ha guardado. */
  saved: boolean;
  commentsDisabled: boolean;
  /**
   * En qué punto está el seguimiento del autor, para ofrecerlo desde la propia
   * publicación. Nulo sin sesión y en lo propio.
   */
  authorFollowState: FollowState | null;
  /** Los últimos comentarios, para enseñarlos bajo la tarjeta sin abrirla. */
  commentPreview: Comment[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  /** El comentario al que responde; nulo en los de primer nivel. */
  parentId: string | null;
  body: string;
  author: UserSummary;
  mentions: UserSummary[];
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
  /** Los comentarios retirados no se borran: dejarían huecos en el hilo. */
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Quién reaccionó y con qué. */
export interface PostReactor {
  user: UserSummary;
  type: ReactionType;
  followState: FollowState | null;
}

export interface Hashtag {
  tag: string;
  postCount: number;
}

/** Lo que encuentra el buscador. */
export interface SearchResults {
  users: PublicProfile[];
  hashtags: Hashtag[];
  posts: Post[];
}

/** Persona bloqueada por quien consulta. */
export interface BlockedUser {
  user: UserSummary;
  blockedAt: string;
}

/** Una denuncia, vista desde moderación. */
export interface Report {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetOwner: UserSummary | null;
  reporter: UserSummary | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface Bulletin {
  id: string;
  title: string;
  description: string;
  date: string;
  media: Media | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  lang: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  description: string | null;
  location: Location | null;
  media: Media | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  /** Existencias disponibles. */
  stock: number;
  /** Precio unitario, en la divisa configurada en el servidor. */
  price: number;
  warehouse: Warehouse | null;
  media: Media[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product | null;
  quantity: number;
  /** Precio unitario congelado en el momento de añadir el producto al pedido. */
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  state: OrderState;
  total: number;
  customer: UserSummary;
  roundsman: UserSummary | null;
  items: OrderItem[];
  origin: Location | null;
  destination: Location | null;
  takeOutDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  /** Identificador de la transacción en el proveedor de pago. */
  externalId: string | null;
  createdAt: string;
}

export interface Analytics {
  usersTotal: number;
  supportTotal: number;
  postsTotal: number;
  ordersTotal: number;
  gender: Record<Gender | 'unknown', number>;
  ages: {
    children: number;
    teens: number;
    youngAdults: number;
    adults: number;
    unknown: number;
  };
  providers: Record<AuthProvider, number>;
}

export interface UsersRegistrationPoint {
  /** Inicio del intervalo, en formato ISO-8601. */
  date: string;
  users: number;
}
