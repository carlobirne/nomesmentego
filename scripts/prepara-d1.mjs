// Usato dal deploy automatico: trova (o crea) il database D1 "nomesmentego"
// e scrive il suo id in wrangler.jsonc, così non serve copiarlo a mano.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NOME = 'nomesmentego';
const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const trova = () => JSON.parse(wrangler('d1', 'list', '--json')).find((d) => d.name === NOME);

let db = trova();
if (!db) {
  console.log(`Creo il database D1 "${NOME}"…`);
  wrangler('d1', 'create', NOME);
  db = trova();
}
if (!db) throw new Error('Database D1 non trovato dopo la creazione.');

const percorso = new URL('../wrangler.jsonc', import.meta.url);
const config = readFileSync(percorso, 'utf8');
const nuova = config.replace(/("database_id":\s*")[^"]*(")/, `$1${db.uuid}$2`);
if (nuova === config && !config.includes(db.uuid)) throw new Error('Campo database_id non trovato in wrangler.jsonc');
writeFileSync(percorso, nuova);
console.log(`Database "${NOME}": ${db.uuid}`);
