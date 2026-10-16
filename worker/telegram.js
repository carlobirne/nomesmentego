// Avvisi su Telegram: client delle API, comandi del bot, tasto "Fatto" e giro di invio periodico.
import { normalizza } from '../web/core/modello.js';
import { tuttiGliAvvisi, segnaFatto, eScadenza, giaFatta, scadenzaAttuale } from '../web/core/motore.js';
import { oggi, fmtAnno, fmtLungo, valida, piuGiorni } from '../web/core/date.js';
import { adessoLocale, filtroDi, passaFiltro, avvisiDaMandare, descriviFiltro } from './giro.js';

const API = 'https://api.telegram.org/bot';

export const htmlTg = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Segreto che Telegram rimanda nel webhook: derivato dal token del bot, così non serve un'altra impostazione. */
export async function segretoWebhook(token) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nomesmentego-webhook:' + token));
  return [...new Uint8Array(h)].slice(0, 24).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Client minimo delle Bot API. `fetchFn` è iniettabile per i test. */
export function creaTelegram(token, fetchFn = (...a) => fetch(...a)) {
  if (!token) return null;
  let nomeBot = null;
  const chiama = async (metodo, corpo) => {
    const r = await fetchFn(API + token + '/' + metodo, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
    });
    let dati = {};
    try { dati = await r.json(); } catch { /* */ }
    if (!dati.ok) throw Object.assign(new Error(dati.description || 'Errore Telegram ' + r.status), { codice: dati.error_code || r.status });
    return dati.result;
  };
  return {
    chiama,
    async nomeBot() {
      if (!nomeBot) nomeBot = (await chiama('getMe', {})).username;
      return nomeBot;
    },
    invia: (chatId, testo, tastiera) => chiama('sendMessage', {
      chat_id: chatId, text: testo, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      ...(tastiera ? { reply_markup: { inline_keyboard: tastiera } } : {}),
    }),
    rispondiTasto: (id, testo) => chiama('answerCallbackQuery', { callback_query_id: id, text: testo }),
    modificaTasti: (chatId, messageId, tastiera) => chiama('editMessageReplyMarkup', {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: tastiera || [] },
    }),
  };
}

/* ---------- messaggi ---------- */


function messaggioAvviso(bacheca, av, iscr) {
  const p = bacheca.promemoria.find((x) => x.id === av.promemoria);
  const gruppo = bacheca.gruppi.find((g) => g.id === p.gruppo);
  let t = '<b>' + htmlTg(av.testo) + '</b>';
  const sotto = [av.testo.includes(p.titolo) ? '' : p.titolo, gruppo?.nome, bacheca.nome].filter(Boolean);
  t += '\n<i>' + htmlTg([...new Set(sotto)].join(' · ')) + '</i>';
  if (eScadenza(p)) t += '\nScadenza: ' + htmlTg(fmtAnno(av.occorrenza.data));
  for (const n of av.occorrenza.note) t += '\n' + htmlTg(n);
  if (p.nota) t += '\n\n' + htmlTg(p.nota.length > 500 ? p.nota.slice(0, 500) + '…' : p.nota);
  const tasti = [];
  // il tasto si porta dietro la data della scadenza: "Fatto" vale per quella
  const datiTasto = 'f|' + iscr.bacheca_id + '|' + p.id + '|' + av.occorrenza.data.replace(/-/g, '');
  if (eScadenza(p) && iscr.modifica && datiTasto.length <= 64) tasti.push({ text: 'Fatto', callback_data: datiTasto });
  if (iscr.origine && iscr.token_lettura) tasti.push({ text: 'Apri la bacheca', url: iscr.origine + '/v/' + iscr.token_lettura });
  return { testo: t, tastiera: tasti.length ? [tasti] : null };
}

/**
 * Giro di invio (Cron Trigger): per ogni chat collegata manda gli avvisi scattati
 * dall'ultimo giro a adesso, nell'ora locale della bacheca.
 */
