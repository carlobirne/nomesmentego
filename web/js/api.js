// Chiamate al server (Cloudflare Worker).
async function chiama(metodo, percorso, corpo) {
  let r;
  try {
    r = await fetch(percorso, {
      method: metodo,
      headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: 'no-store',
    });
  } catch {
    throw Object.assign(new Error('Nessuna connessione a internet.'), { offline: true });
  }
  let dati = null;
  try { dati = await r.json(); } catch { /* risposta vuota */ }
  if (!r.ok && r.status !== 409) throw Object.assign(new Error(dati?.errore || 'Errore ' + r.status), { stato: r.status });
  return { stato: r.status, ...dati };
}

export const api = {
  config: () => chiama('GET', '/api/config'),
  crea: (nome, codice, dati) => chiama('POST', '/api/bacheche', { nome, codice, dati }),
  leggi: (token) => chiama('GET', '/api/b/' + token),
  salva: (token, versione, dati) => chiama('PUT', '/api/b/' + token, { versione, dati }),
  storico: (token) => chiama('GET', '/api/b/' + token + '/storico'),
  copia: (token, v) => chiama('GET', '/api/b/' + token + '/storico/' + v),
  rigenera: (token, quale) => chiama('POST', '/api/b/' + token + '/rigenera', { quale }),
  telegram: (token) => chiama('GET', '/api/b/' + token + '/telegram'),
  telegramCollega: (token) => chiama('POST', '/api/b/' + token + '/telegram/collega'),
  telegramProva: (token) => chiama('POST', '/api/b/' + token + '/telegram/prova'),
  telegramFiltro: (token, chat, filtro) => chiama('PUT', '/api/b/' + token + '/telegram/' + encodeURIComponent(chat), { filtro }),
  telegramTogli: (token, chat) => chiama('DELETE', '/api/b/' + token + '/telegram/' + encodeURIComponent(chat)),
  pushChiave: (token) => chiama('GET', '/api/b/' + token + '/push/chiave'),
  pushIscrivi: (token, abbonamento, nome) => chiama('POST', '/api/b/' + token + '/push', { abbonamento, nome }),
  pushMio: (token, endpoint) => chiama('POST', '/api/b/' + token + '/push/mio', { endpoint }),
  pushVia: (token, endpoint) => chiama('POST', '/api/b/' + token + '/push/via', { endpoint }),
  pushProva: (token, endpoint) => chiama('POST', '/api/b/' + token + '/push/prova', { endpoint }),
  pushElenco: (token) => chiama('GET', '/api/b/' + token + '/push'),
  pushFiltro: (token, id, filtro) => chiama('PUT', '/api/b/' + token + '/push/' + id, { filtro }),
  pushTogli: (token, id) => chiama('DELETE', '/api/b/' + token + '/push/' + id),
  email: (token) => chiama('GET', '/api/b/' + token + '/email'),
  emailAggiungi: (token, indirizzo, nome, filtro = null) => chiama('POST', '/api/b/' + token + '/email', { indirizzo, nome, filtro }),
  emailModello: (token, oggetto, corpo) => chiama('PUT', '/api/b/' + token + '/email/modello', { oggetto, corpo }),
  emailAnteprima: (token, oggetto, corpo) => chiama('POST', '/api/b/' + token + '/email/anteprima', { oggetto, corpo }),
  emailProva: (token) => chiama('POST', '/api/b/' + token + '/email/prova'),
  emailConferma: (token, id) => chiama('POST', '/api/b/' + token + '/email/' + id + '/conferma'),
  emailFiltro: (token, id, filtro) => chiama('PUT', '/api/b/' + token + '/email/' + id, { filtro }),
  emailTogli: (token, id) => chiama('DELETE', '/api/b/' + token + '/email/' + id),
};

/* bacheche aperte su questo dispositivo, per ritrovarle dalla pagina iniziale */
const CHIAVE = 'nms.recenti';
export function recenti() {
  try { return JSON.parse(localStorage.getItem(CHIAVE) || '[]'); } catch { return []; }
}
export function ricorda(voce) {
  try {
    const l = recenti().filter((x) => x.token !== voce.token);
    l.unshift({ ...voce, visto: new Date().toISOString() });
    localStorage.setItem(CHIAVE, JSON.stringify(l.slice(0, 20)));
  } catch { /* archiviazione non disponibile */ }
}
export function dimentica(token) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(recenti().filter((x) => x.token !== token))); } catch { /* */ }
  try { localStorage.removeItem('nms.cache.' + token); } catch { /* */ }
}
export function cache(token, valore) {
  try {
    if (valore === undefined) return JSON.parse(localStorage.getItem('nms.cache.' + token) || 'null');
    localStorage.setItem('nms.cache.' + token, JSON.stringify(valore));
  } catch { return null; }
}
