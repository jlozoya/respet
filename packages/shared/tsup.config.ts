import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  /*
    Sin limpiar la carpeta: los archivos se sobrescriben en su sitio.

    Con `clean` en cierto, cada reconstrucción borraba `dist` antes de
    escribirlo, y en ese hueco el paquete deja de existir. Quien lo esté
    vigilando —el `tsc --watch` de la API, el pre-empaquetado de Vite en la
    aplicación— lo ve desaparecer y se queda con «Cannot find module
    @respet/shared» hasta que se reinicia, aunque el paquete ya esté de vuelta
    un segundo después. `rimraf dist` sigue disponible en `npm run clean` para
    cuando se quiera vaciar de verdad.
  */
  clean: false,
  treeshake: true,
  target: 'es2022',
});
