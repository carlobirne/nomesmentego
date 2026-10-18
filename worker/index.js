// Cloudflare Worker: API delle bacheche, feed calendario e manifest dell'app.
// Tutto il resto (la web app in web/) lo serve direttamente Cloudflare come file statici.
import { ArchivioD1 } from './archivio.js';
import { json, errore, leggiCorpo, nuovoToken, impronta } from './http.js';
export { nuovoToken, impronta };
import { creaTelegram, segretoWebhook, gestisciAggiornamento, inviaAvvisi, descrizioneIscrizione } from './telegram.js';
import { apiPush, inviaNotifiche } from './push.js';
import { creaPosta, apiEmail, paginaEmail, inviaEmail } from './email.js';
import { normalizza, bachecaVuota } from '../web/core/modello.js';
import { generaICS } from '../web/core/ics.js';
import { oggi, piuGiorni, piuMesi } from '../web/core/date.js';

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

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
 * Gestisce una richiesta. `archivio`, `telegram`, `posta` e `fetchPush` sono iniettabili per i test.
 */
export async function gestisci(request, env, archivio = new ArchivioD1(env.DB), telegram = creaTelegram(env.TELEGRAM_BOT_TOKEN),
  { posta = creaPosta(env), fetchPush = (...a) => fetch(...a) } = {}) {
  const url = new URL(request.url);
  const parti = url.pathname.split('/').filter(Boolean);
  const metodo = request.method;
  const adesso = new Date().toISOString();

  try {
    // ---------- configurazione pubblica ----------
    if (url.pathname === '/api/config' && metodo === 'GET') {
      return json({ serveCodice: !!env.CODICE_INVITO, telegram: !!telegram, email: !!posta, notifiche: true });
    }

    // ---------- pagine per confermare o togliere un indirizzo email ----------
    if (parti[0] === 'email' && (parti[1] === 'conferma' || parti[1] === 'stop') && (metodo === 'GET' || metodo === 'POST')) {
      return paginaEmail({ metodo, tipo: parti[1], token: parti[2], archivio });
    }

    // ---------- webhook del bot Telegram ----------
    if (url.pathname === '/telegram/webhook' && metodo === 'POST') {
      if (!telegram) return new Response('Telegram non configurato', { status: 404 });
      if (request.headers.get('x-telegram-bot-api-secret-token') !== await segretoWebhook(env.TELEGRAM_BOT_TOKEN)) return new Response('No', { status: 401 });
      try {
        await gestisciAggiornamento(await request.json(), { archivio, telegram });
      } catch (e) {
        console.error('telegram', e); // rispondo comunque 200, altrimenti Telegram ripete lo stesso messaggio all'infinito
      }
      return new Response('ok');
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
      if (permesso === 'lettura') riga = { ...riga, token_lettura: token };

      // ---------- notifiche dell'app ed email ----------
      if (azione === 'push') return apiPush({ request, url, metodo, sotto: parti[4] ?? '', riga, permesso, archivio, fetchFn: fetchPush });
      if (azione === 'email') return apiEmail({ request, url, metodo, sotto: parti[4] ?? '', azione2: parti[5], riga, permesso, archivio, posta });

      if (azione === '' && metodo === 'GET') {
        return json(risposta(riga, permesso, permesso === 'modifica' ? { lettura: riga.token_lettura } : {}));
      }
      // ---------- Telegram: /api/b/<token>/telegram[/collega|/prova|/<chat>] ----------
      if (azione === 'telegram') {
        const sotto = parti[4] ?? '';
        if (!telegram) return sotto === '' && metodo === 'GET' ? json({ attivo: false, iscrizioni: [] }) : errore(503, 'Telegram non è configurato su questo server.');
        if (sotto === 'collega' && metodo === 'POST') {
          const codice = nuovoToken(12);
          await archivio.creaCodiceTelegram({
            codice, bachecaId: riga.id, modifica: permesso === 'modifica', origine: url.origin,
            scade: new Date(Date.now() + 3600_000).toISOString(),
          });
          const bot = await telegram.nomeBot();
          return json({ bot, link: 'https://t.me/' + bot + '?start=' + codice, linkGruppo: 'https://t.me/' + bot + '?startgroup=' + codice });
        }
        if (permesso !== 'modifica') {
          return sotto === '' && metodo === 'GET' ? json({ attivo: true, iscrizioni: [] }) : errore(403, 'Questo è un link di sola lettura.');
        }
        const bacheca = normalizza(JSON.parse(riga.dati));
        if (sotto === '' && metodo === 'GET') {
          const iscr = await archivio.iscrizioniTelegram(riga.id);
          return json({ attivo: true, bot: await telegram.nomeBot().catch(() => null), iscrizioni: iscr.map((i) => descrizioneIscrizione(i, bacheca)) });
        }
        if (sotto === 'prova' && metodo === 'POST') {
          const iscr = await archivio.iscrizioniTelegram(riga.id);
          let ok = 0;
          for (const i of iscr) {
            try {
              await telegram.invia(i.chat_id, 'Messaggio di prova da <b>' + bacheca.nome.replace(/[<>&]/g, '') + '</b>: gli avvisi arriveranno qui.');
              ok++;
            } catch { /* chat non raggiungibile */ }
          }
          return json({ inviati: ok, totale: iscr.length });
        }
        if (sotto && metodo === 'PUT') {
          const corpo = await leggiCorpo(request);
          const filtro = Array.isArray(corpo.filtro) ? [...new Set(corpo.filtro.map(String))].filter((g) => g === '' || bacheca.gruppi.some((x) => x.id === g)) : null;
          return (await archivio.filtroTelegram(riga.id, sotto, filtro)) ? json({ filtro }) : errore(404, 'Chat non trovata.');
        }
        if (sotto && metodo === 'DELETE') {
          return (await archivio.rimuoviTelegram(riga.id, sotto)) ? json({ ok: true }) : errore(404, 'Chat non trovata.');
        }
        return errore(405, 'Operazione non supportata.');
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
        background_color: '#efe6d2', theme_color: '#efe6d2',
        // "?v=2": icone cambiate (prima c'era l'occhio). Cambiando l'indirizzo il telefono si accorge
        // che deve aggiornare l'icona e la schermata di avvio dell'app già installata.
        icons: [
          { src: '/icone/icona-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icone/icona-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icone/icona-maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icone/creatura.svg?v=2', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
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
  // Cron Trigger (ogni 5 minuti, vedi wrangler.jsonc): manda gli avvisi su Telegram, notifiche dell'app ed email
  scheduled: (controller, env, ctx) => {
    const archivio = new ArchivioD1(env.DB), adesso = new Date(controller.scheduledTime);
    const giro = (nome, p) => p.then((r) => { if (r.inviati) console.log(nome + ': inviati', r.inviati); }).catch((e) => console.error(nome, e));
    ctx.waitUntil(Promise.all([
      giro('telegram', inviaAvvisi({ archivio, telegram: creaTelegram(env.TELEGRAM_BOT_TOKEN), adesso })),
      giro('notifiche', inviaNotifiche({ archivio, adesso })),
      giro('email', inviaEmail({ archivio, posta: creaPosta(env), adesso })),
    ]));
  },
};
