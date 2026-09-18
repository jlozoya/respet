import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Comprueba que una dirección de webhook apunta a Internet y no a la red
 * interna.
 *
 * Un webhook es una petición que el servidor hace a donde diga un tercero.
 * Sin esta comprobación, cualquiera con una aplicación registrada podría hacer
 * que la API llamara a `http://169.254.169.254` —los metadatos del proveedor
 * de la nube— o a la base de datos de la red privada.
 */
export async function assertPublicUrl(raw: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error('The URL is not valid');
  }

  if (url.protocol !== 'https:' && !(allowPrivate && url.protocol === 'http:')) {
    throw new Error('The URL must use HTTPS');
  }

  if (url.username || url.password) {
    throw new Error('The URL must not include credentials');
  }

  if (allowPrivate) {
    return url;
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('The URL points to a private network');
  }

  return url;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();

    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') ||
      (normalized.startsWith('::ffff:') && isPrivateAddress(normalized.slice('::ffff:'.length)))
    );
  }

  const [a = 0, b = 0] = address.split('.').map(Number);

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
