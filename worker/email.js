// Avvisi via email: un elenco di indirizzi per bacheca, con oggetto e testo personalizzabili.
// Ogni indirizzo deve confermare con un clic prima di ricevere (così l'app non può servire a mandare spam)
// e ogni email ha il link per disiscriversi.
// Invio tramite Brevo (BREVO_API_KEY) oppure Resend (RESEND_API_KEY), con mittente EMAIL_MITTENTE.
import { normalizza } from '../web/core/modello.js';
import { nomiVoci, descriviQuando } from '../web/core/motore.js';
import { fmtLungo, relativo, parti as partiData } from '../web/core/date.js';
import { json, errore, leggiCorpo, nuovoToken } from './http.js';
import { adessoLocale, avvisiDaMandare, pulisciFiltro, descriviFiltro } from './giro.js';

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const MAX_DESTINATARI = 20;
export const MODELLO_PREDEFINITO = {
  oggetto: '{testo}',
  corpo: 'Ciao,\n\nti ricordo: {testo}\n\n{promemoria} · {gruppo}\n{data} ({quando})\n\n{nota}',
};
export const SEGNAPOSTO = ['testo', 'promemoria', 'voci', 'gruppo', 'data', 'quando', 'ripetizione', 'nota', 'bacheca'];

const htmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Client di invio. `fetchFn` iniettabile per i test. Restituisce null se non è configurato. */
export function creaPosta(env, fetchFn = (...a) => fetch(...a)) {
  const mittente = env.EMAIL_MITTENTE, nome = env.EMAIL_NOME || 'Promemoria di famiglia';
  if (!mittente) return null;
  const controlla = async (r) => {
    if (r.ok) return;
    let msg = '';
    try { msg = JSON.stringify(await r.json()); } catch { /* */ }
    throw Object.assign(new Error('Invio email non riuscito (' + r.status + ') ' + msg), { codice: r.status });
  };
  if (env.BREVO_API_KEY) {
    return {
      servizio: 'Brevo',
      invia: async ({ a, oggetto, testo, html, disiscrivi }) => controlla(await fetchFn('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: mittente, name: nome }, to: [{ email: a }], subject: oggetto, textContent: testo, htmlContent: html,
          ...(disiscrivi ? { headers: { 'List-Unsubscribe': '<' + disiscrivi + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
        }),
      })),
    };
  }
  if (env.RESEND_API_KEY) {
    return {
      servizio: 'Resend',
      invia: async ({ a, oggetto, testo, html, disiscrivi }) => controlla(await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: nome + ' <' + mittente + '>', to: [a], subject: oggetto, text: testo, html,
          ...(disiscrivi ? { headers: { 'List-Unsubscribe': '<' + disiscrivi + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
        }),
      })),
    };
  }
  return null;
}

/* ---------- modello del messaggio ---------- */

export async function modelloDi(archivio, bachecaId) {
  const v = await archivio.impostazione('email-modello:' + bachecaId);
  try { return { ...MODELLO_PREDEFINITO, ...(v ? JSON.parse(v) : {}) }; } catch { return { ...MODELLO_PREDEFINITO }; }
}

/** Valori dei segnaposto per un avviso. */
export function valori(bacheca, av) {
  const p = bacheca.promemoria.find((x) => x.id === av.promemoria);
  const anno = partiData(av.occorrenza.data)[0];
  return {
    testo: av.testo, promemoria: p.titolo, voci: nomiVoci(p, av.occorrenza.voci).join(', '),
    gruppo: bacheca.gruppi.find((g) => g.id === p.gruppo)?.nome || '', data: fmtLungo(av.occorrenza.data) + ' ' + anno,
    quando: relativo(av.data, av.occorrenza.data), ripetizione: descriviQuando(p), nota: [...av.occorrenza.note, p.nota].filter(Boolean).join('\n'),
    bacheca: bacheca.nome,
  };
}

