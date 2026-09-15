# Respet

Red social para compartir lo que pasa cerca: publicaciones con imágenes y
ubicación, comentarios, «me gusta», seguimiento entre personas y mensajería
directa.

El proyecto es ahora un **monorepo** con la aplicación y su API en el mismo
repositorio. La API en Lumen (PHP), que antes vivía aparte en `respetv2_back`,
se ha reescrito en TypeScript con NestJS.

```
respet/
├── apps/
│   ├── api/          API GraphQL — NestJS 12 + Mongoose 9 + MongoDB
│   └── mobile/       Aplicación — Ionic 9 + Angular 22 + Capacitor 8
└── packages/
    └── shared/       Contratos de dominio compartidos por ambos
```

`packages/shared` es la pieza que sostiene el conjunto: define los modelos y
los cuerpos de petición y respuesta una sola vez, de modo que si el servidor
cambia la forma de un `Post`, la aplicación deja de compilar en lugar de fallar
en tiempo de ejecución.

## Puesta en marcha

Requisitos: **Node.js 22.12 o superior** y **npm 10.9 o superior**.

```bash
npm install
```

Levanta la base de datos. Con Docker no hace falta instalar nada más, y las
credenciales ya coinciden con las del archivo de ejemplo:

```bash
docker compose up -d
```

La primera vez hay que iniciar el conjunto de réplica, una sola vez —Mongo
sólo ofrece transacciones así, y el inventario las necesita—:

```bash
docker compose exec mongo mongosh --quiet --eval "rs.initiate()"
```

Si prefieres tu propio **MongoDB 8**, ajusta `DATABASE_URL` en el paso
siguiente; tendrá que estar en «replica set» por lo mismo.

Configura la API a partir del ejemplo:

```bash
cp apps/api/.env.example apps/api/.env
```

Como mínimo hay que rellenar `DATABASE_URL` y los dos secretos de JWT, que
deben tener 32 caracteres o más:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Carga unos datos de ejemplo:

```bash
npm run db:seed
```

Y arranca las dos partes a la vez:

```bash
npm run dev
```

- API: <http://localhost:3000/graphql> — en desarrollo, esa misma dirección
  abre GraphiQL con el esquema y un editor de consultas
- Aplicación: <http://localhost:8100>

El seed deja una cuenta por rol (`admin@respet.test`, `supervisor@respet.test`,
`repartidor@respet.test`, `usuario@respet.test`), todas con la contraseña
`respet1234`.

## Órdenes disponibles

