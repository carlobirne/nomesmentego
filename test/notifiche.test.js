import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestisci } from '../worker/index.js';
import { ArchivioMemoria } from '../worker/archivio.js';
import { inviaNotifiche, b64u, cifra } from '../worker/push.js';
import { inviaEmail, creaPosta, componi, MODELLO_PREDEFINITO } from '../worker/email.js';

const enc = new TextEncoder();
async function hmac(k, d) {
  const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, d));
}
const unisci = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

/** Un "browser" finto: chiavi dell'abbonamento e decifratura come da RFC 8291. */
async function browser() {
  const coppia = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', coppia.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    abbonamento: { endpoint: 'https://push.example.com/send/' + Math.random().toString(36).slice(2), keys: { p256dh: b64u.da(pub), auth: b64u.da(auth) } },
    async decifra(corpo) {
      const salt = corpo.slice(0, 16), rs = new DataView(corpo.buffer, corpo.byteOffset).getUint32(16), idlen = corpo[20];
      assert.equal(rs, 4096);
      const pubAs = corpo.slice(21, 21 + idlen), cifrato = corpo.slice(21 + idlen);
      const kAs = await crypto.subtle.importKey('raw', pubAs, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: kAs }, coppia.privateKey, 256));
      const ikm = (await hmac(await hmac(auth, ecdh), unisci(enc.encode('WebPush: info\0'), pub, pubAs, [1]))).slice(0, 32);
      const prk = await hmac(salt, ikm);
      const cek = (await hmac(prk, unisci(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
      const nonce = (await hmac(prk, unisci(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
      const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const chiaro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cifrato));
      assert.equal(chiaro.at(-1), 2); // delimitatore dell'ultimo record
      return JSON.parse(new TextDecoder().decode(chiaro.slice(0, -1)));
    },
  };
}

async function ambiente({ posta } = {}) {
  const archivio = new ArchivioMemoria();
  const consegne = [];
  let statoPush = 201;
  const fetchPush = async (url, opz) => { consegne.push({ url, opz }); return new Response(null, { status: statoPush }); };
  const chiama = async (metodo, percorso, corpo) => {
    const r = await gestisci(new Request('https://app.test' + percorso, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) }),
      {}, archivio, null, { posta, fetchPush });
    const tipo = r.headers.get('content-type') || '';
    return { stato: r.status, corpo: tipo.includes('json') ? await r.json() : await r.text() };
  };
  const c = await chiama('POST', '/api/bacheche', { dati: { versione: 2, nome: 'Casa', gruppi: [{ id: 'auto', nome: 'Auto', icona: 'auto' }], promemoria: [
    { id: 'med', titolo: 'Medicina', icona: 'medicina', nota: 'Dopo colazione', quando: { tipo: 'giornaliero', inizio: '2020-01-01' }, avvisi: [{ prima: 0, unita: 'giorni', ora: '08:00', testo: 'Prendi la pastiglia' }] },
    { id: 'bollo', titolo: 'Bollo', gruppo: 'auto', quando: { tipo: 'scadenza', scadenza: '2030-01-02' }, avvisi: [{ prima: 1, unita: 'giorni', ora: '08:00' }] },
  ] } });
  return { archivio, consegne, chiama, fetchPush, setStatoPush: (s) => { statoPush = s; }, modifica: c.corpo.modifica, lettura: c.corpo.lettura };
}

