# Respet — aplicación

Ionic 9 sobre Angular 22, empaquetada con Capacitor 8.

## Estructura

```
src/app/
├── core/                 Servicios transversales (una sola instancia)
│   ├── api/              Clientes tipados de la API, chat incluido
│   ├── auth/             Sesión, interceptor, guards, acceso con proveedores
│   ├── i18n/             Idioma de la interfaz
│   ├── maps/             Google Maps, cargado bajo demanda
│   ├── media/            Cámara, galería y recorte de imágenes
│   ├── realtime/         Conexión de Socket.IO
│   ├── storage/          Persistencia con @capacitor/preferences
│   └── ui/               Tema, iconos, avisos y compartir
├── shared/               Validadores y componentes reutilizables
├── components/           Componentes de presentación
├── modals/               Ventanas modales
├── pages/                Pantallas, cargadas de forma perezosa
├── app.component.ts      Contenedor y menú lateral
├── app.config.ts         Proveedores de la aplicación
└── app.routes.ts         Rutas
```

## Cómo hablan la aplicación y la API

Nada de URLs escritas a mano en las pantallas. Cada área tiene su servicio en
`core/api`, y los tipos salen de `@respet/shared`:

```ts
private readonly posts = inject(PostsService);

const page = await this.posts.list({ page: 1, state: 'lost' });
//    ^? Paginated<Post>
```

La sesión vive en `AuthService` y se expone con señales, así que la plantilla
se actualiza sola:

```html
@if (auth.isAuthenticated()) {
  <p>Hola, {{ auth.user()!.name }}</p>
}
```

El token de acceso lo pone `authInterceptor`, que además renueva la sesión
cuando caduca —cada quince minutos— y reintenta la petición, de modo que el
usuario no lo nota.

## Piezas que conviene conocer

**`FeedbackService`** concentra los avisos: `toast`, `error`, `confirm` y
`withLoading`. Antes cada componente repetía seis líneas para crear un mensaje
y traducía a mano cada texto; ahora `feedback.error(e)` saca la clave
traducible del propio `ApiError` y la muestra en el idioma del usuario.

**`LocationPickerComponent`** es el mapa con marcador arrastrable, búsqueda por
dirección y geolocalización. Lo comparten el formulario de publicación, el de
bodega, el de pedido y el perfil; los cuatro repetían el mismo bloque.

**`PageHeaderComponent`** es la cabecera con el botón de menú o el de volver,
que estaba copiada en las veintitantas pantallas.

**`ImagePickerService`** resuelve el ciclo completo —elegir origen, capturar,
recortar— y devuelve un `Blob` listo para subir. Nada de base64: la API recibe
los archivos en un formulario multipart.

**Los carruseles no usan Swiper.** `<ion-slides>` desapareció en Ionic 7 y su
sustituto recomendado sería una dependencia entera; el visor de imágenes y el
tutorial usan `scroll-snap` nativo, que además se comporta mejor con los
lectores de pantalla.

**El tema oscuro es el de partida.** La hoja de estilos lo define en `:root` y
el claro se activa con la clase `ion-palette-light`, al revés de lo que sugiere
Ionic: así no hay un destello blanco mientras arranca la aplicación.
`ThemeService` guarda la preferencia y, con «seguir al sistema», escucha
`prefers-color-scheme` para reaccionar al momento.

**El chat separa datos y avisos.** Los mensajes se envían y se leen por REST;
`SocketService` sólo transporta los eventos —mensaje nuevo, lectura,
«escribiendo…», presencia— y reconecta con el token renovado cuando la sesión
se refresca. Si el WebSocket está bloqueado, el chat sigue funcionando, sólo
que sin inmediatez.

**Las burbujas se agrupan en `bubbles()`**, no en la plantilla. Ahí se decide
si un mensaje abre o cierra un bloque, si lleva avatar y si toca enseñar la
hora; el redondeo de esquinas se deriva de eso, que es el detalle que hace que
varios mensajes seguidos se lean como una sola pieza.

**Los iconos se registran a mano** en `core/ui/icons.ts`. Ionic 9 ya no carga
el juego completo, y declarar los cuarenta que se usan evita arrastrar al
paquete final el millar largo de SVG de la biblioteca.

## Órdenes

| Orden | Qué hace |
| --- | --- |
| `npm start` | Servidor de desarrollo en <http://localhost:8100> |
| `npm run build:prod` | Compilación de producción en `www/` |
| `npm run lint` | ESLint sobre TypeScript y plantillas |
| `npm test` | Pruebas unitarias con Vitest |
| `npm run e2e` | Pruebas de extremo a extremo con Playwright |
| `npm run sync` | Compila y sincroniza con Android e iOS |

## Configuración

`src/environments/environment.ts` (y su gemelo `.prod.ts`) definen la URL de la
API, la clave de Google Maps y los identificadores de cliente de Google y
Facebook. El tipo vive aparte, en `environment.model.ts`, porque `angular.json`
sustituye un archivo por el otro al compilar para producción y el segundo no
tendría de dónde importarlo.

Ya no hay `OAUTH_CLIENT_ID` ni `OAUTH_CLIENT_SECRET`: el backend anterior
exigía un secreto de cliente que viajaba dentro del binario, de modo que
cualquiera podía extraerlo. Con la autenticación por JWT el cliente no guarda
ningún secreto.

Para que funcione el acceso con Google y Facebook hay que rellenar
`googleClientId` y `facebookAppId` con los mismos valores que use el servidor.
Sin `googleMapsApiKey` la aplicación sigue funcionando: sólo deja de mostrar
los mapas.

## Compilar para móvil

Las carpetas nativas no se versionan; se generan la primera vez:

```bash
npx cap add android
npx cap add ios
npm run sync
```

## Pruebas

Las pruebas unitarias corren con Vitest a través del builder
`@angular/build:unit-test`, que sustituye a Karma y Jasmine.
`src/test-setup.ts` simula los plugins de Capacitor, que no existen fuera del
dispositivo.

Los `*.spec.ts` de Angular 10 se borraron durante la migración: sólo
comprobaban que el componente se instanciaba y ninguno compilaba ya. Conviene
escribir los nuevos a medida que se toque cada pantalla; de momento
`e2e/smoke.spec.ts` cubre el arranque y la redirección al inicio de sesión.
