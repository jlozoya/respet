# Respet — API

NestJS 12 sobre MongoDB, con un esquema de GraphQL. Sustituye al backend en
Lumen, y también a la primera versión de este mismo servidor, que hablaba REST
sobre Prisma y MySQL.

## Estructura

```
src/
├── common/          Piezas transversales
│   ├── decorators/  @Public, @Roles, @RateLimit, @CurrentUser
│   ├── guards/      JWT, roles y límite de peticiones
│   ├── filters/     El mismo JSON de error para las rutas REST que quedan
│   ├── utils/       Paginación, geografía, ubicaciones
│   ├── errors.ts    Claves de error que la aplicación traduce
│   └── mappers.ts   De documentos de Mongo a los contratos públicos
├── config/          Validación del entorno con Zod
├── database/        Conexión y esquemas de Mongoose
├── graphql/         El esquema: tipos, enumerados y arranque de Apollo
├── auth/            Registro, acceso, tokens, proveedores externos
├── users/           Perfil, privacidad, contacto, administración
├── posts/           Muro
├── comments/        Hilos de las publicaciones
├── bulletins/       Avisos
├── support/         Formulario de contacto
├── analytics/       Cifras del panel
├── chat/            Mensajería directa y su gateway de WebSocket
├── store/           Bodegas, catálogo, pedidos y cobros
├── media/           Subida y procesado de imágenes
└── mail/            Correo transaccional
```

Cada dominio tiene su resolutor (`*.resolver.ts`) y su servicio. Los servicios
no saben que existe GraphQL: reciben y devuelven los tipos de
`@respet/shared`, igual que cuando los llamaba un controlador.

## Decisiones que conviene conocer

**Una dirección en lugar de un árbol de rutas.** Todo pasa por `POST /graphql`.
El esquema se construye a partir de las clases del código —enfoque «code
first»— y se escribe en [`schema.gql`](schema.gql), que se versiona: así un
cambio de contrato se ve en la revisión del código como lo que es, y no
escondido dentro de un resolutor.

**Lo que no cabe en el esquema sigue siendo REST.** Son cuatro cosas: las
subidas de archivos, que viajan como `multipart/form-data`; el aviso que manda
PayPal; el enlace de confirmación del correo, que abre una persona en un
navegador; y `/health`, que consultan los monitores. Meterlas en GraphQL habría
exigido extender el protocolo y añadir otra librería en el cliente para no
ganar nada.

**Los enumerados viajan con sus valores, no con sus nombres.** GraphQL toma
como valor del enumerado la clave del objeto que se le registra, de modo que
`PostKind.General` habría salido como `General` y la aplicación, que compara
con `'general'`, habría dejado de reconocerlo. `src/graphql/enums.ts` le da la
vuelta al objeto antes de registrarlo.

**Todo pasa por `mappers.ts`.** Es lo que garantiza que `passwordHash` no se
escape nunca en una respuesta y que los `ObjectId` y las fechas salgan siempre
como cadenas.

**Las operaciones son privadas salvo que se diga lo contrario.**
`JwtAuthGuard` es global y las excepciones se marcan con `@Public()`. Al revés
—abrir todo y proteger lo que toque— olvidarse de un guard deja una consulta
abierta sin que nadie se entere. Los guards son los mismos para GraphQL y para
las rutas REST que quedan: `src/common/execution-context.ts` es quien sabe
sacar la petición de un sitio o del otro.

**Los roles son jerárquicos.** `@Roles('supervisor')` deja pasar también a
`admin`, según el orden de `ROLE_HIERARCHY` en `@respet/shared`.

**Los errores llevan una clave, no un mensaje.** Viajan dentro de `errors[]`
con `extensions.code` —`SERVER.INCORRECT_USER`— y `extensions.statusCode`, que
es lo que la aplicación traduce y lo que le permite distinguir un 401 de un
403. Las rutas REST que quedan responden con el cuerpo de siempre. De describir
el error se encarga un único sitio, `common/error-description.ts`.

**El total de un pedido lo calcula el servidor.** El precio unitario se congela
al añadir el producto al carrito, de modo que una subida posterior del catálogo
no altera un pedido en curso. El inventario se descuenta al confirmar, dentro
de una transacción que comprueba las existencias, para que dos compras
simultáneas no se lleven la misma última unidad. Por eso Mongo va en «replica
set»: es la única forma en que ofrece transacciones.

**Las imágenes se reconvierten a WebP.** Además de pesar mucho menos, así se
descartan los metadatos EXIF —incluida la posición GPS de la cámara, que nadie
querría difundir sin darse cuenta al subir una foto— y se neutralizan los
archivos que sólo aparentan ser imágenes.

**El chat guarda antes de anunciar.** Las escrituras son mutaciones y sólo
después el gateway difunde el aviso, así que un mensaje no se pierde porque el
socket esté caído. Cada conexión entra en una sala `user:<id>` en lugar de
dirigirse a sockets concretos, de modo que quien tenga la aplicación abierta en
varios sitios lo recibe en todos.

**La ubicación de una publicación puede difuminarse.** Con
`locationAccuracy > 0` el servidor desplaza el punto de forma determinista
dentro de ese radio antes de responder, así que la coordenada exacta no sale de
la base de datos. El desplazamiento no cambia entre peticiones: si variara, se
podría promediar varias lecturas y recuperar el centro real.

## Variables de entorno

Están todas documentadas en [`.env.example`](.env.example) y se validan al
arrancar con Zod: si falta alguna o tiene un formato imposible, el proceso muere
en el acto en lugar de fallar a mitad de una petición.

Las imprescindibles son `DATABASE_URL`, `JWT_ACCESS_SECRET` y
`JWT_REFRESH_SECRET`. El resto tienen valores por defecto pensados para
desarrollo: sin credenciales de correo los mensajes se escriben en el registro,
y PayPal queda desactivado.

## Órdenes

| Orden | Qué hace |
| --- | --- |
| `npm run start:dev` | Servidor con recarga automática |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta lo compilado |
| `npm run db:seed` | Datos de ejemplo |
| `npm run migrate:mongo` | Vuelca a Mongo una base MySQL anterior |
| `npm run lint` | ESLint |
| `npm test` | Pruebas con Vitest |
| `npm run test:cov` | Pruebas con informe de cobertura |

## Mirar el esquema

En desarrollo, `http://localhost:3000/graphql` abre GraphiQL: el esquema
completo, con su documentación, y un editor donde probar consultas. En
producción la introspección queda apagada —quien consume la API es nuestra
propia aplicación, que ya lo conoce—, así que para consultarlo está el
`schema.gql` del repositorio.
