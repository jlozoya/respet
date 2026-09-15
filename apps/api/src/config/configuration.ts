import { z } from 'zod';

/**
 * Esquema de las variables de entorno.
 *
 * Se valida al arrancar: si falta algo o tiene un formato imposible, el
 * proceso muere de inmediato en lugar de fallar más tarde con un error opaco
 * en mitad de una petición.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  /** Conexiones simultáneas del pool. */
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().max(100).default(20),

  /** URL pública de la propia API, usada para construir enlaces absolutos. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** URL pública de la app, destino de los enlaces de los correos. */
  CLIENT_URL: z.url().default('http://localhost:8100'),
  /** Orígenes permitidos por CORS, separados por comas. */
  CORS_ORIGINS: z.string().default('http://localhost:8100'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  GOOGLE_CLIENT_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_ROOT: z.string().default('storage/uploads'),
  /** Tamaño máximo de subida, en megabytes. */
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),

  MAIL_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_HOST: z.string().default('localhost'),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Respet <no-reply@respet.app>'),
  /** Buzón que recibe copia de los mensajes del formulario de contacto. */
  SUPPORT_MAIL: z.string().optional(),

  PAYPAL_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  /** Id del webhook dado de alta en el panel de PayPal; sin él no se verifica la firma. */
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_CURRENCY: z.string().length(3).default('MXN'),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Configuración tipada de la aplicación, derivada del entorno.
 *
 * `ConfigService` la expone bajo claves anidadas (`config.get('jwt.accessTtl')`).
 */
export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  appUrl: string;
  clientUrl: string;
  corsOrigins: string[];
  database: { url: string; poolSize: number };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  social: {
    googleClientId?: string;
    facebookAppId?: string;
    facebookAppSecret?: string;
  };
  storage: { driver: 'local'; root: string; maxBytes: number };
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

export function buildConfig(): AppConfig {
  const env = validateEnv(process.env);

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    appUrl: env.APP_URL.replace(/\/+$/, ''),
    clientUrl: env.CLIENT_URL.replace(/\/+$/, ''),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: { url: env.DATABASE_URL, poolSize: env.DATABASE_POOL_SIZE },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
    },
    social: {
      googleClientId: env.GOOGLE_CLIENT_ID,
      facebookAppId: env.FACEBOOK_APP_ID,
      facebookAppSecret: env.FACEBOOK_APP_SECRET,
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      root: env.STORAGE_ROOT,
      maxBytes: Math.round(env.UPLOAD_MAX_MB * 1024 * 1024),
    },
    mail: {
      enabled: env.MAIL_ENABLED,
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      user: env.MAIL_USER,
      password: env.MAIL_PASSWORD,
      from: env.MAIL_FROM,
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
  };
}
