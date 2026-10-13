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
}