test('notifiche dell\'app: abbonamento anche in sola lettura, contenuto cifrato e firmato, filtro, revoca', async () => {
  const a = await ambiente();
  const tel = await browser();
  const chiave = await a.chiama('GET', '/api/b/' + a.lettura + '/push/chiave');
  assert.equal(b64u.a(chiave.corpo.chiave).length, 65);
  assert.equal((await a.chiama('GET', '/api/b/' + a.lettura + '/push/chiave')).corpo.chiave, chiave.corpo.chiave); // stessa chiave, salvata
  assert.equal((await a.chiama('POST', '/api/b/' + a.lettura + '/push', { abbonamento: { endpoint: 'http://x' } })).stato, 400);
  const iscr = await a.chiama('POST', '/api/b/' + a.lettura + '/push', { abbonamento: tel.abbonamento, nome: 'Android di mamma' });
  assert.equal(iscr.stato, 201);
  assert.equal((await a.chiama('POST', '/api/b/' + a.lettura + '/push/mio', { endpoint: tel.abbonamento.endpoint })).corpo.attivo, true);
  assert.equal((await a.chiama('GET', '/api/b/' + a.lettura + '/push')).stato, 403);
  const lista = await a.chiama('GET', '/api/b/' + a.modifica + '/push');
  assert.deepEqual(lista.corpo.telefoni.map((t) => t.nome), ['Android di mamma']);

  a.archivio.notificheRighe[0].ultimo = '2030-01-01T07:55';
  const r = await inviaNotifiche({ archivio: a.archivio, adesso: new Date('2030-01-01T07:10:00Z'), fetchFn: a.fetchPush });
  assert.equal(r.inviati, 2);
  const [primo] = a.consegne;
  assert.equal(primo.url, tel.abbonamento.endpoint);
  assert.equal(primo.opz.headers['content-encoding'], 'aes128gcm');
  const contenuto = await tel.decifra(primo.opz.body);
  assert.equal(contenuto.title, 'Prendi la pastiglia');
  assert.equal(contenuto.body, 'Medicina · Casa');
  assert.equal(contenuto.url, 'https://app.test/v/' + a.lettura + '#oggi');
  assert.equal((await tel.decifra(a.consegne[1].opz.body)).title, 'Bollo (domani, 2 gen)');

  // firma VAPID verificabile con la chiave pubblica e destinata al servizio push giusto
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(primo.opz.headers.authorization);
  assert.equal(k, chiave.corpo.chiave);
  const [h, p, firma] = jwt.split('.');
  const pub = await crypto.subtle.importKey('raw', b64u.a(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64u.a(firma), enc.encode(h + '.' + p)));
  assert.equal(JSON.parse(new TextDecoder().decode(b64u.a(p))).aud, 'https://push.example.com');

  // solo il gruppo "auto"
  const id = lista.corpo.telefoni[0].id;
  assert.deepEqual((await a.chiama('PUT', '/api/b/' + a.modifica + '/push/' + id, { filtro: ['auto'] })).corpo.filtro, ['auto']);
  a.consegne.length = 0;
  await inviaNotifiche({ archivio: a.archivio, adesso: new Date('2030-01-02T07:10:00Z'), fetchFn: a.fetchPush });
  assert.equal(a.consegne.length, 0); // il 2 gennaio c'è solo la medicina (fuori filtro)

  // il telefono revoca il permesso: 410 e l'abbonamento sparisce
  a.setStatoPush(410);
  await a.chiama('POST', '/api/b/' + a.modifica + '/push/prova', {});
  assert.equal(a.archivio.notificheRighe.length, 0);
});

test('cifratura deterministica con sale e chiavi fissi (stessa lunghezza dell\'RFC 8291)', async () => {
  const tel = await browser();
  const corpo = await cifra('When I grow up, I want to be a watermelon', tel.abbonamento.keys.p256dh, tel.abbonamento.keys.auth);
  assert.equal(corpo.length, 16 + 4 + 1 + 65 + 41 + 1 + 16); // intestazione + testo + delimitatore + tag GCM
});

function postaFinta() {
  const p = { servizio: 'Finto', mandate: [], async invia(m) { p.mandate.push(m); } };
  return p;
}

