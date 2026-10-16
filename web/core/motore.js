// Motore: dai promemoria alle date in cui accadono (occorrenze) e agli avvisi da mandare.
// Puro: niente DOM, niente rete. Lo usano interfaccia, feed calendario e test.
import {
  GIORNI, GIORNI_NOMI, MESI_NOMI, giornoSettimana, lunediDi, differenza, piuGiorni, piu, parti,
  giorniNelMese, componi, fmt, fmtAnno, relativo,
} from './date.js';

/* ---------- regola di base, senza eccezioni ---------- */

/** Indice della settimana di rotazione per una data. */
export function settimanaDi(q, d) {
  const n = q.settimane.length;
  const w = Math.floor(differenza(q.inizio, lunediDi(d)) / 7);
  return ((w % n) + n) % n;
}

/** n-esimo giorno della settimana `gs` (0..6) nel mese; n = -1 per l'ultimo. */
function ennesimoGiorno(y, m, n, gs) {
  const primo = componi(y, m, 1);
  const delta = (gs - giornoSettimana(primo) + 7) % 7;
  if (n > 0) {
    const d = 1 + delta + (n - 1) * 7;
    return d <= giorniNelMese(y, m) ? componi(y, m, d) : null;
  }
  const ultimo = componi(y, m, giorniNelMese(y, m));
  return piuGiorni(ultimo, -((giornoSettimana(ultimo) - gs + 7) % 7));
}

/**
 * Cosa prevede la regola in quella data:
 * null = niente; [] = sì (promemoria senza voci); ['umido', ...] = sì, con queste voci.
 */
export function base(p, d) {
  const q = p.quando;
  switch (q.tipo) {
    case 'una-volta':
      return q.date.includes(d) ? [] : null;
    case 'giornaliero': {
      const n = differenza(q.inizio, d);
      return n >= 0 && n % q.ogni === 0 ? [] : null;
    }
    case 'settimanale': {
      if (!q.giorni.includes(GIORNI[giornoSettimana(d)])) return null;
      const w = Math.floor(differenza(q.inizio, lunediDi(d)) / 7);
      return w >= 0 && w % q.ogni === 0 ? [] : null;
    }
    case 'rotazione': {
      const v = q.settimane[settimanaDi(q, d)].giorni[GIORNI[giornoSettimana(d)]];
      if (v === true) return [];
      return Array.isArray(v) && v.length ? v.slice() : null;
    }
    case 'mensile': {
      if (d < q.inizio) return null;
      const [y, m] = parti(d), [y0, m0] = parti(q.inizio);
      if (((y - y0) * 12 + (m - m0)) % q.ogni !== 0) return null;
      let atteso;
      if (q.modo === 'giorno') {
        // il 29, 30, 31 non ci sono in tutti i mesi: lì quel giorno salta ("Fine mese" invece c'è sempre)
        const g = parti(d)[2];
        return q.giorni.includes(g) || (q.giorni.includes(-1) && g === giorniNelMese(y, m)) ? [] : null;
      }
      return ennesimoGiorno(y, m, q.n, GIORNI.indexOf(q.giornoSett)) === d ? [] : null;
    }
    case 'annuale': {
      const [y, m, g] = parti(d);
      if (q.ogni > 1) { const y0 = parti(q.inizio)[0]; if (y < y0 || (y - y0) % q.ogni !== 0) return null; }
      // se il mese è più corto (29 febbraio) vale l'ultimo giorno
      return q.giorniAnno.some((x) => x.mese === m && g === Math.min(x.giorno, giorniNelMese(y, m))) ? [] : null;
    }
  }
  return null;
}

/* ---------- eccezioni ---------- */

const ordina = (p, ids) => {
  const ordine = p.voci.map((v) => v.id);
  return ids.sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
};

