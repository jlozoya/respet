#!/usr/bin/env node
/**
 * Comprueba que las traducciones de la aplicación van a la par.
 *
 * ngx-translate no se queja de nada: una clave que falta en un idioma enseña
 * la clave en crudo —`PROFILE.EDIT`— y un hueco mal escrito —`{{nombre}}` en
 * lugar de `{{name}}`— se queda tal cual en pantalla. Nada de eso lo ve el
 * compilador, así que lo mira esto:
 *
 * - que cada archivo sea JSON válido;
 * - que todos los idiomas tengan exactamente las mismas claves;
 * - que cada texto tenga los mismos huecos `{{…}}` en todos los idiomas;
 * - que ningún texto quede vacío.
 *
 * El primer idioma de la lista es la referencia contra la que se comparan los
 * demás.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRECTORY = join(ROOT, 'apps/mobile/src/assets/i18n');
const LANGUAGES = ['es', 'en'];
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Aplana `{ A: { B: 'x' } }` en `{ 'A.B': 'x' }`. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }

  return out;
}

/**
 * Los nombres de los huecos, sin repetir: que un idioma nombre la marca tres
 * veces en un párrafo y otro cuatro es cosa de la traducción, no un error.
 */
function placeholdersOf(text) {
  const names = new Set([...String(text).matchAll(PLACEHOLDER)].map((match) => match[1]));

  return [...names].sort().join(', ');
}

const problems = [];
const catalogs = new Map();

for (const language of LANGUAGES) {
  const file = join(DIRECTORY, `${language}.json`);

  try {
    catalogs.set(language, flatten(JSON.parse(readFileSync(file, 'utf8'))));
  } catch (error) {
    problems.push(`${language}.json no se puede leer: ${error.message}`);
  }
}

const [reference, ...others] = LANGUAGES.filter((language) => catalogs.has(language));
const base = catalogs.get(reference);

for (const [language, catalog] of catalogs) {
  for (const [key, value] of catalog) {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${language}: «${key}» está vacía o no es texto`);
    }
  }
}

for (const language of others) {
  const catalog = catalogs.get(language);

  for (const key of base.keys()) {
    if (!catalog.has(key)) {
      problems.push(`${language}: falta «${key}»`);
    }
  }

  for (const [key, value] of catalog) {
    if (!base.has(key)) {
      problems.push(`${language}: sobra «${key}», que no está en ${reference}`);
      continue;
    }

    const expected = placeholdersOf(base.get(key));
    const actual = placeholdersOf(value);

    if (expected !== actual) {
      problems.push(
        `${language}: «${key}» tiene los huecos [${actual}] y en ${reference} son [${expected}]`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`Traducciones: ${problems.length} problema(s)\n`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`Traducciones: ${base.size} textos, iguales en ${LANGUAGES.join(' y ')}.`);