test('email: conferma a due passi, modello personalizzato, giro di invio e disiscrizione', async () => {
  const posta = postaFinta();
  const a = await ambiente({ posta });
  assert.equal((await a.chiama('GET', '/api/config')).corpo.email, true);
  assert.equal((await a.chiama('GET', '/api/b/' + a.lettura + '/email')).stato, 403);
  assert.equal((await a.chiama('POST', '/api/b/' + a.modifica + '/email', { indirizzo: 'non-una-email' })).stato, 400);

  const d = await a.chiama('POST', '/api/b/' + a.modifica + '/email', { indirizzo: ' Mamma@Example.com ', nome: 'Mamma' });
  assert.equal(d.stato, 201);
  assert.equal(d.corpo.indirizzo, 'mamma@example.com');
  assert.equal(d.corpo.stato, 'da-confermare');
  assert.equal(posta.mandate.length, 1);
  assert.match(posta.mandate[0].oggetto, /^Conferma: promemoria di "Casa"$/);
  const token = /\/email\/conferma\/([A-Za-z0-9_-]+)/.exec(posta.mandate[0].testo)[1];

  // non confermato: niente avvisi
  const riga = a.archivio.notificheRighe[0];
  riga.ultimo = '2030-01-01T07:55';
  posta.mandate.length = 0;
  await inviaEmail({ archivio: a.archivio, posta, adesso: new Date('2030-01-01T07:10:00Z') });
  assert.equal(posta.mandate.length, 0);

  // aprire il link (anche un filtro antispam) non conferma: serve il pulsante
  const pag = await a.chiama('GET', '/email/conferma/' + token);
  assert.match(pag.corpo, /<form method="post">/);
  assert.equal(riga.stato, 'da-confermare');
  assert.match((await a.chiama('POST', '/email/conferma/' + token)).corpo, /Fatto!/);
  assert.equal(riga.stato, 'attivo');

  // modello personalizzato
  await a.chiama('PUT', '/api/b/' + a.modifica + '/email/modello', { oggetto: 'Promemoria: {promemoria}', corpo: 'Cara mamma,\n{testo}\n{nota}' });
  const ant = await a.chiama('POST', '/api/b/' + a.modifica + '/email/anteprima', { oggetto: 'X {testo}', corpo: '{voci} e {sconosciuto}' });
  assert.equal(ant.corpo.oggetto, 'X Metti fuori stasera: Umido, Plastica');
  assert.match(ant.corpo.testo, /^Umido, Plastica e \{sconosciuto\}\n\n--\nCasa\n/);

  riga.ultimo = '2030-01-01T07:55';
  await inviaEmail({ archivio: a.archivio, posta, adesso: new Date('2030-01-01T07:10:00Z') });
  assert.deepEqual(posta.mandate.map((m) => m.oggetto), ['Promemoria: Medicina', 'Promemoria: Bollo']);
  const m = posta.mandate[0];
  assert.equal(m.a, 'mamma@example.com');
  assert.match(m.testo, /^Cara mamma,\nPrendi la pastiglia\nDopo colazione\n\n--\nCasa\nApri la bacheca: https:\/\/app\.test\/v\/.+\nNon vuoi più ricevere queste email\? https:\/\/app\.test\/email\/stop\//);
  assert.match(m.html, /Apri la bacheca/);
  assert.ok(m.disiscrivi.endsWith('/email/stop/' + token));

  // niente doppioni
  posta.mandate.length = 0;
  await inviaEmail({ archivio: a.archivio, posta, adesso: new Date('2030-01-01T07:12:00Z') });
  assert.equal(posta.mandate.length, 0);

  // disiscrizione con un clic (POST, come fanno i programmi di posta)
  assert.match((await a.chiama('GET', '/email/stop/' + token)).corpo, /non mandarmeli più/);
  assert.match((await a.chiama('POST', '/email/stop/' + token)).corpo, /Non riceverai più/);
  assert.equal(a.archivio.notificheRighe.length, 0);
  assert.match((await a.chiama('GET', '/email/stop/' + token)).corpo, /Link non valido/);
});

test('email: senza servizio configurato, segnaposto e client Brevo/Resend', async () => {
  const a = await ambiente();
  const g = await a.chiama('GET', '/api/b/' + a.modifica + '/email');
  assert.equal(g.corpo.attiva, false);
  assert.deepEqual(g.corpo.modello, MODELLO_PREDEFINITO);
  assert.equal((await a.chiama('POST', '/api/b/' + a.modifica + '/email', { indirizzo: 'a@b.it' })).stato, 503);

  const v = { testo: 'Bollo', promemoria: 'Bollo', voci: '', gruppo: '', data: 'lunedì 1 gen 2030', quando: 'domani', ripetizione: '', nota: '', bacheca: 'Casa' };
  const c = componi(MODELLO_PREDEFINITO, v, {});
  assert.equal(c.oggetto, 'Bollo');
  assert.ok(!/\n{3,}/.test(c.testo) && !/· *\n/.test(c.testo), c.testo);

  const chiamate = [];
  const f = async (url, o) => { chiamate.push([url, JSON.parse(o.body), o.headers]); return new Response('{}', { status: 201 }); };
  assert.equal(creaPosta({}), null);
  await creaPosta({ BREVO_API_KEY: 'k', EMAIL_MITTENTE: 'io@x.it' }, f).invia({ a: 'y@z.it', oggetto: 'O', testo: 'T', html: '<p>T</p>', disiscrivi: 'https://s' });
  assert.equal(chiamate[0][0], 'https://api.brevo.com/v3/smtp/email');
  assert.equal(chiamate[0][2]['api-key'], 'k');
  assert.deepEqual(chiamate[0][1].to, [{ email: 'y@z.it' }]);
  assert.equal(chiamate[0][1].headers['List-Unsubscribe'], '<https://s>');
  await creaPosta({ RESEND_API_KEY: 'r', EMAIL_MITTENTE: 'io@x.it', EMAIL_NOME: 'Casa' }, f).invia({ a: 'y@z.it', oggetto: 'O', testo: 'T', html: 'H' });
  assert.equal(chiamate[1][0], 'https://api.resend.com/emails');
  assert.equal(chiamate[1][1].from, 'Casa <io@x.it>');
  const ko = creaPosta({ BREVO_API_KEY: 'k', EMAIL_MITTENTE: 'io@x.it' }, async () => new Response('{"message":"no"}', { status: 401 }));
  await assert.rejects(ko.invia({ a: 'y@z.it', oggetto: 'O', testo: 'T', html: 'H' }), /401/);
});