/** Occorrenza in una data, eccezioni comprese: null oppure { data, voci, note, cambiata } */
export function occorrenzaIl(p, d) {
  let voci = base(p, d);
  const note = [];
  let cambiata = false;
  for (const e of p.eccezioni) {
    if (e.data !== d || e.azione === 'aggiungi' || voci === null) continue;
    if (e.voci.length && voci.length) {
      const via = e.voci.filter((v) => voci.includes(v));
      if (!via.length) continue;
      voci = voci.filter((v) => !via.includes(v));
      if (!voci.length) voci = null;
    } else voci = null;
    cambiata = true;
    note.push(e.nota || (e.azione === 'sposta' ? 'Spostato a ' + GIORNI_NOMI[giornoSettimana(e.nuovaData)] + ' ' + fmt(e.nuovaData) : 'Annullato'));
  }
  for (const e of p.eccezioni) {
    let aggiunte = null;
    if (e.azione === 'sposta' && e.nuovaData === d) {
      const orig = base(p, e.data);
      if (orig === null) continue;
      aggiunte = e.voci.length ? e.voci.filter((v) => orig.length === 0 || orig.includes(v)) : orig;
      note.push(e.nota || 'Recupero di ' + GIORNI_NOMI[giornoSettimana(e.data)] + ' ' + fmt(e.data));
    } else if (e.azione === 'aggiungi' && e.data === d) {
      aggiunte = e.voci.slice();
      if (e.nota) note.push(e.nota);
    } else continue;
    voci = voci === null ? aggiunte.slice() : [...new Set([...voci, ...aggiunte])];
    cambiata = true;
  }
  if (voci === null) return note.length ? { data: d, voci: null, note: [...new Set(note)], cambiata } : null;
  return { data: d, voci: ordina(p, voci), note: [...new Set(note)], cambiata };
}

/** Occorrenze (vere) tra `da` e `a` compresi. Le note di annullamento sono incluse con voci = null. */
export function occorrenze(p, da, a, { annullate = false } = {}) {
  if (p.pausa) return [];
  const out = [];
  const q = p.quando;
  // scorciatoia per i giorni specifici: le date sono già note
  if (q.tipo === 'una-volta' && !p.eccezioni.length) {
    return q.date.filter((x) => x >= da && x <= a).map((x) => ({ data: x, voci: [], note: [], cambiata: false }));
  }
  const n = differenza(da, a);
  for (let i = 0; i <= n; i++) {
    const o = occorrenzaIl(p, piuGiorni(da, i));
    if (o && (o.voci !== null || annullate)) out.push(o);
  }
  return out;
}

/** Prossime `quante` occorrenze da `da` in poi (cerca al massimo per `orizzonte` giorni). */
export function prossime(p, da, quante = 1, orizzonte = 800) {
  const out = [];
  for (let i = 0; i <= orizzonte && out.length < quante; i += 60) {
    const fine = piuGiorni(da, Math.min(i + 59, orizzonte));
    out.push(...occorrenze(p, piuGiorni(da, i), fine));
  }
  return out.slice(0, quante);
}

/* ---------- avvisi ---------- */

const MAX_PRIMA = { giorni: 1, settimane: 7, mesi: 31 };
const INSISTI_MAX = 365; // una scadenza dimenticata si ricorda al massimo per un anno
export const eScadenza = (p) => !!p.scadenza?.attiva;
/** Data già segnata come fatta (o precedente all'attivazione della scadenza). */
export const giaFatta = (p, data) => eScadenza(p) && !!p.scadenza.fattoFino && data <= p.scadenza.fattoFino;

export const nomiVoci = (p, ids) => (ids || []).map((id) => p.voci.find((v) => v.id === id)?.nome).filter(Boolean);

function testoAvviso(p, a, o, quando) {
  const voci = nomiVoci(p, o.voci).join(', ');
  const tra = relativo(quando, o.data);
  if (a.testo) {
    return a.testo
      .replaceAll('{voci}', voci || p.titolo)
      .replaceAll('{titolo}', p.titolo)
      .replaceAll('{tra}', tra)
      .replaceAll('{data}', fmt(o.data));
  }
  const base = p.titolo + (voci ? ': ' + voci : '');
  return quando === o.data ? base : base + ' (' + tra + ', ' + fmt(o.data) + ')';
}

/**
 * Avvisi che scattano tra `da` e `a` compresi.
 * Ognuno: { id, promemoria, data (quando scatta), ora, occorrenza, testo, scaduto }
 */
