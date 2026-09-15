/**
 * Los trozos de consulta que se repiten, escritos una sola vez.
 *
 * GraphQL obliga a enumerar los campos que se quieren, lo que es una ventaja
 * —la aplicación pide lo que pinta y nada más— pero se convertiría en una
 * copia interminable si cada consulta repitiera la forma de un `Post`. Cada
 * entidad tiene aquí su fragmento y, al lado, la lista de fragmentos de los
 * que depende.
 *
 * `gql` junta la operación con sus fragmentos y quita los repetidos: un mismo
 * documento no puede declarar `MediaFields` dos veces, y llega por dos
 * caminos en cuanto una publicación trae autor y fotos.
 */
export function gql(operation: string, ...fragments: string[]): string {
  return [operation, ...new Set(fragments)].join('\n');
}

const MEDIA = `
fragment MediaFields on Media {
  id
  type
  url
  alt
  width
  height
}`;

const LOCATION = `
fragment LocationFields on Location {
  id
  country
  state
  city
  route
  streetNumber
  postalCode
  lat
  lng
}`;

const PAGE_META = `
fragment PageMetaFields on PaginationMeta {
  page
  perPage
  total
  lastPage
  hasNextPage
  hasPreviousPage
}`;

const USER_SUMMARY = `
fragment UserSummaryFields on UserSummary {
  id
  name
  firstName
  lastName
  avatar { ...MediaFields }
}`;

const PERMISSIONS = `
fragment PermissionsFields on UserPermissions {
  showMainEmail
  showAlternativeEmails
  showMainPhone
  showAlternativePhones
  showLocation
  receiveMailAds
}`;

const USER = `
fragment UserFields on User {
  id
  name
  firstName
  lastName
  email
  gender
  phone
  birthday
  lang
  role
  provider
  emailVerified
  avatar { ...MediaFields }
  location { ...LocationFields }
  permissions { ...PermissionsFields }
  socialLinks { id provider externalId }
  followerCount
  followingCount
  followedByMe
  createdAt
  updatedAt
}`;

const PUBLIC_PROFILE = `
fragment PublicProfileFields on PublicProfile {
  id
  name
  firstName
  lastName
  avatar { ...MediaFields }
  postCount
  followerCount
  followingCount
  followedByMe
  createdAt
}`;

const USER_CONTACT = `
fragment UserContactFields on UserContact {
  id
  name
  email
  emails { id email }
  phone
  phones { id phone }
  location { ...LocationFields }
}`;

const POST = `
fragment PostFields on Post {
  id
  description
  kind
  locationAccuracy
  author { ...UserSummaryFields }
  location { ...LocationFields }
  media { ...MediaFields }
  likeCount
  dislikeCount
  commentCount
  myVote
  createdAt
  updatedAt
}`;

const COMMENT = `
fragment CommentFields on Comment {
  id
  postId
  body
  author { ...UserSummaryFields }
  deleted
  createdAt
  updatedAt
}`;

const BULLETIN = `
fragment BulletinFields on Bulletin {
  id
  title
  description
  date
  media { ...MediaFields }
  createdAt
  updatedAt
}`;

const SUPPORT_TICKET = `
fragment SupportTicketFields on SupportTicket {
  id
  name
  email
  phone
  message
  lang
  createdAt
}`;

const WAREHOUSE = `
fragment WarehouseFields on Warehouse {
  id
  name
  description
  location { ...LocationFields }
  media { ...MediaFields }
  createdAt
  updatedAt
}`;

const PRODUCT = `
fragment ProductFields on Product {
  id
  name
  description
  stock
  price
  warehouse { ...WarehouseFields }
  media { ...MediaFields }
  createdAt
  updatedAt
}`;

const ORDER = `
fragment OrderFields on Order {
  id
  state
  total
  customer { ...UserSummaryFields }
  roundsman { ...UserSummaryFields }
  items {
    id
    productId
    product { ...ProductFields }
    quantity
    unitPrice
    subtotal
  }
  origin { ...LocationFields }
  destination { ...LocationFields }
  takeOutDate
  deliveryDate
  createdAt
  updatedAt
}`;

const PAYMENT = `
fragment PaymentFields on Payment {
  id
  orderId
  provider
  status
  amount
  currency
  externalId
  createdAt
}`;

const CONVERSATION = `
fragment ConversationFields on Conversation {
  id
  peer { ...UserSummaryFields }
  lastMessageAt
  lastPreview
  unreadCount
  muted
}`;

const MESSAGE = `
fragment MessageFields on Message {
  id
  conversationId
  kind
  body
  media { ...MediaFields }
  sender { ...UserSummaryFields }
  deleted
  createdAt
}`;

export const PAGE_META_FRAGMENTS = [PAGE_META];
export const MEDIA_FRAGMENTS = [MEDIA];
export const USER_SUMMARY_FRAGMENTS = [USER_SUMMARY, MEDIA];
export const PERMISSIONS_FRAGMENTS = [PERMISSIONS];
export const USER_FRAGMENTS = [USER, MEDIA, LOCATION, PERMISSIONS];
export const PUBLIC_PROFILE_FRAGMENTS = [PUBLIC_PROFILE, MEDIA];
export const USER_CONTACT_FRAGMENTS = [USER_CONTACT, LOCATION];
export const POST_FRAGMENTS = [POST, USER_SUMMARY, MEDIA, LOCATION];
export const COMMENT_FRAGMENTS = [COMMENT, USER_SUMMARY, MEDIA];
export const BULLETIN_FRAGMENTS = [BULLETIN, MEDIA];
export const SUPPORT_TICKET_FRAGMENTS = [SUPPORT_TICKET];
export const WAREHOUSE_FRAGMENTS = [WAREHOUSE, LOCATION, MEDIA];
export const PRODUCT_FRAGMENTS = [PRODUCT, WAREHOUSE, LOCATION, MEDIA];
export const ORDER_FRAGMENTS = [ORDER, USER_SUMMARY, PRODUCT, WAREHOUSE, LOCATION, MEDIA];
export const PAYMENT_FRAGMENTS = [PAYMENT];
export const CONVERSATION_FRAGMENTS = [CONVERSATION, USER_SUMMARY, MEDIA];
export const MESSAGE_FRAGMENTS = [MESSAGE, USER_SUMMARY, MEDIA];
