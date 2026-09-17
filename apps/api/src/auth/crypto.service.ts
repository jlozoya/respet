import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** Versión del formato cifrado, por si algún día cambia el algoritmo. */
const CIPHER_VERSION = 'v1';

/**
 * Las operaciones criptográficas de la autenticación, en un solo sitio.
 *
 * - **Tokens opacos** —refresh tokens, códigos de OAuth, dispositivos de
 *   confianza—: se generan al azar y se guardan como HMAC-SHA256 con una
 *   clave del servidor. Con un hash sin clave bastaría para no guardarlos en
 *   claro; con clave, además, una copia de la base no permite ni comprobar si
 *   un token robado es válido.
 * - **Secretos que hay que recuperar** —el de TOTP, el de un webhook—: se
 *   cifran con AES-256-GCM, que además de ocultar detecta cualquier
 *   manipulación del texto cifrado.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly hmacKey: Buffer;
  private readonly encryptionKey: Buffer;

  constructor(config: ConfigService) {
    const refreshSecret = config.getOrThrow<string>('jwt.refreshSecret');

    this.hmacKey = Buffer.from(refreshSecret, 'utf8');

    const explicit = config.get<string>('mfa.encryptionKey');

    if (explicit) {
      this.encryptionKey = Buffer.from(explicit, 'base64');
    } else {
      // Sólo en desarrollo, que en producción la configuración lo exige.
      this.logger.warn(
        'MFA_ENCRYPTION_KEY no está definida: se deriva de JWT_REFRESH_SECRET (sólo apto para desarrollo)',
      );
      this.encryptionKey = Buffer.from(
        hkdfSync('sha256', refreshSecret, 'respet', 'mfa-encryption', 32),
      );
    }
  }

  /** Un token aleatorio en base64url con `bytes` de entropía. */
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** Hash con clave de un token opaco, para guardarlo y buscarlo. */
  hashToken(token: string): string {
    return createHmac('sha256', this.hmacKey).update(token).digest('hex');
  }

  /** Comparación en tiempo constante. */
  safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');

    return left.length === right.length && timingSafeEqual(left, right);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [CIPHER_VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ciphertext] = payload.split(':');

    if (version !== CIPHER_VERSION || !iv || !tag || !ciphertext) {
      throw new Error('Formato cifrado desconocido');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** SHA-256 en base64url, el que usa PKCE para el reto `S256`. */
  sha256Base64Url(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
  }
}
