import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestisci } from '../worker/index.js';
import { ArchivioMemoria } from '../worker/archivio.js';

function server(env = {}) {
  const archivio = new ArchivioMemoria();
  const chiama = async (metodo, percorso, corpo) => {
    const r = await gestisci(new Request('https://app.test' + percorso, {
      method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }), env, archivio);
    const tipo = r.headers.get('content-type') || '';
    return { stato: r.status, corpo: tipo.includes('json') ? await r.json() : await r.text(), headers: r.headers };
  };
  return { archivio, chiama };
}

test('crea, legge, modifica una bacheca e gestisce i conflitti', async () => {
  const { chiama, archivio } = server();
  const c = await chiama('POST', '/api/bacheche', { nome: 'Casa di mamma' });
  assert.equal(c.stato, 201);
  assert.equal(c.corpo.dati.nome, 'Casa di mamma');
  assert.notEqual(c.corpo.modifica, c.corpo.lettura);
  // il link di modifica non è salvato in chiaro
  assert.ok(![...archivio.righe.values()].some((r) => JSON.stringify(r).includes(c.corpo.modifica)));

  const g = await chiama('GET', '/api/b/' + c.corpo.modifica);
  assert.equal(g.corpo.permesso, 'modifica');
  assert.equal(g.corpo.lettura, c.corpo.lettura);

  const dati = { ...g.corpo.dati, promemoria: [{ id: 'mercato', titolo: 'Mercato', quando: { tipo: 'settimanale', giorni: ['mar'] },
    avvisi: [{ prima: 1, unita: 'giorni', ora: '19:00' }] }] };
  const p = await chiama('PUT', '/api/b/' + c.corpo.modifica, { versione: 1, dati });
  assert.equal(p.stato, 200);
  assert.equal(p.corpo.versione, 2);

  // un secondo telefono con la versione vecchia riceve 409 e i dati aggiornati
  const vecchio = await chiama('PUT', '/api/b/' + c.corpo.modifica, { versione: 1, dati: { ...dati, nome: 'X' } });
  assert.equal(vecchio.stato, 409);
  assert.equal(vecchio.corpo.versione, 2);
  assert.equal(vecchio.corpo.dati.promemoria[0].titolo, 'Mercato');

  // il link di sola lettura legge ma non scrive
  const l = await chiama('GET', '/api/b/' + c.corpo.lettura);
  assert.equal(l.corpo.permesso, 'lettura');
  assert.equal(l.corpo.lettura, undefined);
  assert.equal((await chiama('PUT', '/api/b/' + c.corpo.lettura, { versione: 2, dati })).stato, 403);

  // copia di sicurezza della versione 1
  const s = await chiama('GET', '/api/b/' + c.corpo.modifica + '/storico');
  assert.deepEqual(s.corpo.copie.map((x) => x.versione), [1]);
  const v1 = await chiama('GET', '/api/b/' + c.corpo.modifica + '/storico/1');
  assert.equal(v1.corpo.dati.promemoria.length, 0);
});

test('feed calendario con il link di sola lettura', async () => {
  const { chiama } = server();
  const c = await chiama('POST', '/api/bacheche', { dati: { versione: 2, nome: 'Feed', promemoria: [
    { titolo: 'Medicina', quando: { tipo: 'giornaliero', inizio: '2020-01-01' }, avvisi: [{ prima: 0, unita: 'giorni', ora: '08:00' }] },
  ] } });
  const f = await chiama('GET', '/feed/' + c.corpo.lettura + '.ics');
  assert.equal(f.stato, 200);
  assert.match(f.headers.get('content-type'), /text\/calendar/);
  assert.match(f.corpo, /^BEGIN:VCALENDAR/);
  assert.match(f.corpo, /SUMMARY:Medicina/);
  assert.equal((await chiama('GET', '/feed/' + c.corpo.modifica + '.ics')).stato, 404); // il link di modifica non apre il feed
  assert.equal((await chiama('GET', '/feed/nonesiste1234567890abc.ics')).stato, 404);
});

test('cambiare un link invalida quello vecchio', async () => {
  const { chiama } = server();
  const c = await chiama('POST', '/api/bacheche', {});
  const r = await chiama('POST', '/api/b/' + c.corpo.modifica + '/rigenera', { quale: 'modifica' });
  assert.equal((await chiama('GET', '/api/b/' + c.corpo.modifica)).stato, 404);
  assert.equal((await chiama('GET', '/api/b/' + r.corpo.modifica)).corpo.permesso, 'modifica');
  const l = await chiama('POST', '/api/b/' + r.corpo.modifica + '/rigenera', { quale: 'lettura' });
  assert.equal((await chiama('GET', '/feed/' + c.corpo.lettura + '.ics')).stato, 404);
  assert.equal((await chiama('GET', '/feed/' + l.corpo.lettura + '.ics')).stato, 200);
});

test('codice di invito, dati non validi e limiti', async () => {
  const { chiama } = server({ CODICE_INVITO: 'famiglia' });
  assert.equal((await chiama('GET', '/api/config')).corpo.serveCodice, true);
  assert.equal((await chiama('POST', '/api/bacheche', { codice: 'sbagliato' })).stato, 403);
  const c = await chiama('POST', '/api/bacheche', { codice: 'famiglia' });
  assert.equal(c.stato, 201);
  assert.equal((await chiama('PUT', '/api/b/' + c.corpo.modifica, { versione: 1, dati: 'ciao' })).stato, 400);
  assert.equal((await chiama('PUT', '/api/b/' + c.corpo.modifica, { versione: 1, dati: { nota: 'x'.repeat(400_000) } })).stato, 413);
  assert.equal((await chiama('GET', '/api/b/corto')).stato, 404);
  const m = await chiama('GET', '/manifest/b/' + c.corpo.modifica + '?nome=Casa');
  assert.equal(m.corpo.start_url, '/b/' + c.corpo.modifica);
});

test('la pagina di una bacheca porta il suo manifest e il suo nome (per "Aggiungi a schermata Home")', async () => {
  const fs = await import('node:fs');
  const indice = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const ASSETS = { fetch: async (req) => new URL(req.url).pathname === '/' ? new Response(indice, { headers: { 'content-type': 'text/html' } }) : new Response('no', { status: 404 }) };
  const { chiama } = server({ ASSETS });
  const c = await chiama('POST', '/api/bacheche', { nome: 'Casa "di" mamma' });
  const b = await chiama('GET', '/b/' + c.corpo.modifica);
  assert.equal(b.stato, 200);
  assert.ok(b.corpo.includes('<link id="manifest" rel="manifest" href="/manifest/b/' + c.corpo.modifica + '?nome=Casa%20%22di%22%20mamma">'));
  assert.ok(b.corpo.includes('<meta name="apple-mobile-web-app-title" content="Casa &quot;di&quot; mamma">'));
  const v = await chiama('GET', '/v/' + c.corpo.lettura);
  assert.ok(v.corpo.includes('href="/manifest/v/' + c.corpo.lettura + '?nome='));
  // link sconosciuto: la pagina si apre lo stesso (sarà l'app a dire che non esiste), con il manifest giusto
  const x = await chiama('GET', '/b/' + 'x'.repeat(24));
  assert.equal(x.stato, 200);
  assert.ok(x.corpo.includes('href="/manifest/b/' + 'x'.repeat(24) + '"'));
  const m = await chiama('GET', '/manifest/b/' + c.corpo.modifica + '?nome=Casa');
  assert.equal((typeof m.corpo === 'string' ? JSON.parse(m.corpo) : m.corpo).start_url, '/b/' + c.corpo.modifica);
});
