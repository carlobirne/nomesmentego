import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestisci } from '../worker/index.js';
import { ArchivioMemoria } from '../worker/archivio.js';
import { inviaAvvisi, segretoWebhook, creaTelegram } from '../worker/telegram.js';

const TOKEN_BOT = '123:prova';

function telegramFinto() {
  const t = {
    inviati: [], risposte: [], bloccate: new Set(),
    async nomeBot() { return 'nms_bot'; },
    async invia(chat, testo, tastiera) {
      if (t.bloccate.has(chat)) throw Object.assign(new Error('Forbidden: bot was blocked by the user'), { codice: 403 });
      t.inviati.push({ chat, testo, tastiera });
    },
    async rispondiTasto(id, testo) { t.risposte.push(testo); },
    async modificaTasti() {},
  };
  return t;
}

async function ambiente() {
  const archivio = new ArchivioMemoria();
  const tg = telegramFinto();
  const env = { TELEGRAM_BOT_TOKEN: TOKEN_BOT };
  const segreto = await segretoWebhook(TOKEN_BOT);
  const chiama = async (metodo, percorso, corpo, headers = {}) => {
    const r = await gestisci(new Request('https://app.test' + percorso, {
      method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }), env, archivio, tg);
    const tipo = r.headers.get('content-type') || '';
    return { stato: r.status, corpo: tipo.includes('json') ? await r.json() : await r.text() };
  };
  const webhook = (upd, s = segreto) => chiama('POST', '/telegram/webhook', upd, { 'x-telegram-bot-api-secret-token': s });
  const messaggio = (chatId, testo, tipo = 'private') => webhook({ message: { message_id: 1, text: testo, chat: { id: chatId, type: tipo, title: 'Famiglia' }, from: { first_name: 'Carlo' } } });
  const c = await chiama('POST', '/api/bacheche', { dati: { versione: 2, nome: 'Casa', gruppi: [{ id: 'passat', nome: 'Passat', icona: 'auto' }, { id: 'puma', nome: 'Puma', icona: 'auto' }], promemoria: [
    { id: 'med', titolo: 'Medicina', quando: { tipo: 'giornaliero', inizio: '2020-01-01' }, avvisi: [{ prima: 0, unita: 'giorni', ora: '08:00', testo: 'Prendi la pastiglia' }] },
    { id: 'bollo', titolo: 'Bollo Passat', gruppo: 'passat', quando: { tipo: 'scadenza', scadenza: '2030-01-31', ripeti: { ogni: 1, unita: 'anni', da: 'scadenza' } },
      avvisi: [{ prima: 30, unita: 'giorni', ora: '08:00' }] },
    { id: 'rev', titolo: 'Revisione Puma', gruppo: 'puma', quando: { tipo: 'scadenza', scadenza: '2030-01-31' }, avvisi: [{ prima: 30, unita: 'giorni', ora: '08:00' }] },
  ] } });
  return { archivio, tg, chiama, webhook, messaggio, modifica: c.corpo.modifica, lettura: c.corpo.lettura };
}

const codiceDa = (link) => link.split('=')[1];

test('collegare una chat con il codice usa-e-getta, anche da un gruppo con il link di sola lettura', async () => {
  const a = await ambiente();
  assert.equal((await a.chiama('GET', '/api/config')).corpo.telegram, true);
  const col = await a.chiama('POST', '/api/b/' + a.modifica + '/telegram/collega');
  assert.match(col.corpo.link, /^https:\/\/t\.me\/nms_bot\?start=[A-Za-z0-9_-]+$/);
  assert.match(col.corpo.linkGruppo, /\?startgroup=/);

  assert.equal((await a.webhook({ message: { text: '/start x', chat: { id: 1, type: 'private' } } }, 'sbagliato')).stato, 401);

  await a.messaggio(111, '/start ' + codiceDa(col.corpo.link));
  assert.match(a.tg.inviati.at(-1).testo, /^Fatto! Da adesso ti mando gli avvisi di <b>Casa<\/b>/);
  await a.messaggio(999, '/start ' + codiceDa(col.corpo.link)); // il codice vale una volta sola
  assert.match(a.tg.inviati.at(-1).testo, /non è più valido/);

  const colL = await a.chiama('POST', '/api/b/' + a.lettura + '/telegram/collega');
  await a.messaggio(-222, '/start@nms_bot ' + codiceDa(colL.corpo.link), 'group');
  assert.match(a.tg.inviati.at(-1).testo, /mando in questo gruppo/);

  const lista = await a.chiama('GET', '/api/b/' + a.modifica + '/telegram');
  assert.deepEqual(lista.corpo.iscrizioni.map((i) => [i.chat, i.nome, i.modifica]), [['111', 'Carlo', true], ['-222', 'Famiglia', false]]);
  // la sola lettura non vede né gestisce le chat
  assert.deepEqual((await a.chiama('GET', '/api/b/' + a.lettura + '/telegram')).corpo.iscrizioni, []);
  assert.equal((await a.chiama('DELETE', '/api/b/' + a.lettura + '/telegram/111')).stato, 403);
});

