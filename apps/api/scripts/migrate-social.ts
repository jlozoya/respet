/**
 * Migra una base existente a la red social completa.
 *
 *   npm run migrate:social
 *
 * Es idempotente: se puede repetir sin riesgo. Ver `social-migration.ts`.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';

import { migrateToSocial } from './social-migration.js';

const envFile = resolve(import.meta.dirname, '..', '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];

  if (!url) {
    throw new Error('Falta DATABASE_URL');
  }

  const connection = await mongoose.createConnection(url).asPromise();

  try {
    const db = connection.db;

    if (!db) {
      throw new Error('No hay base de datos en la conexión');
    }

    console.log(`Migrando ${db.databaseName}…`);
    await migrateToSocial(db);
    console.log('Listo.');
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('La migración ha fallado:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
