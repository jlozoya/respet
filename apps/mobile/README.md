# Aplicación

Ionic 9 sobre Angular 22, empaquetada con Capacitor 8. Es una red social
completa: muro, historias, directos, mensajería y la plataforma para
desarrolladores, con el aspecto de Facebook en el escritorio y el de Instagram
en el móvil.

## Estructura

```
src/app/
├── core/                 Servicios transversales (una sola instancia)
│   ├── api/              Clientes tipados: GraphQL, muro, chat, historias…
│   ├── auth/             Sesión, dos pasos, interceptor, guards, proveedores
│   ├── i18n/             Idioma de la interfaz
│   ├── maps/             Google Maps, cargado bajo demanda
│   ├── media/            Cámara, galería, recorte y notas de voz
│   ├── push/             Notificaciones del dispositivo
│   ├── realtime/         Suscripciones de GraphQL y presencia
│   ├── storage/          Persistencia con @capacitor/preferences
│   └── ui/               Tema, iconos, avisos, denuncias y reautenticación
├── shared/               Avatares, texto con enlaces, pipes y validadores
├── components/           Muro, chat, historias, directos, avisos y armazón
├── modals/               Ventanas modales
├── pages/                Pantallas, cargadas de forma perezosa
├── app.component.ts      Armazón: barra superior, pestañas y muelle del chat
├── app.config.ts         Proveedores de la aplicación
└── app.routes.ts         Rutas
```

## Cómo hablan la aplicación y la API

Todo pasa por GraphQL: consultas, mutaciones, archivos y avisos en tiempo real.
Nada de URLs escritas a mano en las pantallas; cada área tiene su servicio en
`core/api` y los tipos salen de `@social-network/shared`:

```ts
private readonly posts = inject(PostsService);

const page = await this.posts.list({ feed: 'home', page: 1 });
//    ^? Paginated<Post>
```

**Los archivos viajan dentro de la propia operación.** `GraphqlClientService`
implementa la especificación multipart de GraphQL: basta con poner un `Blob` o
un `File` en las variables y el cliente lo saca, lo manda como parte del
formulario y deja el hueco que el servidor rellena.

```ts
await this.posts.create({ description: 'Hola' }, [foto, video]);
```

**Lo que llega sin pedirlo va por una sola conexión.** `RealtimeService` abre un
WebSocket con `graphql-ws` y por ahí entran el chat, los avisos, la presencia y
los directos. Cada intento de conexión pide un token vigente, y si el servidor
cierra con 4401 —la sesión se cerró en otro sitio— se comprueba si sigue viva,
se rehace la conexión y se relanzan las suscripciones.

La sesión vive en `AuthService` y se expone con señales, así que la plantilla se
actualiza sola:

```html
@if (auth.isAuthenticated()) {
<p>Hola, {{ auth.user()!.firstName }}</p>
}
```

El token de acceso lo pone `authInterceptor`, que además renueva la sesión
cuando caduca —cada quince minutos— y reintenta la petición, de modo que no se
nota.

## Piezas que conviene conocer

**La verificación en dos pasos es opcional y vive en dos sitios.** Al entrar, si
la cuenta la tiene activa, `login` devuelve un reto y la pantalla pasa al
segundo paso: el código de la app de autenticación o uno de recuperación, con la
casilla de «no volver a pedirlo en este dispositivo», cuyo token se guarda por
cuenta y se presenta en los siguientes inicios. En «Seguridad e inicio de
sesión» está el asistente para activarla, los códigos de recuperación, los
dispositivos de confianza, las sesiones abiertas y la actividad reciente.

**`ReauthService`** ejecuta lo delicado —desactivar el segundo factor, borrar la
cuenta— probando primero sin nada y pidiendo la contraseña sólo si el servidor
responde `SERVER.REAUTH_REQUIRED`.

**El chat envía de forma optimista.** El mensaje aparece en el acto con su
`clientId`; si la red falla se queda marcado para reintentar, y el reintento usa
el mismo `clientId`, así que el servidor no lo duplica aunque el primer intento
sí hubiera llegado. Los de sólo texto sobreviven a cerrar la aplicación. Los
estados —enviado, entregado, visto— y «escribiendo…» llegan por la suscripción,
y al reconectar se piden los mensajes posteriores al último que se tenía.