const riempi = (modello, v) => modello.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const pulisci = (s) => s.split('\n').map((r) => r.replace(/\s+·\s*$/, '').replace(/^\s*·\s+/, '').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/** Compone oggetto, testo e HTML. Il piede (link alla bacheca e per disiscriversi) c'è sempre. */
export function componi(modello, v, { link, disiscrivi }) {
  const oggetto = pulisci(riempi(modello.oggetto || MODELLO_PREDEFINITO.oggetto, v)).replace(/\s+/g, ' ').slice(0, 200) || v.testo;
  const corpo = pulisci(riempi(modello.corpo || MODELLO_PREDEFINITO.corpo, v));
  const piede = [link ? 'Apri la bacheca: ' + link : '', disiscrivi ? 'Non vuoi più ricevere queste email? ' + disiscrivi : ''].filter(Boolean);
  const testo = corpo + '\n\n--\n' + v.bacheca + '\n' + piede.join('\n');
  const html = '<!doctype html><html><body style="margin:0;background:#efe6d2;padding:24px 12px;font-family:Atkinson Hyperlegible,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111">' +
    '<div style="max-width:560px;margin:0 auto;background:#fbf6ea;border:2px solid #111111;border-radius:18px 6px 22px 8px;padding:22px">' +
    '<div style="font-size:17px;line-height:1.5">' + htmlEsc(corpo).replace(/\n/g, '<br>') + '</div>' +
    (link ? '<p style="margin:22px 0 0"><a href="' + htmlEsc(link) + '" style="display:inline-block;background:#2e5fa8;color:#fbf6ea;text-decoration:none;font-weight:700;padding:10px 18px;border:2px solid #111111;border-radius:999px">Apri la bacheca</a></p>' : '') +
    '</div><p style="max-width:560px;margin:14px auto 0;font-size:13px;color:#5b5144">' + htmlEsc(v.bacheca) +
    (disiscrivi ? ' · <a href="' + htmlEsc(disiscrivi) + '" style="color:#5b5144">non ricevere più queste email</a>' : '') + '</p></body></html>';
  return { oggetto, testo, html };
}

const esempio = (bacheca) => ({
  testo: 'Metti fuori stasera: Umido, Plastica', promemoria: 'Raccolta rifiuti', voci: 'Umido, Plastica', gruppo: 'Casa',
  data: 'martedì 20 ott 2026', quando: 'domani', ripetizione: 'A settimane alterne', nota: 'Sacchetti semitrasparenti.', bacheca: bacheca.nome,
});

/* ---------- giro di invio ---------- */

export async function inviaEmail({ archivio, posta, adesso = new Date() }) {
  if (!posta) return { inviati: 0 };
  const righe = await archivio.notificheAttive('email');
  const modelli = new Map();
  let inviati = 0;
  for (const riga of righe) {
    let bacheca;
    try { bacheca = normalizza(JSON.parse(riga.dati)); } catch { continue; }
    const { avvisi, ora } = avvisiDaMandare(riga, bacheca, adesso);
    if (!avvisi.length) continue;
    if (!modelli.has(riga.bacheca_id)) modelli.set(riga.bacheca_id, await modelloDi(archivio, riga.bacheca_id));
    let ok = true;
    for (const av of avvisi) {
      const m = componi(modelli.get(riga.bacheca_id), valori(bacheca, av), {
        link: riga.origine + '/v/' + riga.token_lettura + '#oggi', disiscrivi: riga.origine + '/email/stop/' + riga.token,
      });
      try {
        await posta.invia({ a: riga.destinazione, ...m, disiscrivi: riga.origine + '/email/stop/' + riga.token });
        inviati++;
      } catch { ok = false; break; } // riprovo al prossimo giro
    }
    if (ok) await archivio.aggiornaNotifica(riga.id, { ultimo: ora });
  }
  return { inviati };
}

/* ---------- API per la bacheca: /api/b/<token>/email[/modello|/prova|/<id>[/conferma]] (solo chi modifica) ---------- */

async function mandaConferma(posta, riga, bacheca, origine) {
  const link = origine + '/email/conferma/' + riga.token;
  const testo = 'Ciao,\n\nqualcuno vuole mandarti a questo indirizzo i promemoria della bacheca "' + bacheca.nome + '" (spazzatura, scadenze, appuntamenti…).\n\n' +
    'Per riceverli conferma qui:\n' + link + '\n\nSe non sai di cosa si tratta ignora questa email: non riceverai niente.';
  const html = '<!doctype html><html><body style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#efe6d2;padding:24px 12px;color:#111111">' +
    '<div style="max-width:520px;margin:0 auto;background:#fbf6ea;border:2px solid #111111;border-radius:18px;padding:22px;font-size:17px;line-height:1.5">' +
    '<p>Ciao,</p><p>qualcuno vuole mandarti a questo indirizzo i promemoria della bacheca <b>' + htmlEsc(bacheca.nome) + '</b>.</p>' +
    '<p><a href="' + htmlEsc(link) + '" style="display:inline-block;background:#2e5fa8;color:#fbf6ea;text-decoration:none;font-weight:700;padding:10px 18px;border:2px solid #111111;border-radius:999px">Sì, voglio ricevere i promemoria</a></p>' +
    '<p style="font-size:14px;color:#5b5144">Se non sai di cosa si tratta ignora questa email: non riceverai niente.</p></div></body></html>';
  await posta.invia({ a: riga.destinazione, oggetto: 'Conferma: promemoria di "' + bacheca.nome + '"', testo, html });
}

const descrivi = (r, bacheca) => ({ id: r.id, indirizzo: r.destinazione, nome: r.nome, stato: r.stato, filtro: descriviFiltro(r, bacheca), creata: r.creata });

export async function apiEmail({ request, url, metodo, sotto, azione2, riga, permesso, archivio, posta }) {
  if (permesso !== 'modifica') return errore(403, 'Questo è un link di sola lettura.');
  const bacheca = normalizza(JSON.parse(riga.dati));
  if (sotto === '' && metodo === 'GET') {
    return json({
      attiva: !!posta, servizio: posta?.servizio ?? null, modello: await modelloDi(archivio, riga.id), segnaposto: SEGNAPOSTO,
      destinatari: (await archivio.notifiche(riga.id, 'email')).map((r) => descrivi(r, bacheca)),
    });
  }
  if (sotto === 'modello' && metodo === 'PUT') {
    const corpo = await leggiCorpo(request);
    const m = { oggetto: String(corpo.oggetto ?? '').slice(0, 200), corpo: String(corpo.corpo ?? '').slice(0, 4000) };
    await archivio.salvaImpostazione('email-modello:' + riga.id, JSON.stringify(m));
    return json({ modello: { ...MODELLO_PREDEFINITO, ...Object.fromEntries(Object.entries(m).filter(([, v]) => v)) } });
  }
  if (sotto === 'anteprima' && metodo === 'POST') {
    const corpo = await leggiCorpo(request);
    return json(componi({ oggetto: corpo.oggetto, corpo: corpo.corpo }, esempio(bacheca), { link: url.origin + '/v/…', disiscrivi: url.origin + '/email/stop/…' }));
  }
  if (!posta) return errore(503, 'L\'invio di email non è configurato su questo server.');
  if (sotto === '' && metodo === 'POST') {
    const corpo = await leggiCorpo(request);
    const indirizzo = String(corpo.indirizzo || '').trim().toLowerCase();
    if (!EMAIL.test(indirizzo) || indirizzo.length > 120) return errore(400, 'Indirizzo email non valido.');
    const esistenti = await archivio.notifiche(riga.id, 'email');
    if (!esistenti.some((r) => r.destinazione === indirizzo) && esistenti.length >= MAX_DESTINATARI) return errore(400, 'Al massimo ' + MAX_DESTINATARI + ' indirizzi per bacheca.');
    const r = await archivio.salvaNotifica({
      id: nuovoToken(9), bachecaId: riga.id, canale: 'email', destinazione: indirizzo, nome: String(corpo.nome || '').slice(0, 60) || indirizzo,
      stato: 'da-confermare', token: nuovoToken(), origine: url.origin, ultimo: adessoLocale(bacheca.fusoOrario), creata: new Date().toISOString(),
    });
    // gruppi da ricevere scelti già all'aggiunta (assente o null = tutto)
    if ('filtro' in corpo) {
      const filtro = pulisciFiltro(corpo.filtro, bacheca);
      r.filtro = filtro ? JSON.stringify(filtro) : null;
      await archivio.aggiornaNotifica(r.id, { filtro: r.filtro });
    }
    if (r.stato !== 'attivo') {
      try { await mandaConferma(posta, r, bacheca, url.origin); } catch (e) {
        console.error('email di conferma', e);
        return json({ ...descrivi(r, bacheca), errore: 'Indirizzo salvato, ma l\'email di conferma non è partita: riprova più tardi con "Rimanda la conferma".' }, 502);
      }
    }
    return json(descrivi(r, bacheca), 201);
  }
  if (sotto === 'prova' && metodo === 'POST') {
    const attivi = (await archivio.notifiche(riga.id, 'email')).filter((r) => r.stato === 'attivo');
    const modello = await modelloDi(archivio, riga.id);
    let ok = 0;
    for (const r of attivi) {
      const disiscrivi = url.origin + '/email/stop/' + r.token;
      const m = componi(modello, esempio(bacheca), { link: url.origin + '/v/' + (riga.token_lettura || ''), disiscrivi });
      try { await posta.invia({ a: r.destinazione, ...m, oggetto: '[Prova] ' + m.oggetto, disiscrivi }); ok++; } catch { /* */ }
    }
    return json({ inviati: ok, totale: attivi.length });
  }
  const n = await archivio.notifica(sotto);
  if (!n || n.bacheca_id !== riga.id || n.canale !== 'email') return errore(404, 'Indirizzo non trovato.');
  if (azione2 === 'conferma' && metodo === 'POST') {
    if (n.stato === 'attivo') return json({ ok: true });
    try { await mandaConferma(posta, n, bacheca, url.origin); } catch { return errore(502, 'L\'email di conferma non è partita: riprova più tardi.'); }
    return json({ ok: true });
  }
  if (metodo === 'PUT') {
    const corpo = await leggiCorpo(request);
    const filtro = pulisciFiltro(corpo.filtro, bacheca);
    await archivio.aggiornaNotifica(n.id, { filtro: filtro ? JSON.stringify(filtro) : null });
    return json({ filtro });
  }
  if (metodo === 'DELETE') { await archivio.rimuoviNotifica(n.id); return json({ ok: true }); }
  return errore(405, 'Operazione non supportata.');
}

/* ---------- pagine pubbliche: /email/conferma/<token> e /email/stop/<token> ---------- */

function pagina(titolo, testo, bottone) {
  return new Response('<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>' + htmlEsc(titolo) + '</title></head>' +
    '<body style="margin:0;background:#efe6d2;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111;padding:32px 16px">' +
    '<div style="max-width:480px;margin:0 auto;background:#fbf6ea;border:2px solid #111111;border-radius:18px 6px 22px 8px;padding:24px;font-size:18px;line-height:1.5">' +
    '<h1 style="font-size:26px;margin:0 0 12px">' + htmlEsc(titolo) + '</h1><p>' + testo + '</p>' +
    (bottone ? '<form method="post"><button style="font:inherit;font-weight:700;background:#2e5fa8;color:#fbf6ea;border:2px solid #111111;border-radius:999px;padding:12px 22px;cursor:pointer">' + htmlEsc(bottone) + '</button></form>' : '') +
    '</div></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

/** Le email vengono a volte "cliccate" dai filtri antispam: per confermare o disiscriversi serve premere un pulsante (POST). */
export async function paginaEmail({ metodo, tipo, token, archivio, adesso = new Date() }) {
  const r = /^[A-Za-z0-9_-]{20,64}$/.test(token || '') ? await archivio.notificaPerToken(token) : null;
  if (!r || r.canale !== 'email') return pagina('Link non valido', 'Questo indirizzo non è (più) collegato a nessuna bacheca.');
  const nome = htmlEsc(normalizza(JSON.parse(r.dati)).nome);
  if (tipo === 'conferma') {
    if (r.stato === 'attivo') return pagina('Già confermato', 'Ricevi già i promemoria di <b>' + nome + '</b> a ' + htmlEsc(r.destinazione) + '.');
    if (metodo !== 'POST') return pagina('Conferma', 'Vuoi ricevere a <b>' + htmlEsc(r.destinazione) + '</b> i promemoria di <b>' + nome + '</b>?', 'Sì, voglio riceverli');
    const fuso = normalizza(JSON.parse(r.dati)).fusoOrario;
    await archivio.aggiornaNotifica(r.id, { stato: 'attivo', ultimo: adessoLocale(fuso, adesso) });
    return pagina('Fatto!', 'Da adesso ricevi i promemoria di <b>' + nome + '</b> a ' + htmlEsc(r.destinazione) + '. In ogni email c\'è il link per smettere.');
  }
  if (metodo !== 'POST') return pagina('Non ricevere più', 'Vuoi smettere di ricevere a <b>' + htmlEsc(r.destinazione) + '</b> i promemoria di <b>' + nome + '</b>?', 'Sì, non mandarmeli più');
  await archivio.rimuoviNotifica(r.id);
  return pagina('Fatto', 'Non riceverai più i promemoria di <b>' + nome + '</b>.');
}