export function avvisi(p, da, a) {
  if (p.pausa) return [];
  const out = [];
  const anticipo = p.avvisi.length ? Math.max(...p.avvisi.map((x) => x.prima * MAX_PRIMA[x.unita])) : 0;
  const occ = p.avvisi.length ? occorrenze(p, da, piuGiorni(a, anticipo)) : [];
  for (const o of occ) {
    if (giaFatta(p, o.data)) continue; // scadenza già fatta (anche in anticipo): niente più avvisi
    p.avvisi.forEach((x, i) => {
      const quando = piu(o.data, -x.prima, x.unita);
      if (quando < da || quando > a) return;
      out.push({ id: p.id + '-' + o.data + '-' + i, promemoria: p.id, data: quando, ora: x.ora, occorrenza: o, testo: testoAvviso(p, x, o, quando), scaduto: false });
    });
  }
  // scadenza passata senza "Fatto": un avviso ogni N giorni finché non lo si preme
  // (o finché non arriva la data successiva, che diventa la nuova scadenza)
  if (eScadenza(p)) {
    const n = p.scadenza.ogni;
    const ora = p.avvisi.length ? p.avvisi[p.avvisi.length - 1].ora : '09:00';
    const passate = occorrenze(p, piuGiorni(da, -INSISTI_MAX), a).filter((o) => !giaFatta(p, o.data));
    passate.forEach((o, i) => {
      const dopo = passate[i + 1]?.data ?? prossime(p, piuGiorni(o.data, 1), 1, 400)[0]?.data;
      for (let k = n; k <= INSISTI_MAX; k += n) {
        const quando = piuGiorni(o.data, k);
        if (quando > a || (dopo && quando >= dopo)) break;
        if (quando < da) continue;
        out.push({
          id: p.id + '-' + o.data + '-scaduto-' + k, promemoria: p.id, data: quando, ora, occorrenza: o,
          testo: 'Scaduto da ' + (k === 1 ? '1 giorno' : k + ' giorni') + ': ' + p.titolo + (o.voci.length ? ': ' + nomiVoci(p, o.voci).join(', ') : '') + ' (segna "Fatto")',
          scaduto: true,
        });
      }
    });
  }
  return out.sort((x, y) => (x.data + x.ora).localeCompare(y.data + y.ora));
}

export function tuttiGliAvvisi(bacheca, da, a) {
  return bacheca.promemoria.flatMap((p) => avvisi(p, da, a))
    .sort((x, y) => (x.data + x.ora).localeCompare(y.data + y.ora));
}

/** Tutte le occorrenze della bacheca in un intervallo, raggruppate per data. */
export function agenda(bacheca, da, a) {
  const perData = new Map();
  for (const p of bacheca.promemoria) {
    for (const o of occorrenze(p, da, a, { annullate: true })) {
      if (!perData.has(o.data)) perData.set(o.data, []);
      perData.get(o.data).push({ p, o });
    }
  }
  return [...perData.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([data, voci]) => ({ data, voci }));
}

/* ---------- scadenze ---------- */

/**
 * La data "da fare" di una scadenza: la più recente già arrivata e non segnata come fatta
 * (scaduta, o che scade oggi); se non ce n'è, la prossima. null se non è una scadenza.
 * "Fatto" su questa data vale anche per quelle precedenti.
 */
export function scadenzaAttuale(p, oggiISO) {
  if (!eScadenza(p) || p.pausa) return null;
  const fino = p.scadenza.fattoFino, limite = piuGiorni(oggiISO, -INSISTI_MAX);
  const da = fino && fino >= limite ? piuGiorni(fino, 1) : limite;
  const arrivate = da <= oggiISO ? occorrenze(p, da, oggiISO) : [];
  if (arrivate.length) return arrivate[arrivate.length - 1];
  const domani = piuGiorni(oggiISO, 1);
  return prossime(p, fino && fino >= domani ? piuGiorni(fino, 1) : domani, 1, 1200)[0] ?? null;
}

/** Restituisce il promemoria con la data `data` (e le precedenti) segnata come fatta. */
export function segnaFatto(p, data) {
  if (!eScadenza(p)) return p;
  const fino = p.scadenza.fattoFino && p.scadenza.fattoFino > data ? p.scadenza.fattoFino : data;
  return { ...p, scadenza: { ...p.scadenza, fattoFino: fino } };
}