export async function inviaAvvisi({ archivio, telegram, adesso = new Date() }) {
  if (!telegram) return { inviati: 0 };
  const iscrizioni = await archivio.tutteLeIscrizioniTelegram();
  let inviati = 0;
  for (const iscr of iscrizioni) {
    let bacheca;
    try { bacheca = normalizza(JSON.parse(iscr.dati)); } catch { continue; }
    const { avvisi, ora } = avvisiDaMandare(iscr, bacheca, adesso);
    if (!avvisi.length) continue; // niente da mandare: non serve scrivere nel database
    let ok = true;
    for (const av of avvisi) {
      const { testo, tastiera } = messaggioAvviso(bacheca, av, iscr);
      try {
        await telegram.invia(iscr.chat_id, testo, tastiera);
        inviati++;
      } catch (e) {
        if (e.codice === 403 || e.codice === 400) {
          // bot bloccato, chat cancellata o bot tolto dal gruppo: smetto di scrivere lì
          await archivio.rimuoviChatTelegram(iscr.chat_id);
        } else ok = false; // 429 o errore di rete: riprovo al prossimo giro
        break;
      }
    }
    if (ok) await archivio.segnaInviatoTelegram(iscr.bacheca_id, iscr.chat_id, ora);
  }
  return { inviati };
}

/* ---------- webhook: comandi e tasti ---------- */

const AIUTO = 'Ciao! Sono il bot di <b>Nomesmentego</b>: ti mando qui i promemoria di una bacheca.\n\n' +
  'Per collegarmi apri la bacheca nel browser, vai su <i>Notifiche e condivisione › Telegram</i> e tocca <b>Collega Telegram</b>.\n\n' +
  '/oggi – cosa c\'è da ricordare oggi\n/stop – non ricevere più messaggi qui';

function nomeChat(chat, from) {
  if (chat.type === 'private') return [from?.first_name, from?.last_name].filter(Boolean).join(' ') || from?.username || 'Chat privata';
  return chat.title || 'Gruppo';
}

async function comando(msg, { archivio, telegram }) {
  const chatId = String(msg.chat.id);
  const [cmdGrezzo, ...arg] = String(msg.text || '').trim().split(/\s+/);
  const cmd = cmdGrezzo.split('@')[0].toLowerCase();
  const privata = msg.chat.type === 'private';

  if (cmd === '/start') {
    const codice = arg[0];
    if (!codice) return telegram.invia(chatId, AIUTO);
    const c = /^[A-Za-z0-9_-]{8,64}$/.test(codice) ? await archivio.usaCodiceTelegram(codice, new Date().toISOString()) : null;
    if (!c) return telegram.invia(chatId, 'Questo collegamento non è più valido (dura un\'ora). Torna nella bacheca e tocca di nuovo <b>Collega Telegram</b>.');
    const riga = await archivio.perId(c.bacheca_id);
    if (!riga) return telegram.invia(chatId, 'Bacheca non trovata.');
    const bacheca = normalizza(JSON.parse(riga.dati));
    await archivio.iscriviTelegram({
      bachecaId: c.bacheca_id, chatId, nome: nomeChat(msg.chat, msg.from), modifica: !!c.modifica, origine: c.origine,
      ultimo: adessoLocale(bacheca.fusoOrario, new Date()), adesso: new Date().toISOString(),
    });
    return telegram.invia(chatId, 'Fatto! Da adesso ' + (privata ? 'ti mando' : 'mando in questo gruppo') + ' gli avvisi di <b>' + htmlTg(bacheca.nome) + '</b>, all\'ora impostata per ogni promemoria.\n\n/oggi – cosa c\'è oggi\n/stop – smetti di ricevere');
  }

  if (cmd === '/stop') {
    const n = await archivio.rimuoviChatTelegram(chatId);
    return telegram.invia(chatId, n ? 'Va bene, non mando più avvisi qui. Per ricominciare collega di nuovo Telegram dalla bacheca.' : 'Questa chat non riceve avvisi.');
  }

  if (cmd === '/oggi') {
    const iscr = await archivio.iscrizioniDellaChat(chatId);
    if (!iscr.length) return telegram.invia(chatId, 'Questa chat non è collegata a nessuna bacheca.\n\n' + AIUTO);
    const parti = [];
    for (const i of iscr) {
      const b = normalizza(JSON.parse(i.dati));
      const t = oggi(b.fusoOrario);
      const filtro = filtroDi(i);
      const av = tuttiGliAvvisi(b, t, t).filter((a) => passaFiltro(b.promemoria.find((p) => p.id === a.promemoria), filtro));
      parti.push('<b>' + htmlTg(b.nome) + '</b> · ' + htmlTg(fmtLungo(t)) + '\n' +
        (av.length ? av.map((a) => a.ora + '  ' + htmlTg(a.testo)).join('\n') : 'Niente da ricordare.'));
    }
    return telegram.invia(chatId, parti.join('\n\n'));
  }

  if (privata) return telegram.invia(chatId, AIUTO);
}