**El muelle del chat** abre conversaciones en ventanas sobre la página en el
escritorio, como Facebook; en el móvil, la misma pieza ocupa la pantalla.

**El visor de historias** lleva las barras de progreso, el toque a los lados
para avanzar o volver, mantener pulsado para pausar, las respuestas y las
reacciones —que llegan por privado—, y en las propias, quién las ha visto.

**Los directos usan LiveKit.** El vídeo no pasa por la API: ella reparte el pase
—de emitir o de mirar— y lleva lo social. El estudio publica cámara y micrófono
y manda una señal de vida cada diez segundos; sin ella el servidor da el directo
por terminado.

**`PostCardComponent`** es la tarjeta del muro: reacciones con su selector,
comentarios con respuestas, compartir —al muro, con comentario o por privado— y
el menú de guardar, editar, denunciar o bloquear. Los cambios se anuncian por
`PostsService.changes`, así que la misma publicación se mantiene al día en el
muro, en su detalle y en el perfil.

**`ImagePickerService`** resuelve el ciclo completo —elegir origen, capturar,
recortar— y devuelve un `Blob` listo para subir. Nada de base64.

**El tema claro es el de partida**, como en Facebook e Instagram, y el oscuro se
activa con la clase `ion-palette-dark`. Para que no haya destello al arrancar,
`index.html` lee la preferencia guardada y pone la clase antes de que Angular
empiece. `ThemeService` mantiene la opción «seguir al sistema» escuchando
`prefers-color-scheme`.

**El pequeño sistema de diseño vive en `global.scss`**, con clases `rs-*`:
tarjetas, avatares, filas con avatar, píldoras, pestañas y cuadrículas. Se
repiten en decenas de sitios y Angular pone un tope al tamaño de la hoja de cada
componente.

**Los iconos se registran a mano** en `core/ui/icons.ts`. Ionic 9 ya no carga el
juego completo, y declarar los que se usan evita arrastrar al paquete final el
millar largo de SVG de la biblioteca.

## Órdenes

| Orden                | Qué hace                                          |
| -------------------- | ------------------------------------------------- |
| `npm start`          | Servidor de desarrollo en <http://localhost:8100> |
| `npm run build:prod` | Compilación de producción en `www/`               |
| `npm run lint`       | ESLint sobre TypeScript y plantillas              |
| `npm test`           | Pruebas unitarias con Vitest                      |
| `npm run e2e`        | Pruebas de extremo a extremo con Playwright       |
| `npm run sync`       | Compila y sincroniza con Android e iOS            |

## Configuración

`src/environments/environment.ts` (y su gemelo `.prod.ts`) definen las
direcciones de la API —`apiUrl` para lo que queda de HTTP y `graphqlUrl` para el
esquema, de donde sale también la de las suscripciones cambiando `http` por
`ws`—, la clave de Google Maps y los identificadores de cliente de Google y
Facebook.

Lo que cambia al desplegar no obliga a recompilar: `src/env.js` declara
`window.__APP_ENV__`, la imagen de Docker lo reescribe al arrancar con sus
variables de entorno y `runtimeEnvironment()` lo mezcla encima del archivo.

Para que funcione el acceso con Google y Facebook hay que rellenar
`googleClientId` y `facebookAppId` con los mismos valores que use el servidor.
Sin `googleMapsApiKey` la aplicación sigue funcionando: sólo deja de mostrar los
mapas. Sin LiveKit configurado en el servidor, la sección de directos avisa de
que no está disponible en lugar de fallar.

## Traducciones

Todo el texto pasa por `ngx-translate`, con `assets/i18n/es.json` y `en.json`.
Las dos listas tienen exactamente las mismas claves; los mensajes de error del
servidor llegan como claves (`SERVER.*`) y se traducen aquí.

## Compilar para móvil

Las carpetas nativas no se versionan; se generan la primera vez:

```bash
npx cap add android
npx cap add ios
npm run sync
```

Las notificaciones push necesitan `google-services.json` (Android) y
`GoogleService-Info.plist` (iOS), que no se versionan.

## Pruebas

Las pruebas unitarias corren con Vitest a través del builder
`@angular/build:unit-test`, que sustituye a Karma y Jasmine.
`src/test-setup.ts` simula los plugins de Capacitor, que no existen fuera del
dispositivo. `e2e/smoke.spec.ts` cubre el arranque y la redirección al inicio de
sesión.