| Orden | Qué hace |
| --- | --- |
| `npm run dev` | Levanta API y aplicación en paralelo |
| `npm run build` | Compila los tres paquetes en orden |
| `npm run lint` | ESLint en todo el monorepo |
| `npm test` | Pruebas unitarias |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run migrate:mongo` | Vuelca en Mongo la base MySQL anterior |
| `docker compose up -d` | Levanta MongoDB para desarrollo |
| `docker compose down -v` | Lo para y borra sus datos |

## Migrar los datos de la versión anterior

El script lee la base MySQL sin modificarla y la vuelca en Mongo: los
identificadores enteros pasan a `ObjectId`, los importes a céntimos y las
columnas a `camelCase`. Apunta `MYSQL_URL` a la base antigua en `apps/api/.env`
y prueba primero en seco:

```bash
npm run migrate:mongo -w @respet/api -- --dry
npm run migrate:mongo
```

Las contraseñas se conservan como los hashes bcrypt que generaba Laravel: el
servidor sabe verificarlas y las reescribe como Argon2id la primera vez que
cada persona inicia sesión, así que nadie tiene que restablecer nada.

## Qué ha cambiado respecto a la versión anterior

### Backend: de Lumen a NestJS

| Antes | Ahora | Motivo |
| --- | --- | --- |
| Lumen 8 (PHP) | NestJS 12 | Mismo lenguaje que la aplicación y contratos compartidos |
| Eloquent | Mongoose 9 sobre MongoDB | Documentos con la forma que ya tenían las respuestas |
| Rutas REST | Un esquema de GraphQL | La app pide lo que pinta, y en una sola ida y vuelta |
| OAuth2 de Passport | JWT con refresh rotativo | El `client_secret` viajaba dentro del binario de la app |
| bcrypt | Argon2id | Recomendación actual de OWASP frente a ataques con GPU |
| Intervention Image | sharp | Más rápido y descarta los EXIF, incluida la posición GPS |
| srmklive/paypal | Cliente REST propio | Sólo hacían falta tres operaciones |
| `addresses` + `directions` | `locations` | Eran dos tablas idénticas |
| `post_media`, `product_media` | Clave foránea en `media` | Las tablas puente no aportaban nada |
| `invoices`, `items`, `ipn_status` | `payments` | Un solo sitio donde mirar un cobro |

Además, el servidor ya no se fía del perfil que le manda el cliente al entrar
con Google o Facebook: verifica el token contra el proveedor y decide él de
quién es la cuenta. Antes bastaba con conocer el correo de alguien para
suplantarlo.

### Aplicación: de Angular 10 a Angular 22

| Antes | Ahora |
| --- | --- |
| Angular 10, Ionic 5, Capacitor 2 | Angular 22, Ionic 9, Capacitor 8 |
| NgModules por pantalla | Componentes standalone y `loadComponent` |
| `*ngIf` / `*ngFor` | `@if` / `@for` |
| TSLint | ESLint |
| Karma y Jasmine | Vitest |
| Protractor | Playwright |
| `@ionic-native/*` | Plugins de Capacitor |
| `@ionic/storage` | `@capacitor/preferences` |
| Bus de eventos propio | Señales de Angular |
| `@codetrix-studio/capacitor-google-auth` y `@capacitor-community/facebook-login` | `@capgo/capacitor-social-login` |

## Chat

La aplicación incluye mensajería directa entre usuarios, con entrega en tiempo
real por WebSocket:

- Conversaciones de dos, que se abren desde el botón «Enviar mensaje» de
  cualquier publicación.
- Texto e imágenes, con burbujas agrupadas por autor al estilo de Messenger.
- Indicador de «escribiendo…», presencia en línea, confirmación de lectura y
  contador de mensajes sin leer en el menú.
- Los mensajes se guardan con una mutación y el socket sólo transporta los
  avisos, de modo que nada se pierde si la conexión en tiempo real se cae.

El canal vive en el espacio de nombres `/chat` y se autentica con el mismo
access token que el resto de la API.

## Temas

El tema oscuro es el de partida; el claro y la opción «seguir al sistema» se
eligen desde el menú lateral y quedan guardados en el dispositivo. La paleta
está en `apps/mobile/src/theme/variables.scss` y la gestiona `ThemeService`.

## Estado

Las tres partes compilan y la API arranca con un esquema de 31 consultas y 61
mutaciones, más el canal de chat y las cuatro rutas HTTP que no caben en él:
las subidas de archivos, el aviso de PayPal, el enlace de confirmación del
correo y `/health`.

Verificado contra una base de datos real: seed, muro y detalle de una
publicación, alta, voto, comentarios, carrito, catálogo, chat e inicio de
sesión, además del control de acceso —403 a quien no tiene el rol, 401 sin
sesión— y del límite de peticiones, que sigue contando aunque ahora todas las
operaciones compartan dirección.

Lo que sigue sin comprobarse:

- El volcado de la base anterior (`migrate:mongo`) está escrito y pasa el
  comprobador de tipos, pero **no se ha ejecutado contra una base real**.
  Pruébalo con `--dry` sobre una copia antes de tocar producción.
- El acceso con Google y Facebook necesita las credenciales en `apps/api/.env`
  y en `src/environments/`; sin ellas, el servidor responde 501 y la app enseña
  el error correspondiente.
- Los pagos con PayPal quedan desactivados mientras `PAYPAL_ENABLED` sea
  `false`.

Las pruebas unitarias de Angular 10 se eliminaron —sólo comprobaban que el
componente se instanciaba y ninguna compilaba ya con el código nuevo—, así que
la cobertura está por rehacer. De momento `npm test` cubre en el servidor las
dos piezas que la migración dejó con lógica propia: la vuelta que se les da a
los enumerados para que viajen con los valores del dominio, y la traducción de
cualquier excepción a la clave que la aplicación enseña.
