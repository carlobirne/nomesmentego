// Notifiche dell'app (Web Push): arrivano sul telefono anche senza Telegram né email.
// Cifratura del contenuto secondo RFC 8291 (aes128gcm) e autenticazione VAPID (RFC 8292),
// tutto con WebCrypto. Le chiavi VAPID le crea il server al primo uso e le salva nel database.
import { normalizza } from '../web/core/modello.js';
import { json, errore, leggiCorpo, nuovoToken } from './http.js';
import { adessoLocale, avvisiDaMandare, pulisciFiltro, descriviFiltro } from './giro.js';

const enc = new TextEncoder();
export const b64u = {
  da: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  a: (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const unisci = (...parti) => {
  const out = new Uint8Array(parti.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parti) { out.set(p, i); i += p.length; }
  return out;
};
async function hmac(chiave, dati) {
  const k = await crypto.subtle.importKey('raw', chiave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dati));
}

/** Cifra il contenuto per un abbonamento (RFC 8291). Restituisce il corpo della richiesta. */
export async function cifra(testo, p256dh, auth, { salt = crypto.getRandomValues(new Uint8Array(16)), coppia } = {}) {
  const pubUa = b64u.a(p256dh), segreto = b64u.a(auth);
  const as = coppia || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubAs = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const chiaveUa = await crypto.subtle.importKey('raw', pubUa, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: chiaveUa }, as.privateKey, 256));
  const prkChiave = await hmac(segreto, ecdh);
  const ikm = (await hmac(prkChiave, unisci(enc.encode('WebPush: info\0'), pubUa, pubAs, [1]))).slice(0, 32);
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, unisci(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, unisci(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, unisci(enc.encode(testo), [2])));
  const intestazione = new Uint8Array(21 + pubAs.length);
  intestazione.set(salt, 0);
  new DataView(intestazione.buffer).setUint32(16, 4096);
  intestazione[20] = pubAs.length;
  intestazione.set(pubAs, 21);
  return unisci(intestazione, cifrato);
}

/** Chiavi VAPID del server: le crea la prima volta e le conserva nel database. */
export async function chiaviVapid(archivio) {
  let v = await archivio.impostazione('vapid');
  if (!v) {
    const coppia = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u.da(await crypto.subtle.exportKey('raw', coppia.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', coppia.privateKey);
    await archivio.salvaImpostazione('vapid', JSON.stringify({ pub, jwk }), { soloSeManca: true });
    v = await archivio.impostazione('vapid'); // se due richieste arrivano insieme vince la prima
  }
  return JSON.parse(v);
}

/** Intestazione Authorization VAPID per un endpoint. */
export async function autorizzazioneVapid(endpoint, vapid, soggetto, adesso = Date.now()) {
  const h = b64u.da(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u.da(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(adesso / 1000) + 12 * 3600, sub: soggetto })));
  const k = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(h + '.' + p));
  return 'vapid t=' + h + '.' + p + '.' + b64u.da(firma) + ', k=' + vapid.pub;
}

/** Manda una notifica. Restituisce lo stato HTTP del servizio push (201 = ok, 404/410 = abbonamento scaduto). */
export async function inviaPush(riga, contenuto, vapid, fetchFn = fetch) {
  const { p256dh, auth } = JSON.parse(riga.chiavi);
  const corpo = await cifra(JSON.stringify(contenuto), p256dh, auth);
  const r = await fetchFn(riga.destinazione, {
    method: 'POST',
    headers: {
      authorization: await autorizzazioneVapid(riga.destinazione, vapid, riga.origine || 'mailto:nomesmentego@example.com'),
      'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '43200', urgency: 'high',
    },
    body: corpo,
  });
  return r.status;
}

function contenutoAvviso(bacheca, av, riga) {
  const p = bacheca.promemoria.find((x) => x.id === av.promemoria);
  const gruppo = bacheca.gruppi.find((g) => g.id === p.gruppo);
  const righe = [[av.testo.includes(p.titolo) ? '' : p.titolo, gruppo?.nome, bacheca.nome].filter(Boolean).join(' · '), ...av.occorrenza.note];
  return {
    title: av.testo, body: righe.filter(Boolean).join('\n'), tag: av.id,
    url: (riga.origine || '') + '/v/' + riga.token_lettura + '#oggi', icona: p.icona || gruppo?.icona || 'campanella',
  };
}