/** "ogni giorno" / "ogni 3 giorni" */
export const ogniGiorni = (n) => (n === 1 ? 'ogni giorno' : 'ogni ' + n + ' giorni');

/* ---------- descrizioni in italiano ---------- */

const elenco = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
const ORDINALI = { 1: 'primo', 2: 'secondo', 3: 'terzo', 4: 'quarto', '-1': 'ultimo' };
const unitaSing = { giorni: 'giorno', settimane: 'settimana', mesi: 'mese', anni: 'anno' };
export const quantita = (n, unita) => n === 1 ? (unita === 'settimane' ? '1 settimana' : '1 ' + unitaSing[unita]) : n + ' ' + unita;

/** [5, 20, -1] → "il 5, il 20 e a fine mese" */
const art = (g) => (g === 1 || g === 8 || g === 11 ? "l'" : 'il ') + g;
export const nomiGiorniMese = (gg) => elenco(gg.map((g) => (g === -1 ? 'a fine mese' : art(g))));

export function descriviQuando(p) {
  const q = p.quando;
  const nomiG = (gs) => elenco(gs.map((g) => GIORNI_NOMI[GIORNI.indexOf(g)]));
  switch (q.tipo) {
    case 'una-volta': {
      if (q.date.length === 1) return 'Una volta, ' + GIORNI_NOMI[giornoSettimana(q.data)] + ' ' + fmtAnno(q.data);
      const primi = q.date.slice(0, 4).map(fmtAnno);
      return 'In ' + q.date.length + ' giorni: ' + (q.date.length > 4 ? primi.join(', ') + ' e altri ' + (q.date.length - 4) : elenco(primi));
    }
    case 'giornaliero': return q.ogni === 1 ? 'Ogni giorno' : 'Ogni ' + q.ogni + ' giorni';
    case 'settimanale':
      if (!q.giorni.length) return 'Ogni settimana (scegli i giorni)';
      return (q.ogni === 1 ? 'Ogni ' : q.ogni === 2 ? 'A settimane alterne, il ' : 'Ogni ' + q.ogni + ' settimane, il ') + nomiG(q.giorni);
    case 'rotazione': {
      const n = q.settimane.length;
      return (n === 1 ? 'Ogni settimana' : n === 2 ? 'A settimane alterne' : 'Schema di ' + n + ' settimane che si ripete');
    }
    case 'mensile': {
      const ogni = q.ogni === 1 ? 'Ogni mese' : 'Ogni ' + q.ogni + ' mesi';
      if (q.modo === 'giorno') return ogni + ', ' + nomiGiorniMese(q.giorni);
      return ogni + ", l'" + ORDINALI[q.n] + ' ' + GIORNI_NOMI[GIORNI.indexOf(q.giornoSett)];
    }
    case 'annuale':
      return (q.ogni === 1 ? 'Ogni anno' : 'Ogni ' + q.ogni + ' anni') + ', ' + elenco(q.giorniAnno.map((x) => art(x.giorno) + ' ' + MESI_NOMI[x.mese - 1])) +
        (q.ogni > 1 ? ' (dal ' + parti(q.inizio)[0] + ')' : '');
  }
  return '';
}

export function descriviAvviso(a) {
  let quando;
  if (a.prima === 0) quando = 'il giorno stesso';
  else if (a.prima === 1 && a.unita === 'giorni') quando = a.ora >= '17:00' ? 'la sera prima' : 'il giorno prima';
  else quando = quantita(a.prima, a.unita) + ' prima';
  return quando + ' alle ' + a.ora.replace(/^0/, '');
}

/** Frase completa: "Ogni martedì. Ti avviso la sera prima alle 19:00." */
export function riassunto(p) {
  const av = p.avvisi.length ? 'Ti avviso ' + elenco(p.avvisi.map(descriviAvviso)) + '.' : 'Nessun avviso: lo vedi solo nell\'app e nel calendario.';
  const sc = eScadenza(p) ? ' È una scadenza: se passa senza "Fatto", ti avviso ' + ogniGiorni(p.scadenza.ogni) + ' finché non lo premi.' : '';
  return descriviQuando(p) + '. ' + av + sc;
}