async function tastoFatto(q, { archivio, telegram }) {
  const [tipo, bachecaId, pid, quando] = String(q.data || '').split('|');
  const chatId = String(q.message?.chat?.id ?? '');
  if (tipo !== 'f' || !bachecaId || !pid) return telegram.rispondiTasto(q.id, 'Tasto non valido.');
  const iscr = (await archivio.iscrizioniDellaChat(chatId)).find((i) => i.bacheca_id === bachecaId);
  if (!iscr || !iscr.modifica) return telegram.rispondiTasto(q.id, 'Da qui non si può modificare questa bacheca.');
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const riga = await archivio.perId(bachecaId);
    if (!riga) return telegram.rispondiTasto(q.id, 'Bacheca non trovata.');
    const b = normalizza(JSON.parse(riga.dati));
    const i = b.promemoria.findIndex((p) => p.id === pid);
    if (i < 0 || !eScadenza(b.promemoria[i])) return telegram.rispondiTasto(q.id, 'Promemoria non trovato.');
    const p = b.promemoria[i];
    const t = oggi(b.fusoOrario);
    // tasti vecchi senza data: vale la scadenza in corso, se è vicina (un secondo tocco non segna quella dell'anno dopo)
    const attuale = scadenzaAttuale(p, t)?.data;
    const data = /^\d{8}$/.test(quando || '') ? quando.slice(0, 4) + '-' + quando.slice(4, 6) + '-' + quando.slice(6)
      : attuale && attuale <= piuGiorni(t, 60) ? attuale : p.scadenza.fattoFino;
    if (!valida(data)) return telegram.rispondiTasto(q.id, 'Promemoria non trovato.');
    if (giaFatta(p, data)) return telegram.rispondiTasto(q.id, 'Era già segnato come fatto.');
    b.promemoria[i] = segnaFatto(p, data);
    const poi = scadenzaAttuale(b.promemoria[i], t);
    const prossima = poi ? poi.data : null;
    const r = await archivio.aggiorna(bachecaId, riga.versione, JSON.stringify(b), new Date().toISOString());
    if (!r.ok) continue; // qualcuno ha salvato nello stesso istante: riprovo sui dati nuovi
    const chi = q.from?.first_name || 'qualcuno';
    const testo = prossima ? 'Segnato come fatto. Prossima scadenza: ' + fmtAnno(prossima) + '.' : 'Segnato come fatto.';
    await telegram.rispondiTasto(q.id, testo);
    if (q.message) {
      await telegram.modificaTasti(chatId, q.message.message_id, null).catch(() => {});
      await telegram.invia(chatId, '<b>' + htmlTg(p.titolo) + '</b>: fatto (' + htmlTg(chi) + '). ' + htmlTg(prossima ? 'Prossima scadenza: ' + fmtAnno(prossima) + '.' : '')).catch(() => {});
    }
    return;
  }
  return telegram.rispondiTasto(q.id, 'La bacheca è cambiata nel frattempo: riprova.');
}

/** Gestisce un aggiornamento in arrivo da Telegram (webhook). */
export async function gestisciAggiornamento(upd, dip) {
  if (upd.message?.text?.startsWith('/')) return comando(upd.message, dip);
  if (upd.message?.chat?.type === 'private' && upd.message.text) return comando({ ...upd.message, text: '/aiuto' }, dip);
  if (upd.callback_query) return tastoFatto(upd.callback_query, dip);
  // bot tolto da un gruppo
  if (upd.my_chat_member && ['left', 'kicked'].includes(upd.my_chat_member.new_chat_member?.status)) {
    return dip.archivio.rimuoviChatTelegram(String(upd.my_chat_member.chat.id));
  }
}

/** Riassunto per la pagina della bacheca. */
export const descrizioneIscrizione = (i, bacheca) => ({
  chat: i.chat_id, nome: i.nome, modifica: !!i.modifica, creata: i.creata,
  filtro: descriviFiltro(i, bacheca),
});

