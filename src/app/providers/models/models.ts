export interface OAuthLogin {
  grant_type: 'password' | 'google' | 'facebook' | 'instagram' | 'twitter' | 'other';
  client_id: number;
  client_secret: string;
  email?: string;
  password?: string;
  scopes?: string;
  extern_id?: number | string;
  accessToken?: string;
}

export interface OAuthSignup {
  extern_id?: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  media?: Media;
  lang: string;
  gender?: string;
  password?: string;
  client_id: number;
  client_secret: string;
  grant_type: 'password' | 'google' | 'facebook' | 'instagram' | 'twitter' | 'other';
  scopes: string;
}

export interface GoogleLogin {
  accessToken: string;
  expires: number;
  expires_in: number;
  email: string;
  userId: number;
  displayName: string;
  familyName: string;
  givenName: string;
  imageUrl: string;
}

export interface FacebookLogin {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  gender: string;
  email: string;
  picture: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    }
  };
}

export interface FacebookImg {
  data: {
    height: number;
    is_silhouette: boolean;
    url: string;
    width: number;
  };
}

export interface PageInterface {
  title: string;
  name: string;
  icon: string;
  logsOut?: boolean;
  link?: any;
}

export interface Sesion {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface User {
  id?: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  gender?: 'male' | 'female' | 'other' | null;
  email?: string;
  password?: string;
  media_id?: number;
  media?: Media;
  extern_id?: number;
  grant_type?: 'password' | 'google' | 'facebook' | 'instagram' | 'twitter' | 'other';
  phone?: string;
  birthday?: string;
  lang?: string;
  role?: 'visitor' | 'user' | 'admin' | 'other';
  address_id?: number;
  address?: Address;
  social_links?: SocialLink[];
  created_at?: string;
}

export interface CatPhone {
  id: number;
  user_id: number;
  phone?: string;
}

export interface CatEmail {
  id: number;
  user_id: number;
  email?: string;
}

export interface UserPermissions {
  id?: number;
  show_main_email: boolean;
  show_alternative_emails: boolean;
  show_main_phone: boolean;
  show_alternative_phones: boolean;
  show_address: boolean;
  receive_mail_adds: boolean;
}

export interface UserContact {
  id: number;
  name: string;
  contact?: UserContactDetail;
}

export interface UserContactDetail {
  email?: string;
  emails: CatEmail[];
  phone: string;
  phones: CatPhone[];
  address?: Address;
}

export interface Post {
  id: number;
  user_id: number;
  user: User;
  description: string;
  state: 'found' | 'lost' | 'on_adoption' | 'on_sale' | 'on_hold' | 'other';
  direction_id?: number;
  direction?: Direction;
  direction_accuracy: number;
  created_at?: string;
  updated_at?: string;
  media?: Media[];
}

export interface Media {
  id?: number;
  type?: 'img' | 'video' | 'link' | 'other';
  url?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface SocialLink {
  id?: number;
  extern_id?: number;
  grant_type?: 'password' | 'google' | 'facebook' | 'instagram' | 'twitter' | 'other';
}

export interface Address {
  id?: number;
  country?: string;
  administrative_area_level_1?: string; // Estado
  administrative_area_level_2?: string; // Ciudad
  route?: string;
  street_number?: string;
  postal_code?: number;
  lat?: string;
  lng?: string;
}

export interface Direction {
  id?: number;
  country?: string;
  administrative_area_level_1?: string; // Estado
  administrative_area_level_2?: string; // Ciudad
  route?: string;
  street_number?: string;
  postal_code?: number;
  lat?: string;
  lng?: string;
}

export interface Ubication {
  name: string;
  direction: Direction;
  latLng: {
    lat: number;
    lng: number;
  };
}

export interface UserRegistrationId {
  id_usuario?: number;
  id_registration?: string;
}

export interface Pagination {
  current_page?: number;
  data?: any[];
  first_page_url?: string;
  from?: number;
  last_page?: number;
  last_page_url?: string;
  next_page_url?: string;
  path?: string;
  per_page?: number;
  prev_page_url?: number;
  to?: number;
  total?: number;
}

export interface Analytics {
  users_number: number;
  gender: {
    male_number: number;
    female_number: number;
  };
  support_number: number;
  ages: {
    children: number;
    teens: number;
    young_adults: number;
    unknown: number;
  };
  grant_types: {
    password: number;
    facebook: number;
    google: number;
  };
}

export interface AnalyticsUsersRegistration {
  created_at: string;
  users: number;
}

export interface Bulletin {
  id?: number;
  title?: string;
  description?: string;
  date?: string;
  media_id?: number;
  media?: Media;
}

export interface Reading {
  id?: number;
  user_id?: number;
  date?: string;
  token?: string;
  synchronized?: boolean;
}

export interface MercadopagoResponse {
  error?: string;
  message?: string;
  cause?: [
    {
      code?: string;
      description?: string;
    }
  ];
  card_number_length?: number;
  cardholder?: {
    identification?: {
      number?: string;
      type?: string;
    }
  };
  email?: string;
  date_created?: string;
  date_due?: string;
  date_last_updated?: string;
  expiration_month?: number;
  expiration_year?: number;
  first_six_digits?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string;
  /** token */
  id?: string;
  last_four_digits?: string;
  live_mode?: boolean;
  luhn_validation?: boolean;
  public_key?: string;
  require_esc?: boolean;
  security_code_length?: number;
  status?: string;
}
