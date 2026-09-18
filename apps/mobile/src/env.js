// Configuración en tiempo de ejecución.
//
// En desarrollo va vacío y manda `environment.ts`. En la imagen de Docker de
// la web, `docker/40-app-env.sh` reescribe este archivo al arrancar con las
// direcciones y la marca del despliegue.
window.__APP_ENV__ = {};
