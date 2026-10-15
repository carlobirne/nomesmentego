// Accesso ai dati delle bacheche. ArchivioD1 usa il database Cloudflare D1;
// ArchivioMemoria ha la stessa interfaccia e serve per i test.

const DIECI_MINUTI = 10 * 60 * 1000;
const COPIE = 30;

export class ArchivioD1 {
  constructor(db) { this.db = db; }

  async crea({ id, hashModifica, tokenLettura, dati, adesso }) {
    await this.db.prepare('INSERT INTO bacheche (id, hash_modifica, token_lettura, dati, versione, creata, aggiornata) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .bind(id, hashModifica, tokenLettura, dati, adesso, adesso).run();
  }

  perModifica(hash) {
    return this.db.prepare('SELECT id, token_lettura, dati, versione, aggiornata FROM bacheche WHERE hash_modifica = ?').bind(hash).first();
  }

  perLettura(token) {
    return this.db.prepare('SELECT id, dati, versione, aggiornata FROM bacheche WHERE token_lettura = ?').bind(token).first();
  }

  async aggiorna(id, versioneAttesa, dati, adesso) {
    const prima = await this.db.prepare('SELECT dati, versione, aggiornata FROM bacheche WHERE id = ?').bind(id).first();
    if (!prima) return { ok: false };
    if (prima.versione !== versioneAttesa) return { ok: false, attuale: prima };
    const r = await this.db.prepare('UPDATE bacheche SET dati = ?, versione = versione + 1, aggiornata = ? WHERE id = ? AND versione = ?')
      .bind(dati, adesso, id, versioneAttesa).run();
    if (!r.meta.changes) {
      const attuale = await this.db.prepare('SELECT dati, versione, aggiornata FROM bacheche WHERE id = ?').bind(id).first();
      return { ok: false, attuale };
    }
    // copia di sicurezza della versione precedente, se l'ultima è più vecchia di 10 minuti
    const ultima = await this.db.prepare('SELECT MAX(salvata) AS s FROM storico WHERE bacheca_id = ?').bind(id).first();
    if (!ultima?.s || Date.parse(adesso) - Date.parse(ultima.s) >= DIECI_MINUTI) {
      await this.db.batch([
        this.db.prepare('INSERT OR REPLACE INTO storico (bacheca_id, versione, dati, salvata) VALUES (?, ?, ?, ?)').bind(id, prima.versione, prima.dati, prima.aggiornata),
        this.db.prepare('DELETE FROM storico WHERE bacheca_id = ? AND versione NOT IN (SELECT versione FROM storico WHERE bacheca_id = ? ORDER BY versione DESC LIMIT ?)').bind(id, id, COPIE),
      ]);
    }
    return { ok: true, versione: versioneAttesa + 1 };
  }

  async storico(id) {
    const r = await this.db.prepare('SELECT versione, salvata FROM storico WHERE bacheca_id = ? ORDER BY versione DESC').bind(id).all();
    return r.results;
  }

  async copia(id, versione) {
    const r = await this.db.prepare('SELECT dati FROM storico WHERE bacheca_id = ? AND versione = ?').bind(id, versione).first();
    return r?.dati ?? null;
  }

  async cambiaModifica(id, hashModifica) {
    await this.db.prepare('UPDATE bacheche SET hash_modifica = ? WHERE id = ?').bind(hashModifica, id).run();
  }

  async cambiaLettura(id, tokenLettura) {
    await this.db.prepare('UPDATE bacheche SET token_lettura = ? WHERE id = ?').bind(tokenLettura, id).run();
  }

  /* ---------- Telegram ---------- */

  perId(id) {
    return this.db.prepare('SELECT id, token_lettura, dati, versione, aggiornata FROM bacheche WHERE id = ?').bind(id).first();
  }

  async creaCodiceTelegram({ codice, bachecaId, modifica, origine, scade }) {
    await this.db.batch([
      this.db.prepare('DELETE FROM telegram_codici WHERE scade < ?').bind(new Date().toISOString()),
      this.db.prepare('INSERT INTO telegram_codici (codice, bacheca_id, modifica, origine, scade) VALUES (?, ?, ?, ?, ?)')
        .bind(codice, bachecaId, modifica ? 1 : 0, origine, scade),
    ]);
  }

  /** Consuma un codice: restituisce { bacheca_id, modifica, origine } oppure null se non valido o scaduto. */
  async usaCodiceTelegram(codice, adesso) {
    const r = await this.db.prepare('SELECT bacheca_id, modifica, origine, scade FROM telegram_codici WHERE codice = ?').bind(codice).first();
    if (!r) return null;
    await this.db.prepare('DELETE FROM telegram_codici WHERE codice = ?').bind(codice).run();
    return r.scade >= adesso ? r : null;
  }

  async iscriviTelegram({ bachecaId, chatId, nome, modifica, origine, ultimo, adesso }) {
    await this.db.prepare(`INSERT INTO telegram_iscrizioni (bacheca_id, chat_id, nome, modifica, origine, filtro, ultimo, creata)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT (bacheca_id, chat_id) DO UPDATE SET nome = excluded.nome, modifica = MAX(modifica, excluded.modifica), origine = excluded.origine`)
      .bind(bachecaId, chatId, nome, modifica ? 1 : 0, origine, ultimo, adesso).run();
  }

  async iscrizioniTelegram(bachecaId) {
    const r = await this.db.prepare('SELECT chat_id, nome, modifica, filtro, creata FROM telegram_iscrizioni WHERE bacheca_id = ? ORDER BY creata').bind(bachecaId).all();
    return r.results;
  }

  async iscrizioniDellaChat(chatId) {
    const r = await this.db.prepare(`SELECT i.bacheca_id, i.chat_id, i.nome, i.modifica, i.origine, i.filtro, i.ultimo, b.dati, b.token_lettura
      FROM telegram_iscrizioni i JOIN bacheche b ON b.id = i.bacheca_id WHERE i.chat_id = ?`).bind(chatId).all();
    return r.results;
  }

  /** Tutte le iscrizioni con i dati della bacheca, per il giro di invio. */
  async tutteLeIscrizioniTelegram() {
    const r = await this.db.prepare(`SELECT i.bacheca_id, i.chat_id, i.nome, i.modifica, i.origine, i.filtro, i.ultimo, b.dati, b.token_lettura
      FROM telegram_iscrizioni i JOIN bacheche b ON b.id = i.bacheca_id`).all();
    return r.results;
  }

  async filtroTelegram(bachecaId, chatId, filtro) {
    const r = await this.db.prepare('UPDATE telegram_iscrizioni SET filtro = ? WHERE bacheca_id = ? AND chat_id = ?')
      .bind(filtro === null ? null : JSON.stringify(filtro), bachecaId, chatId).run();
    return r.meta.changes > 0;
  }

  async segnaInviatoTelegram(bachecaId, chatId, ultimo) {
    await this.db.prepare('UPDATE telegram_iscrizioni SET ultimo = ? WHERE bacheca_id = ? AND chat_id = ?').bind(ultimo, bachecaId, chatId).run();
  }

  async rimuoviTelegram(bachecaId, chatId) {
    const r = await this.db.prepare('DELETE FROM telegram_iscrizioni WHERE bacheca_id = ? AND chat_id = ?').bind(bachecaId, chatId).run();
    return r.meta.changes > 0;
  }

  async rimuoviChatTelegram(chatId) {
    const r = await this.db.prepare('DELETE FROM telegram_iscrizioni WHERE chat_id = ?').bind(chatId).run();
    return r.meta.changes;
  }

  /* ---------- impostazioni e notifiche (app ed email) ---------- */

  async impostazione(chiave) {
    return (await this.db.prepare('SELECT valore FROM impostazioni WHERE chiave = ?').bind(chiave).first())?.valore ?? null;
  }
  async salvaImpostazione(chiave, valore, { soloSeManca = false } = {}) {
    await this.db.prepare(soloSeManca ? 'INSERT OR IGNORE INTO impostazioni (chiave, valore) VALUES (?, ?)'
      : 'INSERT INTO impostazioni (chiave, valore) VALUES (?, ?) ON CONFLICT (chiave) DO UPDATE SET valore = excluded.valore').bind(chiave, valore).run();
  }

  /** Crea (o aggiorna, se la destinazione c'è già) e restituisce la riga. */
  async salvaNotifica(n) {
    await this.db.prepare(`INSERT INTO notifiche (id, bacheca_id, canale, destinazione, chiavi, nome, stato, token, origine, filtro, ultimo, creata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT (bacheca_id, canale, destinazione) DO UPDATE SET chiavi = excluded.chiavi, nome = excluded.nome, origine = excluded.origine`)
      .bind(n.id, n.bachecaId, n.canale, n.destinazione, n.chiavi ?? null, n.nome, n.stato, n.token, n.origine, n.ultimo, n.creata).run();
    return this.db.prepare('SELECT * FROM notifiche WHERE bacheca_id = ? AND canale = ? AND destinazione = ?').bind(n.bachecaId, n.canale, n.destinazione).first();
  }
  async notifiche(bachecaId, canale) {
    return (await this.db.prepare('SELECT * FROM notifiche WHERE bacheca_id = ? AND canale = ? ORDER BY creata').bind(bachecaId, canale).all()).results;
  }
  notifica(id) { return this.db.prepare('SELECT * FROM notifiche WHERE id = ?').bind(id).first(); }
  notificaPerToken(token) {
    return this.db.prepare('SELECT n.*, b.dati FROM notifiche n JOIN bacheche b ON b.id = n.bacheca_id WHERE n.token = ?').bind(token).first();
  }
  /** Destinatari attivi di un canale con i dati della bacheca, per il giro di invio. */
  async notificheAttive(canale) {
    return (await this.db.prepare(`SELECT n.*, b.dati, b.token_lettura FROM notifiche n JOIN bacheche b ON b.id = n.bacheca_id
      WHERE n.canale = ? AND n.stato = 'attivo'`).bind(canale).all()).results;
  }
  async aggiornaNotifica(id, campi) {
    const nomi = Object.keys(campi).filter((k) => ['filtro', 'stato', 'ultimo', 'nome'].includes(k));
    if (!nomi.length) return false;
    const r = await this.db.prepare('UPDATE notifiche SET ' + nomi.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?')
      .bind(...nomi.map((k) => campi[k]), id).run();
    return r.meta.changes > 0;
  }
  async rimuoviNotifica(id) {
    return (await this.db.prepare('DELETE FROM notifiche WHERE id = ?').bind(id).run()).meta.changes > 0;
  }
}

export class ArchivioMemoria {
  constructor() { this.righe = new Map(); this.copie = []; }

  async crea({ id, hashModifica, tokenLettura, dati, adesso }) {
    this.righe.set(id, { id, hash_modifica: hashModifica, token_lettura: tokenLettura, dati, versione: 1, aggiornata: adesso });
  }
  async perModifica(hash) { return [...this.righe.values()].find((r) => r.hash_modifica === hash) ?? null; }
  async perLettura(token) { return [...this.righe.values()].find((r) => r.token_lettura === token) ?? null; }
  async aggiorna(id, versioneAttesa, dati, adesso) {
    const r = this.righe.get(id);
    if (!r) return { ok: false };
    if (r.versione !== versioneAttesa) return { ok: false, attuale: { ...r } };
    const ultima = this.copie.filter((c) => c.id === id).at(-1);
    if (!ultima || Date.parse(adesso) - Date.parse(ultima.salvata) >= DIECI_MINUTI) {
      this.copie.push({ id, versione: r.versione, dati: r.dati, salvata: r.aggiornata });
    }
    Object.assign(r, { dati, versione: r.versione + 1, aggiornata: adesso });
    return { ok: true, versione: r.versione };
  }
  async storico(id) {
    return this.copie.filter((c) => c.id === id).map(({ versione, salvata }) => ({ versione, salvata })).reverse();
  }
  async copia(id, versione) { return this.copie.find((c) => c.id === id && c.versione === versione)?.dati ?? null; }
  async cambiaModifica(id, hash) { this.righe.get(id).hash_modifica = hash; }
  async cambiaLettura(id, token) { this.righe.get(id).token_lettura = token; }

  /* Telegram */
  telegram = { codici: new Map(), iscrizioni: [] };
  async perId(id) { return this.righe.get(id) ?? null; }
  async creaCodiceTelegram({ codice, bachecaId, modifica, origine, scade }) {
    this.telegram.codici.set(codice, { bacheca_id: bachecaId, modifica: modifica ? 1 : 0, origine, scade });
  }
  async usaCodiceTelegram(codice, adesso) {
    const r = this.telegram.codici.get(codice);
    this.telegram.codici.delete(codice);
    return r && r.scade >= adesso ? r : null;
  }
  async iscriviTelegram({ bachecaId, chatId, nome, modifica, origine, ultimo, adesso }) {
    const r = this.telegram.iscrizioni.find((x) => x.bacheca_id === bachecaId && x.chat_id === chatId);
    if (r) Object.assign(r, { nome, modifica: Math.max(r.modifica, modifica ? 1 : 0), origine });
    else this.telegram.iscrizioni.push({ bacheca_id: bachecaId, chat_id: chatId, nome, modifica: modifica ? 1 : 0, origine, filtro: null, ultimo, creata: adesso });
  }
  #conBacheca = (i) => ({ ...i, dati: this.righe.get(i.bacheca_id).dati, token_lettura: this.righe.get(i.bacheca_id).token_lettura });
  async iscrizioniTelegram(bachecaId) { return this.telegram.iscrizioni.filter((x) => x.bacheca_id === bachecaId).map((x) => ({ ...x })); }
  async iscrizioniDellaChat(chatId) { return this.telegram.iscrizioni.filter((x) => x.chat_id === chatId).map(this.#conBacheca); }
  async tutteLeIscrizioniTelegram() { return this.telegram.iscrizioni.map(this.#conBacheca); }
  async filtroTelegram(bachecaId, chatId, filtro) {
    const r = this.telegram.iscrizioni.find((x) => x.bacheca_id === bachecaId && x.chat_id === chatId);
    if (r) r.filtro = filtro === null ? null : JSON.stringify(filtro);
    return !!r;
  }
  async segnaInviatoTelegram(bachecaId, chatId, ultimo) {
    const r = this.telegram.iscrizioni.find((x) => x.bacheca_id === bachecaId && x.chat_id === chatId);
    if (r) r.ultimo = ultimo;
  }
  async rimuoviTelegram(bachecaId, chatId) {
    const n = this.telegram.iscrizioni.length;
    this.telegram.iscrizioni = this.telegram.iscrizioni.filter((x) => !(x.bacheca_id === bachecaId && x.chat_id === chatId));
    return this.telegram.iscrizioni.length < n;
  }
  /* impostazioni e notifiche */
  impostazioni = new Map();
  notificheRighe = [];
  async impostazione(chiave) { return this.impostazioni.get(chiave) ?? null; }
  async salvaImpostazione(chiave, valore, { soloSeManca = false } = {}) {
    if (!soloSeManca || !this.impostazioni.has(chiave)) this.impostazioni.set(chiave, valore);
  }
  async salvaNotifica(n) {
    let r = this.notificheRighe.find((x) => x.bacheca_id === n.bachecaId && x.canale === n.canale && x.destinazione === n.destinazione);
    if (r) Object.assign(r, { chiavi: n.chiavi ?? null, nome: n.nome, origine: n.origine });
    else {
      r = { id: n.id, bacheca_id: n.bachecaId, canale: n.canale, destinazione: n.destinazione, chiavi: n.chiavi ?? null, nome: n.nome,
        stato: n.stato, token: n.token, origine: n.origine, filtro: null, ultimo: n.ultimo, creata: n.creata };
      this.notificheRighe.push(r);
    }
    return { ...r };
  }
  async notifiche(bachecaId, canale) { return this.notificheRighe.filter((x) => x.bacheca_id === bachecaId && x.canale === canale).map((x) => ({ ...x })); }
  async notifica(id) { const r = this.notificheRighe.find((x) => x.id === id); return r ? { ...r } : null; }
  async notificaPerToken(token) {
    const r = this.notificheRighe.find((x) => x.token === token);
    return r ? { ...r, dati: this.righe.get(r.bacheca_id).dati } : null;
  }
  async notificheAttive(canale) {
    return this.notificheRighe.filter((x) => x.canale === canale && x.stato === 'attivo')
      .map((x) => ({ ...x, dati: this.righe.get(x.bacheca_id).dati, token_lettura: this.righe.get(x.bacheca_id).token_lettura }));
  }
  async aggiornaNotifica(id, campi) {
    const r = this.notificheRighe.find((x) => x.id === id);
    if (!r) return false;
    for (const k of ['filtro', 'stato', 'ultimo', 'nome']) if (k in campi) r[k] = campi[k];
    return true;
  }
  async rimuoviNotifica(id) {
    const n = this.notificheRighe.length;
    this.notificheRighe = this.notificheRighe.filter((x) => x.id !== id);
    return this.notificheRighe.length < n;
  }
  async rimuoviChatTelegram(chatId) {
    const n = this.telegram.iscrizioni.length;
    this.telegram.iscrizioni = this.telegram.iscrizioni.filter((x) => x.chat_id !== chatId);
    return n - this.telegram.iscrizioni.length;
  }
}
