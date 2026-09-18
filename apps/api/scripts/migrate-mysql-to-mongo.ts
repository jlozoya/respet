/**
 * Vuelca la base de MySQL a MongoDB.
 *
 * Se ejecuta una sola vez, al cambiar de motor. Lee la base anterior indicada
 * en `MYSQL_URL` y escribe en la de `DATABASE_URL`, que a estas alturas ya
 * apunta a Mongo. No toca la base de origen, así que se puede repetir mientras
 * se afina; eso sí, vacía las colecciones de destino antes de escribir.
 *
 * Uso:
 *   npm run migrate:mongo -w @social-network/api
 *   npm run migrate:mongo -w @social-network/api -- --dry
 *
 * Tres cosas cambian de forma, por obligación del motor:
 *
 *   * Los identificadores enteros pasan a `ObjectId`. Se genera uno por fila
 *     ANTES de escribir nada, de modo que las referencias entre tablas se
 *     traducen sin depender del orden de inserción.
 *   * Los importes pasan a céntimos enteros: Mongo no tiene `DECIMAL` y con
 *     coma flotante se perderían céntimos al sumar.
 *   * Los campos dejan el `snake_case` de las columnas por el `camelCase` que
 *     se lee tal cual desde JavaScript.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConnection } from 'mariadb';
// El driver de Mongo llega con Mongoose; se toma de ahí en lugar de
// declararlo como dependencia aparte sólo para este volcado.
import mongoose from 'mongoose';

import { mariadbOptions } from '../src/common/utils/mariadb.js';

const envFile = resolve(import.meta.dirname, '..', '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const DRY_RUN = process.argv.includes('--dry');

/** Columnas con dinero, que pasan de `DECIMAL(10,2)` a céntimos enteros. */
const IMPORTES = new Set(['price', 'total', 'unit_price', 'amount']);

/** Tablas que no son modelos y no se traen. */
const IGNORADAS = new Set(['_prisma_migrations']);

const camel = (columna: string): string =>
  columna.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase());

async function main(): Promise<void> {
  const origen = process.env.MYSQL_URL;
  const destino = process.env.DATABASE_URL;

  if (!origen) {
    throw new Error('Falta MYSQL_URL: apunta a la base anterior en MySQL.');
  }

  if (!destino?.startsWith('mongodb')) {
    throw new Error('DATABASE_URL debe apuntar ya a MongoDB.');
  }

  const mysql = await createConnection(mariadbOptions(origen));
  const { MongoClient, ObjectId } = mongoose.mongo;
  const mongo = new MongoClient(destino);

  try {
    await mongo.connect();
    const db = mongo.db();

    const tablas = (
      await mysql.query<{ TABLE_NAME: string }[]>(
        'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()',
      )
    )
      .map((fila) => fila.TABLE_NAME)
      .filter((tabla) => !IGNORADAS.has(tabla));

    // Primera pasada: se leen todas las filas y se les asigna su identificador
    // nuevo. Con el mapa completo, las referencias se traducen después sin
    // importar en qué orden se escriba.
    const filas = new Map<string, Record<string, unknown>[]>();
    const ids = new Map<string, Map<number, mongoose.Types.ObjectId>>();

    for (const tabla of tablas) {
      const datos = await mysql.query<Record<string, unknown>[]>(`SELECT * FROM \`${tabla}\``);
      const mapa = new Map<number, mongoose.Types.ObjectId>();

      for (const fila of datos) {
        mapa.set(Number(fila['id']), new ObjectId());
      }

      filas.set(tabla, datos);
      ids.set(tabla, mapa);
    }

    /** A qué tabla apunta cada columna terminada en `_id`. */
    const destinos = await referencias(mysql);

    console.log(DRY_RUN ? '— Simulación: no se escribirá nada —\n' : '— Volcando —\n');

    let total = 0;

    for (const tabla of tablas) {
      const datos = filas.get(tabla) ?? [];

      if (datos.length === 0) {
        console.log(`  ${tabla.padEnd(22)} vacía`);
        continue;
      }

      const documentos = datos.map((fila) => traducir(fila, tabla, ids, destinos));

      if (!DRY_RUN) {
        // La colección se vacía antes: así el volcado se puede repetir mientras
        // se afina sin acumular duplicados.
        await db.collection(tabla).deleteMany({});
        await db.collection(tabla).insertMany(documentos);
      }

      total += documentos.length;
      console.log(`  ${tabla.padEnd(22)} ${datos.length}`);
    }

    console.log(`\n${DRY_RUN ? 'Simulación' : 'Volcado'} terminado: ${total} documentos.`);
  } finally {
    await mysql.end();
    await mongo.close();
  }
}

/**
 * Traduce una fila de MySQL al documento que se guarda en Mongo.
 *
 * Cambia los nombres a `camelCase`, sustituye los identificadores por los
 * nuevos y convierte los importes a céntimos.
 */
function traducir(
  fila: Record<string, unknown>,
  tabla: string,
  ids: Map<string, Map<number, mongoose.Types.ObjectId>>,
  destinos: Map<string, string>,
): Record<string, unknown> {
  const documento: Record<string, unknown> = {};

  for (const [columna, valor] of Object.entries(fila)) {
    if (columna === 'id') {
      documento['_id'] = ids.get(tabla)!.get(Number(valor))!;
      continue;
    }

    if (valor === null) {
      documento[camel(columna)] = null;
      continue;
    }

    if (columna.endsWith('_id')) {
      const destino = destinos.get(`${tabla}.${columna}`);
      const traducido = destino ? ids.get(destino)?.get(Number(valor)) : undefined;

      // Una referencia a una fila que ya no existe se deja en nulo en lugar de
      // arrastrar un identificador que no lleva a ninguna parte.
      documento[camel(columna)] = traducido ?? null;
      continue;
    }

    if (IMPORTES.has(columna)) {
      documento[camel(columna)] = Math.round(Number(valor) * 100);
      continue;
    }

    // `DECIMAL` llega como cadena desde el driver de MySQL; las coordenadas
    // pasan a número, que es lo que declara el esquema nuevo.
    documento[camel(columna)] = columna === 'lat' || columna === 'lng' ? Number(valor) : valor;
  }

  return documento;
}

/** Lee del esquema de MySQL a qué tabla apunta cada clave foránea. */
async function referencias(
  mysql: Awaited<ReturnType<typeof createConnection>>,
): Promise<Map<string, string>> {
  const filas = await mysql.query<
    { TABLE_NAME: string; COLUMN_NAME: string; REFERENCED_TABLE_NAME: string }[]
  >(
    `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
       FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL`,
  );

  return new Map(
    filas.map((fila) => [`${fila.TABLE_NAME}.${fila.COLUMN_NAME}`, fila.REFERENCED_TABLE_NAME]),
  );
}

main().catch((error: unknown) => {
  console.error('El volcado ha fallado:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
