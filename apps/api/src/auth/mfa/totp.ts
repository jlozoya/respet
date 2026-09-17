import { createHmac, randomBytes } from 'node:crypto';

/**
 * Contraseñas de un solo uso basadas en el tiempo (RFC 6238).
 *
 * Es lo que calculan Google Authenticator, Authy, 1Password y compañía: un
 * HMAC-SHA1 del número de intervalos de 30 segundos transcurridos, recortado a
 * seis cifras. Se implementa aquí en lugar de traer una biblioteca porque son
 * cuarenta líneas estables desde 2011 y así no hay dependencia que vigilar.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

/**
 * Intervalos de margen a cada lado del actual.
 *
 * Uno: un reloj de móvil desviado medio minuto, o un código tecleado justo al
 * cambiar, siguen valiendo. Más margen sólo abre la ventana a quien adivina.
 */
const WINDOW = 1;

/** Un secreto nuevo de 160 bits, en base32 como lo esperan las apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** El intervalo en curso. */
export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Comprueba un código y devuelve el intervalo con el que coincide.
 *
 * Se rechazan los intervalos ya usados —`lastUsedStep` y anteriores—: sin esto
 * el mismo código valdría varias veces durante su medio minuto.
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastUsedStep: number | null,
  now = Date.now(),
): number | null {
  const normalized = code.replace(/\s+/g, '');

  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  const current = currentStep(now);

  for (let delta = -WINDOW; delta <= WINDOW; delta += 1) {
    const step = current + delta;

    if (lastUsedStep !== null && step <= lastUsedStep) {
      continue;
    }

    if (constantTimeEquals(totpAt(secret, step), normalized)) {
      return step;
    }
  }

  return null;
}

/** La dirección `otpauth://` que codifica el código QR. */
export function otpauthUrl(options: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${options.issuer}:${options.account}`);
  const params = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error('Secreto base32 inválido');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}
