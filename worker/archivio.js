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
  async rimuoviChatTelegram(chatId) {
    const n = this.telegram.iscrizioni.length;
    this.telegram.iscrizioni = this.telegram.iscrizioni.filter((x) => x.chat_id !== chatId);
    return n - this.telegram.iscrizioni.length;
  }
}