/** Giro di invio delle notifiche dell'app. */
export async function inviaNotifiche({ archivio, adesso = new Date(), fetchFn = fetch }) {
  const righe = await archivio.notificheAttive('push');
  if (!righe.length) return { inviati: 0 };
  const vapid = await chiaviVapid(archivio);
  let inviati = 0;
  for (const riga of righe) {
    let bacheca;
    try { bacheca = normalizza(JSON.parse(riga.dati)); } catch { continue; }
    const { avvisi, ora } = avvisiDaMandare(riga, bacheca, adesso);
    if (!avvisi.length) continue;
    let ok = true;
    for (const av of avvisi) {
      let stato;
      try { stato = await inviaPush(riga, contenutoAvviso(bacheca, av, riga), vapid, fetchFn); } catch { stato = 0; }
      if (stato === 404 || stato === 410) { await archivio.rimuoviNotifica(riga.id); ok = false; break; } // il telefono ha revocato il permesso
      if (stato < 200 || stato >= 300) { ok = false; break; } // errore temporaneo: riprovo al prossimo giro
      inviati++;
    }
    if (ok) await archivio.aggiornaNotifica(riga.id, { ultimo: ora });
  }
  return { inviati };
}

const descrivi = (r, bacheca) => ({ id: r.id, nome: r.nome, filtro: descriviFiltro(r, bacheca), creata: r.creata });

/**
 * API: /api/b/<token>/push[/chiave|/prova|/<id>]
 * Chiunque abbia il link (anche di sola lettura) può attivare o togliere le notifiche sul proprio telefono;
 * solo chi può modificare vede e gestisce l'elenco dei telefoni.
 */
export async function apiPush({ request, url, metodo, sotto, riga, permesso, archivio, fetchFn = fetch }) {
  const bacheca = normalizza(JSON.parse(riga.dati));
  if (sotto === 'chiave' && metodo === 'GET') return json({ chiave: (await chiaviVapid(archivio)).pub });
  if (sotto === '' && metodo === 'POST') {
    const corpo = await leggiCorpo(request);
    const s = corpo.abbonamento || {};
    if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return errore(400, 'Abbonamento non valido.');
    const r = await archivio.salvaNotifica({
      id: nuovoToken(9), bachecaId: riga.id, canale: 'push', destinazione: s.endpoint,
      chiavi: JSON.stringify({ p256dh: s.keys.p256dh, auth: s.keys.auth }), nome: String(corpo.nome || 'Telefono').slice(0, 60),
      stato: 'attivo', token: nuovoToken(), origine: url.origin, ultimo: adessoLocale(bacheca.fusoOrario), creata: new Date().toISOString(),
    });
    return json({ id: r.id }, 201);
  }
  if (sotto === 'prova' && metodo === 'POST') {
    // prova sul proprio telefono (endpoint nel corpo) oppure, per chi modifica, su tutti
    const corpo = await leggiCorpo(request);
    const tutte = await archivio.notifiche(riga.id, 'push');
    const scelte = corpo.endpoint ? tutte.filter((n) => n.destinazione === corpo.endpoint) : (permesso === 'modifica' ? tutte : []);
    const vapid = await chiaviVapid(archivio);
    let ok = 0;
    for (const n of scelte) {
      const stato = await inviaPush({ ...n, token_lettura: riga.token_lettura }, {
        title: 'Prova: le notifiche funzionano', body: bacheca.nome, tag: 'prova', url: url.origin + '/v/' + (riga.token_lettura || '') + '#oggi', icona: 'campanella',
      }, vapid, fetchFn).catch(() => 0);
      if (stato === 404 || stato === 410) await archivio.rimuoviNotifica(n.id);
      else if (stato >= 200 && stato < 300) ok++;
    }
    return json({ inviati: ok, totale: scelte.length });
  }
  if (sotto === 'via' && metodo === 'POST') { // togli questo telefono (basta conoscere il proprio endpoint)
    const corpo = await leggiCorpo(request);
    const n = (await archivio.notifiche(riga.id, 'push')).find((x) => x.destinazione === corpo.endpoint);
    if (n) await archivio.rimuoviNotifica(n.id);
    return json({ ok: true });
  }
  if (sotto === 'mio' && metodo === 'POST') { // questo telefono è già abbonato?
    const corpo = await leggiCorpo(request);
    const n = (await archivio.notifiche(riga.id, 'push')).find((x) => x.destinazione === corpo.endpoint);
    return json({ attivo: !!n });
  }
  if (permesso !== 'modifica') return errore(403, 'Questo è un link di sola lettura.');
  if (sotto === '' && metodo === 'GET') return json({ telefoni: (await archivio.notifiche(riga.id, 'push')).map((r) => descrivi(r, bacheca)) });
  const n = await archivio.notifica(sotto);
  if (!n || n.bacheca_id !== riga.id || n.canale !== 'push') return errore(404, 'Telefono non trovato.');
  if (metodo === 'PUT') {
    const corpo = await leggiCorpo(request);
    const filtro = pulisciFiltro(corpo.filtro, bacheca);
    await archivio.aggiornaNotifica(n.id, { filtro: filtro ? JSON.stringify(filtro) : null });
    return json({ filtro });
  }
  if (metodo === 'DELETE') { await archivio.rimuoviNotifica(n.id); return json({ ok: true }); }
  return errore(405, 'Operazione non supportata.');
}
