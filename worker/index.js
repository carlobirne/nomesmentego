// Cloudflare Worker: API delle bacheche, feed calendario e manifest dell'app.
// Tutto il resto (la web app in web/) lo serve direttamente Cloudflare come file statici.
import { ArchivioD1 } from './archivio.js';
import { normalizza, bachecaVuota } from '../web/core/modello.js';
import { generaICS } from '../web/core/ics.js';
import { oggi, piuGiorni, piuMesi } from '../web/core/date.js';

const MAX_BYTES = 300_000;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export function nuovoToken(byte = 18) {
  const b = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function impronta(token) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const json = (corpo, stato = 200, extra = {}) => new Response(JSON.stringify(corpo), {
  status: stato,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...extra },
});
const errore = (stato, messaggio) => json({ errore: messaggio }, stato);

async function leggiCorpo(request) {
  const testo = await request.text();
  if (new TextEncoder().encode(testo).length > MAX_BYTES) throw Object.assign(new Error('Bacheca troppo grande.'), { stato: 413 });
  try { return JSON.parse(testo || '{}'); } catch { throw Object.assign(new Error('JSON non valido.'), { stato: 400 }); }
}

/** Valida e serializza una bacheca; la normalizzazione è la stessa dell'app. */
function prepara(dati) {
  try { return JSON.stringify(normalizza(dati)); } catch (e) { throw Object.assign(new Error(e.message), { stato: 400 }); }
}

const risposta = (riga, permesso, extra = {}) => ({
  permesso,
  versione: riga.versione,
  aggiornata: riga.aggiornata,
  dati: JSON.parse(riga.dati),
  ...extra,
});

/**
 * Gestisce una richiesta. `archivio` è iniettabile per i test.
 */
export async function gestisci(request, env, archivio = new ArchivioD1(env.DB)) {
  const url = new URL(request.url);
  const parti = url.pathname.split('/').filter(Boolean);
  const metodo = request.method;
  const adesso = new Date().toISOString();

  try {
    // ---------- configurazione pubblica ----------
    if (url.pathname === '/api/config' && metodo === 'GET') {
      return json({ serveCodice: !!env.CODICE_INVITO });
    }

    // ---------- nuova bacheca ----------
    if (url.pathname === '/api/bacheche' && metodo === 'POST') {
      const corpo = await leggiCorpo(request);
      if (env.CODICE_INVITO && String(corpo.codice ?? '').trim() !== env.CODICE_INVITO) return errore(403, 'Codice di invito non valido.');
      const dati = prepara(corpo.dati ?? bachecaVuota(corpo.nome));
      const modifica = nuovoToken(), lettura = nuovoToken();
      await archivio.crea({ id: nuovoToken(9), hashModifica: await impronta(modifica), tokenLettura: lettura, dati, adesso });
      return json({ modifica, lettura, versione: 1, dati: JSON.parse(dati) }, 201);
    }

    // ---------- bacheca esistente: /api/b/<token>[/azione[/n]] ----------
    if (parti[0] === 'api' && parti[1] === 'b' && parti[2]) {
      const token = parti[2];
      if (!TOKEN.test(token)) return errore(404, 'Bacheca non trovata.');
      const azione = parti[3] ?? '';
      let riga = await archivio.perModifica(await impronta(token));
      const permesso = riga ? 'modifica' : 'lettura';
      if (!riga) riga = await archivio.perLettura(token);
      if (!riga) return errore(404, 'Bacheca non trovata. Controlla il link: forse è stato cambiato.');

      if (azione === '' && metodo === 'GET') {
        return json(risposta(riga, permesso, permesso === 'modifica' ? { lettura: riga.token_lettura } : {}));
      }
      if (permesso !== 'modifica') return errore(403, 'Questo è un link di sola lettura.');

      if (azione === '' && metodo === 'PUT') {
        const corpo = await leggiCorpo(request);
        const dati = prepara(corpo.dati);
        const r = await archivio.aggiorna(riga.id, Number(corpo.versione), dati, adesso);
        if (r.ok) return json({ versione: r.versione, aggiornata: adesso });
        if (r.attuale) return json({ errore: 'Qualcun altro ha appena modificato la bacheca.', ...risposta(r.attuale, permesso) }, 409);
        return errore(404, 'Bacheca non trovata.');
      }
      if (azione === 'storico' && metodo === 'GET') {
        if (parti[4]) {
          const dati = await archivio.copia(riga.id, Number(parti[4]));
          return dati ? json({ dati: JSON.parse(dati) }) : errore(404, 'Copia non trovata.');
        }
        return json({ copie: await archivio.storico(riga.id) });
      }
      if (azione === 'rigenera' && metodo === 'POST') {
        const corpo = await leggiCorpo(request);
        if (corpo.quale === 'modifica') {
          const nuovo = nuovoToken();
          await archivio.cambiaModifica(riga.id, await impronta(nuovo));
          return json({ modifica: nuovo });
        }
        if (corpo.quale === 'lettura') {
          const nuovo = nuovoToken();
          await archivio.cambiaLettura(riga.id, nuovo);
          return json({ lettura: nuovo });
        }
        return errore(400, 'Specifica quale link cambiare.');
      }
      return errore(405, 'Operazione non supportata.');
    }

    // ---------- feed calendario: /feed/<token-lettura>.ics ----------
    if (parti[0] === 'feed' && parti[1] && (metodo === 'GET' || metodo === 'HEAD')) {
      const token = parti[1].replace(/\.ics$/, '');
      const riga = TOKEN.test(token) ? await archivio.perLettura(token) : null;
      if (!riga) return new Response('Calendario non trovato.', { status: 404 });
      const bacheca = normalizza(JSON.parse(riga.dati));
      const o = oggi(bacheca.fusoOrario);
      const { testo } = generaICS(bacheca, { da: piuGiorni(o, -7), a: piuMesi(o, 13), link: url.origin + '/v/' + token });
      return new Response(metodo === 'HEAD' ? null : testo, {
        headers: {
          'content-type': 'text/calendar; charset=utf-8',
          'content-disposition': 'inline; filename="nomesmentego.ics"',
          'cache-control': 'public, max-age=900',
        },
      });
    }

    // ---------- manifest per "Aggiungi a schermata Home": riapre proprio questa bacheca ----------
    if (parti[0] === 'manifest' && (parti[1] === 'b' || parti[1] === 'v') && TOKEN.test(parti[2] ?? '')) {
      const nome = (url.searchParams.get('nome') || 'Nomesmentego').slice(0, 40);
      return new Response(JSON.stringify({
        name: nome, short_name: nome.slice(0, 12), lang: 'it',
        start_url: '/' + parti[1] + '/' + parti[2], scope: '/', display: 'standalone',
        background_color: '#eef1ec', theme_color: '#1d3b2f',
        icons: [
          { src: '/icone/icona.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icone/icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone/icona-512.png', sizes: '512x512', type: 'image/png' },
        ],
      }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } });
    }

    if (parti[0] === 'api') return errore(404, 'Indirizzo sconosciuto.');
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Non trovato', { status: 404 });
  } catch (e) {
    if (e.stato) return errore(e.stato, e.message);
    console.error(e);
    return errore(500, 'Errore del server, riprova tra poco.');
  }
}

export default {
  fetch: (request, env) => gestisci(request, env),
};
