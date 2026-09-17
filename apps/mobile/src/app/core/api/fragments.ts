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
  mimeType
  sizeBytes
  durationMs
  posterUrl
  fileName
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
  verified
  avatar { id url alt }
}`;

const PERMISSIONS = `
fragment PermissionsFields on UserPermissions {
  showMainEmail
  showAlternativeEmails
  showMainPhone
  showAlternativePhones
  showLocation
  receiveMailAds
  messagePolicy
  privateProfile
  showOnlineStatus
  storyReplyPolicy
  loginAlerts
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
  bio
  website
  verified
  mfaEnabled
  avatar { ...MediaFields }
  cover { ...MediaFields }
  location { ...LocationFields }
  permissions { ...PermissionsFields }
  socialLinks { id provider externalId }
  followerCount
  followingCount
  followState
  createdAt
  updatedAt
}`;

const PUBLIC_PROFILE = `
fragment PublicProfileFields on PublicProfile {
  id
  name
  firstName
  lastName
  bio
  website
  verified
  avatar { ...MediaFields }
  cover { ...MediaFields }
  postCount
  followerCount
  followingCount
  followState
  isPrivate
  canViewContent
  blockedByViewer
  hasActiveStory
  hasUnseenStory
  isOnline
  lastSeenAt
  canMessage
  mutualFollowerCount
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

const COMMENT = `
fragment CommentFields on Comment {
  id
  postId
  parentId
  body
  author { ...UserSummaryFields }
  mentions { ...UserSummaryFields }
  likeCount
  likedByMe
  replyCount
  deleted
  editedAt
  createdAt
  updatedAt
}`;

/**
 * Lo que se comparte de una publicación compartida.
 *
 * Un fragmento aparte y sin `sharedPost` dentro: GraphQL no admite fragmentos
 * recursivos, y una publicación que comparte otra que a su vez comparte una
 * tercera se enseña, como en Facebook, sólo con el primer salto.
 */
const SHARED_POST = `
fragment SharedPostFields on Post {
  id
  description
  kind
  audience
  author { ...UserSummaryFields }
  location { ...LocationFields }
  locationAccuracy
  media { ...MediaFields }
  hashtags
  createdAt
}`;

const POST = `
fragment PostFields on Post {
  id
  description
  kind
  audience
  locationAccuracy
  author { ...UserSummaryFields }
  location { ...LocationFields }
  media { ...MediaFields }
  hashtags
  mentions { ...UserSummaryFields }
  sharedPost { ...SharedPostFields }
  sharedPostUnavailable
  reactionCount
  reactionSummary { type count }
  myReaction
  commentCount
  shareCount
  saved
  commentsDisabled
  authorFollowState
  commentPreview { ...CommentFields }
  editedAt
  createdAt
  updatedAt
}`;

/**
 * Lo justo para una casilla de cuadrícula: la foto, y las cifras que salen al
 * pasar por encima. Explorar pide treinta de golpe, y con la publicación
 * entera la consulta superaría el coste máximo que admite el servidor.
 */
const POST_GRID = `
fragment PostGridFields on Post {
  id
  description
  media { id type url alt width height posterUrl }
  reactionCount
  commentCount
}`;

const STORY = `
fragment StoryFields on Story {
  id
  author { ...UserSummaryFields }
  kind
  media { ...MediaFields }
  text
  style { background font }
  durationMs
  audience
  seen
  myReaction
  viewCount
  reactionCount
  canReply
  expiresAt
  createdAt
}`;

const LIVE_STREAM = `
fragment LiveStreamFields on LiveStream {
  id
  host { ...UserSummaryFields }
  title
  status
  audience
  viewerCount
  peakViewerCount
  reactionCount
  commentCount
  startedAt
  endedAt
}`;

const LIVE_COMMENT = `
fragment LiveCommentFields on LiveComment {
  id
  streamId
  author { ...UserSummaryFields }
  body
  createdAt
}`;

const NOTIFICATION = `
fragment NotificationFields on Notification {
  id
  type
  actors { ...UserSummaryFields }
  actorCount
  postId
  commentId
  storyId
  liveStreamId
  thumbnail { ...MediaFields }
  preview
  read
  createdAt
  updatedAt
}`;

const CONVERSATION = `
fragment ConversationFields on Conversation {
  id
  type
  title
  photo { ...MediaFields }
  peer { ...UserSummaryFields }
  members {
    user { ...UserSummaryFields }
    role
    lastReadMessageId
    lastReadAt
    joinedAt
  }
  myRole
  lastMessageAt
  lastPreview
  lastSenderId
  unreadCount
  muted
  archived
  pinned
  readOnly
  createdAt
}`;

const MESSAGE = `
fragment MessageFields on Message {
  id
  conversationId
  clientId
  kind
  body
  attachments { ...MediaFields }
  replyTo {
    id
    kind
    body
    deleted
    sender { ...UserSummaryFields }
    thumbnail { ...MediaFields }
  }
  sharedPost {
    id
    description
    author { ...UserSummaryFields }
    media { id type url alt width height posterUrl }
  }
  story { id text expired media { ...MediaFields } }
  system { action value targets { ...UserSummaryFields } }
  sender { ...UserSummaryFields }
  reactions { emoji count userIds reactedByMe }
  status
  readCount
  editedAt
  deleted
  createdAt
}`;

const DEVICE = `
fragment DeviceFields on DeviceInfo {
  type
  name
  browser
  os
}`;

const SCOPE = `
fragment ScopeFields on OAuthScopeInfo {
  scope
  title
  description
  sensitive
}`;

const DEVELOPER_APP = `
fragment DeveloperAppFields on DeveloperApp {
  id
  name
  description
  websiteUrl
  privacyPolicyUrl
  icon { ...MediaFields }
  clientId
  clientSecretHint
  clientType
  status
  redirectUris
  allowedScopes
  testers { ...UserSummaryFields }
  webhook { url events active verifiedAt }
  rateLimitPerHour
  userCount
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

/*
 * Cada lista lleva exactamente los fragmentos que usa su entidad: GraphQL
 * rechaza un documento que declare un fragmento sin usarlo, así que sobrar
 * uno es tan grave como faltar.
 */
export const PAGE_META_FRAGMENTS = [PAGE_META];
export const MEDIA_FRAGMENTS = [MEDIA];
export const USER_SUMMARY_FRAGMENTS = [USER_SUMMARY];
export const PERMISSIONS_FRAGMENTS = [PERMISSIONS];
export const USER_FRAGMENTS = [USER, MEDIA, LOCATION, PERMISSIONS];
export const PUBLIC_PROFILE_FRAGMENTS = [PUBLIC_PROFILE, MEDIA];
export const USER_CONTACT_FRAGMENTS = [USER_CONTACT, LOCATION];
export const COMMENT_FRAGMENTS = [COMMENT, USER_SUMMARY];
export const POST_FRAGMENTS = [POST, SHARED_POST, COMMENT, USER_SUMMARY, LOCATION, MEDIA];
export const POST_GRID_FRAGMENTS = [POST_GRID];
export const STORY_FRAGMENTS = [STORY, USER_SUMMARY, MEDIA];
export const LIVE_STREAM_FRAGMENTS = [LIVE_STREAM, USER_SUMMARY];
export const LIVE_COMMENT_FRAGMENTS = [LIVE_COMMENT, USER_SUMMARY];
export const NOTIFICATION_FRAGMENTS = [NOTIFICATION, USER_SUMMARY, MEDIA];
export const CONVERSATION_FRAGMENTS = [CONVERSATION, USER_SUMMARY, MEDIA];
export const MESSAGE_FRAGMENTS = [MESSAGE, USER_SUMMARY, MEDIA];
export const DEVICE_FRAGMENTS = [DEVICE];
export const SCOPE_FRAGMENTS = [SCOPE];
export const DEVELOPER_APP_FRAGMENTS = [DEVELOPER_APP, USER_SUMMARY, MEDIA];
export const BULLETIN_FRAGMENTS = [BULLETIN, MEDIA];
export const SUPPORT_TICKET_FRAGMENTS = [SUPPORT_TICKET];
export const WAREHOUSE_FRAGMENTS = [WAREHOUSE, LOCATION, MEDIA];
export const PRODUCT_FRAGMENTS = [PRODUCT, WAREHOUSE, LOCATION, MEDIA];
export const ORDER_FRAGMENTS = [ORDER, USER_SUMMARY, PRODUCT, WAREHOUSE, LOCATION, MEDIA];
export const PAYMENT_FRAGMENTS = [PAYMENT];
