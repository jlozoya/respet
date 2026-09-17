import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas de extremo a extremo: la API entera contra una base Mongo de prueba.
 *
 * Van aparte de las unitarias porque necesitan la base levantada —en local, la
 * de `docker compose`; en CI, un contenedor de servicio— y porque tardan más.
 * La base se elige con `E2E_DATABASE_URL` y se vacía al empezar.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Las pruebas comparten la API arrancada y el estado que van dejando.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
});
