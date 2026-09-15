import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    // Nest se apoya en los decoradores y en los metadatos que emite el
    // compilador; esbuild, que es lo que Vitest trae de fábrica, no los emite.
    swc.vite({ module: { type: 'es6' } }),
  ],
  resolve: {
    // El código importa con extensión `.js` porque así lo exige `node16` al
    // compilar; aquí hay que devolver esas rutas al `.ts` que las origina.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
});
