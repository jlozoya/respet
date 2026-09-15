import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Reconoce los hashes que generaba Laravel con `Hash::make`.
 *
 * PHP escribe el prefijo `$2y$`, mientras que la mayoría de bibliotecas usan
 * `$2a$` o `$2b$`; los tres son el mismo algoritmo.
 */
const BCRYPT_PATTERN = /^\$2[aby]\$/;

/**
 * Hash y verificación de contraseñas.
 *
 * Se usa Argon2id, ganador del Password Hashing Competition y recomendación
 * actual de OWASP, en lugar del bcrypt que empleaba Laravel: resiste mucho
 * mejor los ataques con GPU gracias a su coste en memoria.
 *
 * Las contraseñas heredadas siguen validándose con bcrypt, porque un hash no
 * se puede reconvertir sin la contraseña en claro. La primera vez que alguien
 * entra con su contraseña de siempre, `needsRehash` avisa y el llamante la
 * guarda ya como Argon2id, de modo que la base se migra sola sin pedir a nadie
 * que restablezca nada.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  private readonly options: argon2.HashOptions = {
    type: argon2.argon2id,
    // Perfil recomendado por OWASP: 19 MiB de memoria y 2 iteraciones.
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      if (BCRYPT_PATTERN.test(hash)) {
        return await bcrypt.compare(plain, hash);
      }

      return await argon2.verify(hash, plain);
    } catch (error) {
      // Un hash con formato corrupto no debe tumbar la petición: se trata
      // igual que una contraseña incorrecta.
      this.logger.warn(`No se pudo verificar un hash de contraseña: ${describe(error)}`);

      return false;
    }
  }

  /**
   * Consume un tiempo parecido al de una verificación real.
   *
   * Se llama cuando el correo no existe, para que el atacante no pueda deducir
   * qué cuentas están dadas de alta midiendo cuánto tarda la respuesta.
   */
  async fakeVerify(): Promise<void> {
    await argon2.hash(randomBytes(16).toString('hex'), this.options);
  }

  /** Indica si conviene regenerar el hash con los parámetros actuales. */
  needsRehash(hash: string): boolean {
    // Todo lo que siga en bcrypt debe migrarse a Argon2id.
    if (BCRYPT_PATTERN.test(hash)) {
      return true;
    }

    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return true;
    }
  }
}

/** Token de un solo uso para enlaces de correo (verificación, contraseña). */
export function createSingleUseToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');

  return { token, hash: hashSingleUseToken(token) };
}

export function hashSingleUseToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparación en tiempo constante de dos cadenas hexadecimales. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
