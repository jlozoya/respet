import type {
  AuthProvider,
  Gender,
  MediaType,
  OrderState,
  PaymentProvider,
  PaymentStatus,
  PostKind,
  UserRole,
  VoteValue,
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

export interface Media {
  id: string;
  type: MediaType;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
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
  location: Location | null;
  permissions: UserPermissions | null;
  socialLinks: SocialLink[];
  followerCount: number;
  followingCount: number;
  /** Nulo para quien no ha iniciado sesión, y también en la propia ficha. */
  followedByMe: boolean | null;
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

/** Autor embebido en publicaciones y pedidos. */
export interface UserSummary {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar: Media | null;
}

/** Cifras de seguimiento de una persona, y si quien mira la sigue. */
export interface FollowInfo {
  followerCount: number;
  followingCount: number;
  /** Nulo para quien no ha iniciado sesión: no hay a quién referirlo. */
  followedByMe: boolean | null;
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
  postCount: number;
  createdAt: string;
}

export interface Post {
  id: string;
  description: string;
  kind: PostKind;
  locationAccuracy: number;
  author: UserSummary;
  location: Location | null;
  media: Media[];
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  /**
   * Voto de quien mira, o `null` si no ha votado —o si no hay sesión, que no
   * es lo mismo que haber votado en contra—.
   */
  myVote: VoteValue | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  author: UserSummary;
  /** Los comentarios retirados no se borran: dejarían huecos en el hilo. */
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
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
