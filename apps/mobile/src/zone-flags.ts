/**
 * Marcas de zone.js.
 *
 * Se cargan antes que zone.js —van las primeras en `polyfills` de
 * `angular.json`— porque la biblioteca las lee al inicializarse.
 *
 * Ionic está hecho de componentes web; sin esta marca, cada retrollamada de su
 * ciclo de vida dispararía una detección de cambios de Angular.
 */
(window as unknown as Record<string, boolean>)['__Zone_disable_customElements'] = true;

export {};
