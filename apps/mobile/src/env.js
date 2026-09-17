// Configuración en tiempo de ejecución.
//
// En desarrollo va vacío y manda `environment.ts`. En la imagen de Docker de
// la web, `docker/40-respet-env.sh` reescribe este archivo al arrancar con las
// direcciones del despliegue.
window.__RESPET_ENV__ = {};
