/**
 * Datos de ejemplo para desarrollo.
 *
 * Deja la base en un estado con el que se puede navegar la aplicación entera:
 * varias cuentas, gente que se sigue entre sí, publicaciones de cada tipo con
 * sus comentarios y votos, y una conversación abierta. Sin esto el muro sale
 * vacío y no hay forma de ver si la interfaz funciona.
 *
 * Es idempotente: las cuentas se identifican por su correo y el contenido sólo
 * se crea si no había ninguno, así que se puede lanzar las veces que haga
 * falta. Se niega a ejecutarse con `NODE_ENV=production`, porque crea cuentas
 * con contraseñas conocidas.
 *
 * Uso:
 *   npm run db:seed -w @social-network/api
 */
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';

import { migrateToSocial } from './social-migration.js';

const envFile = resolve(import.meta.dirname, '..', '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const SEED_PASSWORD = 'social1234';

/**
 * De dónde salen las fotos de ejemplo.
 *
 * Las dos fuentes admiten una semilla en la URL, así que cada cuenta y cada
 * publicación reciben siempre la misma imagen. Con fotos aleatorias no habría
 * forma de comparar dos capturas de pantalla ni de reproducir un fallo visual.
 * Son fotografías genéricas de banco de imágenes: ilustran la interfaz, no el
 * texto que acompañan.
 */
const RETRATO = (semilla: string): string =>
  `https://i.pravatar.cc/512?u=${encodeURIComponent(semilla)}`;
const FOTO = (semilla: string): string => `https://picsum.photos/seed/${semilla}/1200/800`;

/** Dónde acaban los archivos, que es la carpeta que la API publica. */
const RAIZ_ARCHIVOS = resolve(
  import.meta.dirname,
  '..',
  process.env.STORAGE_ROOT ?? 'storage/uploads',
);
const URL_PUBLICA = process.env.APP_URL ?? 'http://localhost:3000';

const { MongoClient, ObjectId } = mongoose.mongo;

type Id = InstanceType<typeof ObjectId>;

/** La base ya abierta, tal y como la devuelve el cliente. */
type Db = ReturnType<InstanceType<typeof MongoClient>['db']>;

const ahora = new Date();
const haceHoras = (horas: number): Date => new Date(ahora.getTime() - horas * 3600_000);

/**
 * Descarga una foto y la deja registrada como archivo de la aplicación.
 *
 * Se reconvierte a WebP con el mismo tamaño y la misma calidad que aplica
 * `MediaService` y se guarda con la misma forma de clave, para que los datos de
 * ejemplo sean indistinguibles de una subida real: así el muro se puede probar
 * sin depender de que alguien suba nada a mano.
 *
 * Si la descarga falla —sin red, por ejemplo— devuelve `null` y el seed
 * continúa. Quedarse sin fotos es molesto; quedarse sin datos, no poder probar.
 */
async function guardarFoto(
  db: Db,
  url: string,
  carpeta: 'avatar' | 'post',
  alt: string,
  dueño: { postId?: Id; position?: number } = {},
): Promise<Id | null> {
  const preset =
    carpeta === 'avatar' ? { maxSize: 512, quality: 82 } : { maxSize: 1600, quality: 80 };

  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(30_000) });

    if (!respuesta.ok) {
      console.warn(`  no se pudo descargar ${url}: ${respuesta.status}`);
      return null;
    }

    const { data, info } = await sharp(Buffer.from(await respuesta.arrayBuffer()))
      .rotate()
      .resize({
        width: preset.maxSize,
        height: preset.maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality })
      .toBuffer({ resolveWithObject: true });

    const clave = `${carpeta}/${randomUUID()}.webp`;
    const destino = resolve(RAIZ_ARCHIVOS, clave);

    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, data);

    const _id = new ObjectId();

    await db.collection('media').insertOne({
      _id,
      type: 'image',
      url: `${URL_PUBLICA}/uploads/${clave}`,
      alt: alt.slice(0, 160),
      width: info.width,
      height: info.height,
      storageKey: clave,
      position: dueño.position ?? 0,
      postId: dueño.postId ?? null,
      productId: null,
      createdAt: ahora,
      updatedAt: ahora,
    });

    return _id;
  } catch (error: unknown) {
    console.warn(
      `  no se pudo preparar ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed crea cuentas con contraseñas conocidas: no se ejecuta en producción.');
  }

  const url = process.env.DATABASE_URL;

  if (!url?.startsWith('mongodb')) {
    throw new Error('DATABASE_URL debe apuntar a MongoDB.');
  }

  const cliente = new MongoClient(url);
  await cliente.connect();

  const db = cliente.db();
  const passwordHash = await argon2.hash(SEED_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    // --- Cuentas ------------------------------------------------------------
    // Los nombres de usuario van en minúsculas: son los que viajan en la
    // dirección del perfil, y es lo que exige el alta de verdad.
    const gente = [
      {
        email: 'admin@social-network.test',
        name: 'admin',
        firstName: 'Ana',
        lastName: 'Ruiz',
        role: 'admin',
      },
      {
        email: 'supervisor@social-network.test',
        name: 'supervisor',
        firstName: 'Sara',
        lastName: 'Gil',
        role: 'supervisor',
      },
      {
        email: 'repartidor@social-network.test',
        name: 'repartidor',
        firstName: 'Raúl',
        lastName: 'Mena',
        role: 'roundsman',
      },
      {
        email: 'usuario@social-network.test',
        name: 'usuario',
        firstName: 'Uxía',
        lastName: 'Soto',
        role: 'user',
      },
      {
        email: 'marta@social-network.test',
        name: 'marta',
        firstName: 'Marta',
        lastName: 'Bravo',
        role: 'user',
      },
      {
        email: 'kike@social-network.test',
        name: 'kike',
        firstName: 'Enrique',
        lastName: 'Nava',
        role: 'user',
      },
    ] as const;

    const ids = new Map<string, Id>();

    for (const persona of gente) {
      const existente = await db.collection('users').findOne({ email: persona.email });

      if (existente) {
        ids.set(persona.email, existente._id);
        continue;
      }

      const _id = new ObjectId();

      await db.collection('users').insertOne({
        _id,
        ...persona,
        passwordHash,
        emailVerified: true,
        gender: null,
        phone: null,
        birthday: null,
        lang: 'es',
        provider: 'password',
        avatarId: null,
        locationId: null,
        lastLoginAt: null,
        createdAt: ahora,
        updatedAt: ahora,
      });

      await db.collection('user_permissions').insertOne({
        userId: _id,
        showMainEmail: true,
        showAlternativeEmails: true,
        showMainPhone: true,
        showAlternativePhones: true,
        showLocation: true,
        receiveMailAds: true,
        createdAt: ahora,
        updatedAt: ahora,
      });

      ids.set(persona.email, _id);
    }

    console.log(`  ${gente.length} cuentas`);

    // --- Avatares -----------------------------------------------------------
    // Sólo a quien no tenga: repetir el seed no debe ir dejando archivos
    // huérfanos en el disco.
    let avatares = 0;

    for (const persona of gente) {
      const _id = ids.get(persona.email)!;
      const cuenta = await db.collection('users').findOne({ _id }, { projection: { avatarId: 1 } });

      if (cuenta?.avatarId) {
        continue;
      }

      const media = await guardarFoto(
        db,
        RETRATO(persona.email),
        'avatar',
        `${persona.firstName} ${persona.lastName}`,
      );

      if (media) {
        await db.collection('users').updateOne({ _id }, { $set: { avatarId: media } });
        avatares += 1;
      }
    }

    console.log(`  ${avatares} avatares`);

    const usuario = ids.get('usuario@social-network.test')!;
    const marta = ids.get('marta@social-network.test')!;
    const kike = ids.get('kike@social-network.test')!;
    const admin = ids.get('admin@social-network.test')!;

    // --- Quién sigue a quién ------------------------------------------------
    // Un puñado de relaciones cruzadas, para que el muro «siguiendo» enseñe
    // algo distinto a «descubrir» según con qué cuenta se entre.
    const seguimientos: [Id, Id][] = [
      [usuario, marta],
      [usuario, kike],
      [marta, usuario],
      [kike, marta],
      [admin, usuario],
    ];

    for (const [follower, followee] of seguimientos) {
      await db
        .collection('follows')
        .updateOne(
          { followerId: follower, followeeId: followee },
          { $setOnInsert: { followerId: follower, followeeId: followee, createdAt: ahora } },
          { upsert: true },
        );
    }

    console.log(`  ${seguimientos.length} seguimientos`);

    // --- Publicaciones ------------------------------------------------------
    // Se mira si ya están LAS DEL SEED, no si hay publicaciones: la base puede
    // traer contenido de antes y aun así faltar los ejemplos.
    const marca = '¿Alguien sabe si el mercado de la plaza abre el lunes festivo?';

    if ((await db.collection('posts').countDocuments({ description: { $regex: marca } })) === 0) {
      const publicaciones = [
        {
          userId: usuario,
          kind: 'question',
          description:
            '¿Alguien sabe si el mercado de la plaza abre el lunes festivo? Me vendría bien saberlo antes de cruzar la ciudad.',
          horas: 2,
          lugar: { city: 'Durango', lat: 24.0277, lng: -104.6532 },
          accuracy: 0,
        },
        {
          userId: marta,
          kind: 'event',
          description:
            'Organizamos una limpieza del parque el sábado a las nueve. Llevad guantes; las bolsas las ponemos nosotros.',
          horas: 5,
          lugar: { city: 'Durango', lat: 24.0231, lng: -104.6601 },
          accuracy: 0,
        },
        {
          userId: kike,
          kind: 'offer',
          description:
            'Regalo una estantería de pino en buen estado. Hay que venir a recogerla, que pesa lo suyo.',
          horas: 9,
          lugar: { city: 'Durango', lat: 24.0312, lng: -104.6489 },
          accuracy: 2,
        },
        {
          userId: marta,
          kind: 'request',
          description:
            'Busco a alguien que sepa de fontanería para una fuga pequeña en el baño. Pago lo que valga, claro.',
          horas: 14,
          lugar: null,
          accuracy: 0,
        },
        {
          userId: usuario,
          kind: 'general',
          description:
            'El amanecer de hoy desde el cerro ha valido el madrugón. Os dejo la foto mental, que la cámara no le hace justicia.',
          horas: 26,
          lugar: null,
          accuracy: 0,
        },
        {
          userId: kike,
          kind: 'question',
          description:
            '¿Qué tal el taller mecánico de la calle Victoria? Necesito cambiar los frenos y no me fío del primero que pille.',
          horas: 38,
          lugar: null,
          accuracy: 0,
        },
        {
          userId: admin,
          kind: 'general',
          description:
            'Recordad que los avisos de la comunidad están en la sección de Avisos, no en el muro. Aquí, lo que queráis contar.',
          horas: 50,
          lugar: null,
          accuracy: 0,
        },
      ];

      const creadas: Id[] = [];

      for (const publicacion of publicaciones) {
        let locationId: Id | null = null;

        if (publicacion.lugar) {
          const _id = new ObjectId();

          await db.collection('locations').insertOne({
            _id,
            country: 'México',
            state: 'Durango',
            city: publicacion.lugar.city,
            route: null,
            streetNumber: null,
            postalCode: null,
            lat: publicacion.lugar.lat,
            lng: publicacion.lugar.lng,
            createdAt: ahora,
            updatedAt: ahora,
          });

          locationId = _id;
        }

        const _id = new ObjectId();
        const fecha = haceHoras(publicacion.horas);

        await db.collection('posts').insertOne({
          _id,
          userId: publicacion.userId,
          description: publicacion.description,
          kind: publicacion.kind,
          locationId,
          locationAccuracy: publicacion.accuracy,
          createdAt: fecha,
          updatedAt: fecha,
        });

        creadas.push(_id);
      }

      console.log(`  ${creadas.length} publicaciones`);

      // --- Comentarios ------------------------------------------------------
      const comentarios = [
        { post: 0, autor: marta, body: 'Abre, pero con horario reducido: de nueve a dos.' },
        { post: 0, autor: kike, body: 'Confirmo, estuve el año pasado en el mismo festivo.' },
        { post: 0, autor: usuario, body: '¡Gracias a los dos! Me ahorráis el viaje en balde.' },
        { post: 1, autor: usuario, body: 'Me apunto. ¿Hace falta llevar algo más?' },
        { post: 1, autor: marta, body: 'Con guantes y ganas vamos servidos.' },
        { post: 2, autor: usuario, body: '¿Sigue disponible? Puedo pasar mañana por la tarde.' },
        { post: 3, autor: kike, body: 'Mi cuñado es fontanero, te paso su contacto por privado.' },
        { post: 5, autor: admin, body: 'Yo llevo el mío ahí desde hace años, sin queja.' },
      ];

      for (const comentario of comentarios) {
        const fecha = haceHoras(publicaciones[comentario.post].horas - 1);

        await db.collection('comments').insertOne({
          postId: creadas[comentario.post],
          userId: comentario.autor,
          body: comentario.body,
          deletedAt: null,
          createdAt: fecha,
          updatedAt: fecha,
        });
      }

      console.log(`  ${comentarios.length} comentarios`);

      // --- Reacciones -------------------------------------------------------
      // Variadas, para que los contadores no salgan todos a cero y se vea cómo
      // queda la tarjeta con varias reacciones distintas.
      const reacciones = [
        { post: 0, quien: marta, type: 'like' },
        { post: 0, quien: kike, type: 'love' },
        { post: 1, quien: usuario, type: 'love' },
        { post: 1, quien: kike, type: 'like' },
        { post: 1, quien: admin, type: 'wow' },
        { post: 2, quien: usuario, type: 'like' },
        { post: 3, quien: kike, type: 'care' },
        { post: 5, quien: marta, type: 'haha' },
        { post: 6, quien: kike, type: 'sad' },
        { post: 6, quien: marta, type: 'like' },
      ];

      for (const reaccion of reacciones) {
        await db.collection('post_reactions').insertOne({
          postId: creadas[reaccion.post],
          userId: reaccion.quien,
          type: reaccion.type,
          createdAt: ahora,
          updatedAt: ahora,
        });
      }

      console.log(`  ${reacciones.length} reacciones`);
    } else {
      console.log('  publicaciones de ejemplo: ya estaban');
    }

    // --- Fotos de las publicaciones -----------------------------------------
    // Un reparto desigual a propósito: publicaciones sin foto, con una y con
    // varias, que es lo que distingue las tres composiciones de la galería.
    // Se buscan por su texto para que también reciban fotos las que quedaron
    // creadas en una ejecución anterior.
    const galerias = [
      {
        busca: 'limpieza del parque',
        fotos: ['parque-limpieza', 'parque-voluntarios', 'parque-arboles'],
      },
      { busca: 'estantería de pino', fotos: ['estanteria-pino'] },
      { busca: 'amanecer de hoy desde el cerro', fotos: ['amanecer-cerro', 'amanecer-valle'] },
      { busca: 'taller mecánico de la calle Victoria', fotos: ['taller-mecanico'] },
    ];

    let fotos = 0;

    for (const galeria of galerias) {
      const post = await db.collection('posts').findOne({ description: { $regex: galeria.busca } });

      if (!post || (await db.collection('media').countDocuments({ postId: post._id })) > 0) {
        continue;
      }

      for (const [position, semilla] of galeria.fotos.entries()) {
        const media = await guardarFoto(db, FOTO(semilla), 'post', String(post.description), {
          postId: post._id,
          position,
        });

        if (media) {
          fotos += 1;
        }
      }
    }

    console.log(`  ${fotos} fotos en las publicaciones`);

    // --- Una conversación ---------------------------------------------------
    if ((await db.collection('conversations').countDocuments()) === 0) {
      const conversacion = new ObjectId();
      const mensajes = [
        { de: usuario, body: 'Hola Marta, ¿sigue en pie lo del sábado?', horas: 4 },
        { de: marta, body: 'Sí, a las nueve en la entrada del parque.', horas: 3 },
        { de: usuario, body: 'Perfecto, allí nos vemos.', horas: 3 },
      ];
      const ultimo = mensajes.at(-1)!;

      await db.collection('conversations').insertOne({
        _id: conversacion,
        lastMessageAt: haceHoras(ultimo.horas),
        lastPreview: ultimo.body.slice(0, 160),
        createdAt: haceHoras(5),
        updatedAt: haceHoras(ultimo.horas),
      });

      for (const miembro of [usuario, marta]) {
        await db.collection('conversation_members').insertOne({
          conversationId: conversacion,
          userId: miembro,
          lastReadAt: null,
          muted: false,
          createdAt: haceHoras(5),
        });
      }

      for (const mensaje of mensajes) {
        await db.collection('messages').insertOne({
          conversationId: conversacion,
          senderId: mensaje.de,
          kind: 'text',
          body: mensaje.body,
          mediaId: null,
          deletedAt: null,
          createdAt: haceHoras(mensaje.horas),
        });
      }

      console.log(`  1 conversación con ${mensajes.length} mensajes`);
    } else {
      console.log('  conversaciones: ya había, no se tocan');
    }

    // Los documentos de arriba se escriben a mano; la migración les pone las
    // cifras, claves y campos que dejaría la API, igual que a una base antigua.
    console.log('\nNormalizando…');
    await migrateToSocial(db, (line) => console.log(line));

    console.log(`\nListo. Todas las cuentas usan la contraseña: ${SEED_PASSWORD}`);
  } finally {
    await cliente.close();
  }
}

main().catch((error: unknown) => {
  console.error('El seed ha fallado:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