test('giro di invio: ora locale, filtro per gruppi, niente doppioni, recupero limitato', async () => {
  const a = await ambiente();
  for (const [chat, tok] of [[111, a.modifica], [-222, a.lettura]]) {
    const col = await a.chiama('POST', '/api/b/' + tok + '/telegram/collega');
    await a.messaggio(chat, '/start ' + codiceDa(col.corpo.link), chat > 0 ? 'private' : 'group');
  }
  // il gruppo riceve solo la Passat
  assert.deepEqual((await a.chiama('PUT', '/api/b/' + a.modifica + '/telegram/-222', { filtro: ['passat', 'inesistente'] })).corpo.filtro, ['passat']);
  const bid = a.archivio.telegram.iscrizioni[0].bacheca_id;
  for (const chat of ['111', '-222']) await a.archivio.segnaInviatoTelegram(bid, chat, '2030-01-01T07:55');
  a.tg.inviati = [];

  // 1 gennaio 2030, 07:10 UTC = 08:10 a Roma: medicina (tutti tranne il gruppo) + bollo e revisione a 30 giorni
  let r = await inviaAvvisi({ archivio: a.archivio, telegram: a.tg, adesso: new Date('2030-01-01T07:10:00Z') });
  const perChat = (c) => a.tg.inviati.filter((m) => m.chat === c).map((m) => m.testo.split('\n')[0]);
  assert.deepEqual(perChat('111'), ['<b>Prendi la pastiglia</b>', '<b>Bollo Passat (tra 30 giorni, 31 gen)</b>', '<b>Revisione Puma (tra 30 giorni, 31 gen)</b>']);
  assert.deepEqual(perChat('-222'), ['<b>Bollo Passat (tra 30 giorni, 31 gen)</b>']);
  assert.equal(r.inviati, 4);
  // tasto Fatto solo per chi può modificare, link sempre alla sola lettura
  const bollo111 = a.tg.inviati.find((m) => m.chat === '111' && m.testo.includes('Bollo'));
  assert.deepEqual(bollo111.tastiera[0].map((t) => t.text), ['Fatto', 'Apri la bacheca']);
  assert.equal(bollo111.tastiera[0][1].url, 'https://app.test/v/' + a.lettura);
  assert.deepEqual(a.tg.inviati.find((m) => m.chat === '-222').tastiera[0].map((t) => t.text), ['Apri la bacheca']);

  // un secondo giro poco dopo non rimanda niente
  a.tg.inviati = [];
  r = await inviaAvvisi({ archivio: a.archivio, telegram: a.tg, adesso: new Date('2030-01-01T07:15:00Z') });
  assert.equal(r.inviati, 0);

  // dopo una lunga interruzione recupera solo l'ultimo giorno (una medicina, non dieci)
  r = await inviaAvvisi({ archivio: a.archivio, telegram: a.tg, adesso: new Date('2030-01-11T07:10:00Z') });
  assert.equal(perChat('111').filter((t) => t.includes('pastiglia')).length, 1);

  // chat che ha bloccato il bot: viene tolta
  a.tg.bloccate.add('111');
  await inviaAvvisi({ archivio: a.archivio, telegram: a.tg, adesso: new Date('2030-01-12T07:10:00Z') });
  assert.deepEqual(a.archivio.telegram.iscrizioni.map((i) => i.chat_id), ['-222']);
});

test('tasto "Fatto" da Telegram, /oggi e /stop', async () => {
  const a = await ambiente();
  for (const [chat, tok] of [[111, a.modifica], [-222, a.lettura]]) {
    const col = await a.chiama('POST', '/api/b/' + tok + '/telegram/collega');
    await a.messaggio(chat, '/start ' + codiceDa(col.corpo.link), chat > 0 ? 'private' : 'group');
  }
  const bid = a.archivio.telegram.iscrizioni[0].bacheca_id;
  const tasto = (chat) => a.webhook({ callback_query: { id: 'q' + chat, data: 'f|' + bid + '|bollo', from: { first_name: 'Carlo' }, message: { message_id: 5, chat: { id: chat } } } });

  await tasto(-222);
  assert.match(a.tg.risposte.at(-1), /non si può modificare/);
  await tasto(111);
  assert.match(a.tg.risposte.at(-1), /^Segnato come fatto\. Prossima scadenza: 31 gen 2031\.$/);
  const b = (await a.chiama('GET', '/api/b/' + a.modifica)).corpo;
  assert.equal(b.dati.promemoria.find((p) => p.id === 'bollo').quando.scadenza, '2031-01-31');
  assert.equal(b.versione, 2);
  await tasto(111);
  assert.match(a.tg.risposte.at(-1), /già segnato/);

  await a.messaggio(111, '/oggi');
  assert.match(a.tg.inviati.at(-1).testo, /^<b>Casa<\/b> · .*\n\d\d:\d\d  Prendi la pastiglia/);
  await a.messaggio(111, '/stop');
  assert.match(a.tg.inviati.at(-1).testo, /non mando più avvisi/);
  assert.deepEqual(a.archivio.telegram.iscrizioni.map((i) => i.chat_id), ['-222']);
  await a.messaggio(111, 'ciao');
  assert.match(a.tg.inviati.at(-1).testo, /Collega Telegram/);
});

test('senza token del bot Telegram è spento e il client reale chiama le Bot API', async () => {
  const archivio = new ArchivioMemoria();
  const r = await gestisci(new Request('https://app.test/api/config'), {}, archivio);
  assert.equal((await r.json()).telegram, false);
  assert.equal(creaTelegram(''), null);
  const chiamate = [];
  const tg = creaTelegram('T', async (url, opz) => { chiamate.push([url, JSON.parse(opz.body)]); return new Response(JSON.stringify({ ok: true, result: { username: 'b' } })); });
  assert.equal(await tg.nomeBot(), 'b');
  await tg.invia(5, '<b>x</b>', [[{ text: 'Fatto', callback_data: 'f|a|b' }]]);
  assert.equal(chiamate[1][0], 'https://api.telegram.org/botT/sendMessage');
  assert.equal(chiamate[1][1].parse_mode, 'HTML');
  assert.deepEqual(chiamate[1][1].reply_markup.inline_keyboard[0][0].text, 'Fatto');
  const ko = creaTelegram('T', async () => new Response(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden' }), { status: 403 }));
  await assert.rejects(ko.invia(1, 'x'), (e) => e.codice === 403);
});
