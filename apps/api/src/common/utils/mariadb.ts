import type { PoolConfig } from 'mariadb';

/**
 * Opciones del driver a partir de la URL de conexión.
 *
 * Desde Prisma 7 la conexión la abre un driver adapter, no el motor de Prisma,
 * así que la URL deja de ser un ajuste de Prisma para convertirse en la entrada
 * de esta función: aquí se desglosa en lo que el conector de MariaDB espera.
 * `PrismaMariaDb` también acepta la cadena tal cual, pero entonces no hay dónde
 * colgar el tamaño del pool ni los ajustes de autenticación, y son justo los que
 * hacen falta para hablar con un MySQL 8.
 *
 * Además de usuario, contraseña y base, se leen de la cadena de consulta:
 *
 *   * `ssl=true` cifra la conexión; `ssl=skip-verify` la cifra sin comprobar el
 *     certificado del servidor, que es lo práctico con uno autofirmado.
 *   * `cachingRsaPublicKey=<ruta>` entrega la clave pública del servidor desde
 *     un fichero local.
 *   * `allowPublicKeyRetrieval=true|false` impone el valor que se explica más
 *     abajo, en lugar de deducirlo del anfitrión.
 */
export function mariadbOptions(url: string, overrides: PoolConfig = {}): PoolConfig {
  const parsed = new URL(url);
  const params = parsed.searchParams;
  // La URL escribe las direcciones IPv6 entre corchetes; el driver las quiere sin ellos.
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const ssl = parseSsl(params.get('ssl'));
  const cachingRsaPublicKey = params.get('cachingRsaPublicKey') ?? undefined;

  return {
    host,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    ...(ssl === undefined ? {} : { ssl }),
    ...(cachingRsaPublicKey === undefined ? {} : { cachingRsaPublicKey }),
    allowPublicKeyRetrieval: parseBoolean(params.get('allowPublicKeyRetrieval')) ?? isLoopback(host),
    ...overrides,
  };
}

/**
 * ¿Puede el cliente pedirle al servidor su clave pública RSA?
 *
 * MySQL 8 autentica con `caching_sha2_password`. La primera vez que alguien se
 * conecta —y de nuevo tras cada reinicio o `FLUSH PRIVILEGES`, que vacían la
 * caché del servidor— el intercambio completo exige que la contraseña viaje
 * protegida: o el canal lleva TLS, o el cliente la cifra con la clave pública
 * del servidor. Sin ninguna de las dos, cada intento muere con
 * `ER_CANNOT_RETRIEVE_RSA_KEY`; y como el pool los reintenta en silencio hasta
 * agotar `acquireTimeout`, lo único que se ve es un «pool timeout» con cero
 * conexiones, que señala al sitio equivocado.
 *
 * Pedirle la clave al propio servidor es cómodo, pero deja la contraseña a
 * merced de un intermediario que conteste con la suya, así que sólo se hace
 * contra la máquina local: el caso de desarrollo y el del contenedor de Docker.
 * Contra una base remota lo correcto es TLS (`?ssl=true`) o llevar la clave en
 * un fichero (`?cachingRsaPublicKey=...`).
 */
function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

function parseSsl(value: string | null): PoolConfig['ssl'] {
  if (value === null) {
    return undefined;
  }

  if (value === 'skip-verify') {
    return { rejectUnauthorized: false };
  }

  return parseBoolean(value) ?? undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  return value === 'true' || value === '1';
}
