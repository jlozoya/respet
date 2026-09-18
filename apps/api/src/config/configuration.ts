import { z } from 'zod';
import { DEFAULT_BRANDING, type Branding } from '@social-network/shared';

/** Lee `true`/`false` de una variable de entorno, que siempre llega como texto. */
const bool = (fallback: 'true' | 'false') =>
  z
    .string()
    .default(fallback)
    .transform((value) => value === 'true');

/**
 * Esquema de las variables de entorno.
 *
 * Se valida al arrancar: si falta algo o tiene un formato imposible, el
 * proceso muere de inmediato en lugar de fallar más tarde con un error opaco
 * en mitad de una petición.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('api'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    /** Conexiones simultáneas del pool. */
    DATABASE_POOL_SIZE: z.coerce.number().int().positive().max(100).default(20),

    /**
     * Redis, opcional.
     *
     * Sin él, los avisos en tiempo real, la presencia y los límites de
     * peticiones viven en la memoria del proceso: basta con una instancia.
     * Con varias detrás de un balanceador hace falta, o cada una sólo vería
     * a los clientes que tiene conectados.
     */
    REDIS_URL: z.string().optional(),

    /** URL pública de la propia API, usada para construir enlaces absolutos. */
    APP_URL: z.url().default('http://localhost:3000'),
    /** URL pública de la app, destino de los enlaces de los correos. */
    CLIENT_URL: z.url().default('http://localhost:8100'),
    /** Orígenes permitidos por CORS, separados por comas. */
    CORS_ORIGINS: z.string().default('http://localhost:8100'),

    /**
     * La marca.
     *
     * Nada de esto está escrito en el código: el nombre, el eslogan, el
     * logotipo, los colores y los enlaces se deciden aquí y la aplicación los
     * pide en la consulta pública `branding`. Quien despliegue esto le pone su
     * nombre sin recompilar nada.
     */
    APP_NAME: z.string().min(1).default(DEFAULT_BRANDING.name),
    APP_TAGLINE: z.string().default(DEFAULT_BRANDING.tagline),
    APP_DESCRIPTION: z.string().default(DEFAULT_BRANDING.description),
    /** Logotipo horizontal para la cabecera; sin él se dibuja la marca por defecto. */
    APP_LOGO_URL: z.string().optional(),
    /** Icono cuadrado para la pestaña del navegador y los correos. */
    APP_ICON_URL: z.string().optional(),
    /** Color principal, en hexadecimal. */
    APP_BRAND_COLOR: z
      .string()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'APP_BRAND_COLOR debe ser un color hexadecimal')
      .default(DEFAULT_BRANDING.brandColor),
    /** Degradado de los adornos: el aro de las historias, los botones grandes. */
    APP_BRAND_GRADIENT: z.string().default(DEFAULT_BRANDING.brandGradient),
    APP_WEBSITE: z.string().optional(),
    /** Buzón de contacto que se enseña en la aplicación. */
    APP_PUBLIC_MAIL: z.string().optional(),
    APP_PHONE: z.string().optional(),
    APP_ADDRESS: z.string().optional(),
    APP_FACEBOOK: z.string().optional(),
    APP_INSTAGRAM: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    /**
     * Clave con la que se firman los hash de los tokens opacos: refresh
     * tokens, códigos de OAuth y dispositivos de confianza.
     *
     * Conserva el nombre de cuando el refresh token era un JWT firmado con
     * ella, para que los `.env` que ya existen sigan sirviendo.
     */
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    /** Días sin usar la sesión tras los que caduca. Cada uso los renueva. */
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /** Vida máxima de una sesión, se use o no: pasado esto hay que volver a entrar. */
    SESSION_ABSOLUTE_TTL_DAYS: z.coerce.number().int().positive().default(180),

    /**
     * Clave de 32 bytes, en base64, con la que se cifran los secretos TOTP.
     *
     * Obligatoria en producción. En desarrollo, si falta, se deriva de
     * `JWT_REFRESH_SECRET`: cambiar esa variable dejaría entonces inservibles
     * los segundos factores ya configurados.
     */
    MFA_ENCRYPTION_KEY: z.string().optional(),
    /** Nombre con el que aparece la cuenta en la app de autenticación; por defecto, el de la marca. */
    MFA_ISSUER: z.string().optional(),
    /** Días que un dispositivo marcado como de confianza se salta el segundo factor. */
    TRUSTED_DEVICE_TTL_DAYS: z.coerce.number().int().positive().default(30),

    GOOGLE_CLIENT_ID: z.string().optional(),
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),

    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_ROOT: z.string().default('storage/uploads'),
    /** Tamaño máximo de una imagen, en megabytes. */
    UPLOAD_MAX_MB: z.coerce.number().positive().default(10),
    /** Tamaño máximo de un vídeo, en megabytes. */
    VIDEO_UPLOAD_MAX_MB: z.coerce.number().positive().default(100),
    /** Tamaño máximo de un audio —las notas de voz—, en megabytes. */
    AUDIO_UPLOAD_MAX_MB: z.coerce.number().positive().default(15),
    /**
     * Ejecutables de FFmpeg, para sacar la portada y la duración de los
     * vídeos. Opcionales: sin ellos los vídeos se guardan igual, sólo que sin
     * portada. La imagen de Docker los trae instalados.
     */
    FFMPEG_PATH: z.string().optional(),
    FFPROBE_PATH: z.string().optional(),

    MAIL_ENABLED: bool('false'),
    MAIL_HOST: z.string().default('localhost'),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: bool('false'),
    MAIL_USER: z.string().optional(),
    MAIL_PASSWORD: z.string().optional(),
    /** Remitente de los correos; por defecto, la marca en el dominio de la API. */
    MAIL_FROM: z.string().optional(),
    /** Buzón que recibe copia de los mensajes del formulario de contacto. */
    SUPPORT_MAIL: z.string().optional(),

    PAYPAL_ENABLED: bool('false'),
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_CLIENT_SECRET: z.string().optional(),
    PAYPAL_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    /** Id del webhook dado de alta en el panel de PayPal; sin él no se verifica la firma. */
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    PAYPAL_CURRENCY: z.string().length(3).default('MXN'),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    /**
     * Si el esquema se puede inspeccionar.
     *
     * Encendido por defecto también en producción: la API se ofrece a
     * aplicaciones de terceros, y sin introspección no hay explorador ni
     * generadores de tipos que valgan. Lo que protege al servidor son los
     * límites de profundidad y de coste, no esconder el esquema.
     */
    GRAPHQL_INTROSPECTION: bool('true'),
    /** Anidamiento máximo de una consulta. */
    GRAPHQL_MAX_DEPTH: z.coerce.number().int().positive().default(12),
    /** Coste máximo de una consulta, estimado antes de ejecutarla. */
    GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().positive().default(5000),

    /** Vida del access token de una aplicación de terceros. */
    OAUTH_ACCESS_TTL: z.string().default('1h'),
    /** Días que dura el refresh token de una aplicación de terceros. */
    OAUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(60),
    /** Peticiones por hora que puede hacer cada aplicación en nombre de cada persona. */
    OAUTH_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(600),

    /**
     * Servidor de LiveKit para los directos.
     *
     * `LIVEKIT_URL` es la dirección `wss://` a la que se conectan los
     * clientes; `LIVEKIT_API_URL`, la `https://` que usa la API para
     * gestionar las salas —si falta, se deduce de la primera—. Sin la clave y
     * el secreto los directos quedan desactivados.
     */
    LIVEKIT_URL: z.string().optional(),
    LIVEKIT_API_URL: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),

    /** Horas que se ve una historia. */
    STORY_TTL_HOURS: z.coerce.number().int().positive().max(168).default(24),

    /**
     * Cuenta de servicio de Firebase, en JSON o en base64, para las
     * notificaciones push. Opcional: sin ella sólo hay avisos dentro de la app.
     */
    FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && !env.MFA_ENCRYPTION_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['MFA_ENCRYPTION_KEY'],
        message: 'MFA_ENCRYPTION_KEY es obligatoria en producción',
      });
    }

    if (env.MFA_ENCRYPTION_KEY && Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64').length !== 32) {
      context.addIssue({
        code: 'custom',
        path: ['MFA_ENCRYPTION_KEY'],
        message: 'MFA_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Configuración tipada de la aplicación, derivada del entorno.
 *
 * `ConfigService` la expone bajo claves anidadas (`config.get('jwt.accessTtl')`).
 */
export interface AppConfig {
  env: Env['NODE_ENV'];
  /** Nombre, colores, logotipo y enlaces; lo que la aplicación pinta. */
  branding: Branding;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  appUrl: string;
  clientUrl: string;
  corsOrigins: string[];
  database: { url: string; poolSize: number };
  redis: { url?: string };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  session: { idleTtlDays: number; absoluteTtlDays: number };
  mfa: { encryptionKey?: string; issuer: string; trustedDeviceTtlDays: number };
  social: {
    googleClientId?: string;
    facebookAppId?: string;
    facebookAppSecret?: string;
  };
  storage: {
    driver: 'local';
    root: string;
    maxBytes: number;
    maxVideoBytes: number;
    maxAudioBytes: number;
    ffmpegPath?: string;
    ffprobePath?: string;
  };
  mail: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
    supportMail?: string;
  };
  paypal: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    environment: 'sandbox' | 'production';
    currency: string;
    webhookId?: string;
  };
  throttle: { ttlSeconds: number; limit: number };
  graphql: { introspection: boolean; maxDepth: number; maxComplexity: number };
  oauth: { accessTtl: string; refreshTtlDays: number; rateLimitPerHour: number };
  livekit: { url?: string; apiUrl?: string; apiKey?: string; apiSecret?: string };
  stories: { ttlHours: number };
  push: { firebaseServiceAccount?: string };
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${details}`);
  }

  return parsed.data;
}

/** Lo que llegue vacío no cuenta: vale más el valor por defecto que una cadena en blanco. */
const text = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

/** La marca tal y como la verá la aplicación, con los valores por defecto donde no haya nada. */
function brandingOf(env: Env): Branding {
  return {
    name: env.APP_NAME.trim(),
    tagline: env.APP_TAGLINE.trim(),
    description: env.APP_DESCRIPTION.trim(),
    logoUrl: text(env.APP_LOGO_URL),
    iconUrl: text(env.APP_ICON_URL),
    brandColor: env.APP_BRAND_COLOR,
    brandGradient: env.APP_BRAND_GRADIENT,
    website: text(env.APP_WEBSITE),
    publicMail: text(env.APP_PUBLIC_MAIL),
    phone: text(env.APP_PHONE),
    address: text(env.APP_ADDRESS),
    facebook: text(env.APP_FACEBOOK),
    instagram: text(env.APP_INSTAGRAM),
  };
}

/**
 * Remitente por defecto: la marca en el dominio de la propia API.
 *
 * Sirve para desarrollo y para que un despliegue pequeño funcione sin
 * configurar nada; con un dominio propio conviene poner `MAIL_FROM`.
 */
function defaultMailFrom(name: string, appUrl: string): string {
  let host = 'localhost';

  try {
    host = new URL(appUrl).hostname;
  } catch {
    // Con una dirección rara se queda en localhost, que es lo que había antes.
  }

  return `${name} <no-reply@${host}>`;
}

const megabytes = (value: number): number => Math.round(value * 1024 * 1024);

/** De `wss://host` a `https://host`: la API de LiveKit escucha en el mismo sitio. */
function httpUrlOf(websocketUrl: string | undefined): string | undefined {
  return websocketUrl?.replace(/^ws(s?):/, 'http$1:');
}

export function buildConfig(): AppConfig {
  const env = validateEnv(process.env);

  const branding = brandingOf(env);

  return {
    env: env.NODE_ENV,
    branding,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    appUrl: env.APP_URL.replace(/\/+$/, ''),
    clientUrl: env.CLIENT_URL.replace(/\/+$/, ''),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: { url: env.DATABASE_URL, poolSize: env.DATABASE_POOL_SIZE },
    redis: { url: env.REDIS_URL || undefined },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
    },
    session: {
      idleTtlDays: env.JWT_REFRESH_TTL_DAYS,
      absoluteTtlDays: Math.max(env.SESSION_ABSOLUTE_TTL_DAYS, env.JWT_REFRESH_TTL_DAYS),
    },
    mfa: {
      encryptionKey: env.MFA_ENCRYPTION_KEY,
      issuer: env.MFA_ISSUER || branding.name,
      trustedDeviceTtlDays: env.TRUSTED_DEVICE_TTL_DAYS,
    },
    social: {
      googleClientId: env.GOOGLE_CLIENT_ID,
      facebookAppId: env.FACEBOOK_APP_ID,
      facebookAppSecret: env.FACEBOOK_APP_SECRET,
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      root: env.STORAGE_ROOT,
      maxBytes: megabytes(env.UPLOAD_MAX_MB),
      maxVideoBytes: megabytes(env.VIDEO_UPLOAD_MAX_MB),
      maxAudioBytes: megabytes(env.AUDIO_UPLOAD_MAX_MB),
      ffmpegPath: env.FFMPEG_PATH || undefined,
      ffprobePath: env.FFPROBE_PATH || undefined,
    },
    mail: {
      enabled: env.MAIL_ENABLED,
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      user: env.MAIL_USER,
      password: env.MAIL_PASSWORD,
      from: env.MAIL_FROM || defaultMailFrom(branding.name, env.APP_URL),
      supportMail: env.SUPPORT_MAIL,
    },
    paypal: {
      enabled: env.PAYPAL_ENABLED,
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      environment: env.PAYPAL_ENVIRONMENT,
      currency: env.PAYPAL_CURRENCY,
      webhookId: env.PAYPAL_WEBHOOK_ID,
    },
    throttle: { ttlSeconds: env.THROTTLE_TTL_SECONDS, limit: env.THROTTLE_LIMIT },
    graphql: {
      introspection: env.GRAPHQL_INTROSPECTION,
      maxDepth: env.GRAPHQL_MAX_DEPTH,
      maxComplexity: env.GRAPHQL_MAX_COMPLEXITY,
    },
    oauth: {
      accessTtl: env.OAUTH_ACCESS_TTL,
      refreshTtlDays: env.OAUTH_REFRESH_TTL_DAYS,
      rateLimitPerHour: env.OAUTH_RATE_LIMIT_PER_HOUR,
    },
    livekit: {
      url: env.LIVEKIT_URL || undefined,
      apiUrl: env.LIVEKIT_API_URL || httpUrlOf(env.LIVEKIT_URL || undefined),
      apiKey: env.LIVEKIT_API_KEY || undefined,
      apiSecret: env.LIVEKIT_API_SECRET || undefined,
    },
    stories: { ttlHours: env.STORY_TTL_HOURS },
    push: { firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT || undefined },
  };
}
