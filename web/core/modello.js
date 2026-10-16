// Modello dati della bacheca (versione 2) e normalizzazione.
// Ogni dato che arriva da fuori (server, import, interfaccia) passa da normalizza():
// completa i campi mancanti, scarta valori non validi e riferimenti rotti.
import { GIORNI, valida, validaOra, lunediDi, oggi, parti, piuGiorni, giorniNelMese } from './date.js';

export const VERSIONE = 2;
export const TIPI = ['una-volta', 'giornaliero', 'settimanale', 'rotazione', 'mensile', 'annuale'];
/** giorni tra un avviso e l'altro quando una scadenza è passata senza "Fatto" */
export const SCADENZA_OGNI = [1, 2, 3, 4, 5, 7, 10, 14, 30];
export const UNITA = ['giorni', 'settimane', 'mesi', 'anni'];
export const AZIONI = ['annulla', 'sposta', 'aggiungi'];
export const LIMITI = { date: 200, promemoria: 300, voci: 30, settimane: 12, avvisi: 6, eccezioni: 200, gruppi: 50, persone: 50, testo: 300, nota: 2000 };

export const nuovoId = (p = '') => p + Math.random().toString(36).slice(2, 10);

/** Nomi dei disegni disponibili (web/js/disegni.js). Le vecchie emoji si convertono da sole. */
export const ICONE = ['campanella', 'spazzatura', 'mercato', 'auto', 'documento', 'medicina', 'compleanno', 'calendario', 'casa', 'fuoco',
  'acqua', 'animale', 'pianta', 'salute', 'scuola', 'sport', 'soldi', 'telefono', 'stella', 'luna', 'uccello', 'occhio'];
const DA_EMOJI = {
  '🗑': 'spazzatura', '♻': 'spazzatura', '🛒': 'mercato', '🚗': 'auto', '🚙': 'auto', '🛻': 'auto', '🚐': 'auto', '🏍': 'auto', '🛵': 'auto',
  '📄': 'documento', '💊': 'medicina', '🎂': 'compleanno', '📅': 'calendario', '🏠': 'casa', '🔥': 'fuoco', '💧': 'acqua', '🐶': 'animale',
  '🌱': 'pianta', '🏥': 'salute', '🎒': 'scuola', '⚽': 'sport', '💶': 'soldi', '✂': 'documento', '📞': 'telefono', '✏': 'campanella', '🔔': 'campanella',
};
export function icona(v) {
  const s = String(v ?? '').trim();
  if (ICONE.includes(s)) return s;
  return DA_EMOJI[s.replace(/\uFE0F/g, '')] || '';
}

const str = (v, max = LIMITI.testo) => String(v ?? '').slice(0, max);
const int = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const colore = (v, def = '#5b6b62') => /^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : def;
const idValido = (v) => /^[a-z0-9_-]{1,40}$/i.test(String(v ?? ''));
const lista = (v) => Array.isArray(v) ? v : [];
const unici = (arr) => [...new Set(arr)];

/**
 * Ripetizione equivalente a una vecchia "scadenza" (data + "ripeti ogni N unità"):
 * dal formato precedente, quando la scadenza era un tipo a parte.
 */
export function quandoDaScadenza(data, ripeti) {
  if (!valida(data) || !ripeti || typeof ripeti !== 'object') return { tipo: 'una-volta', date: [data] };
  const ogni = Math.max(1, Math.round(Number(ripeti.ogni) || 1));
  const [y, m, g] = parti(data);
  const ultimo = g === giorniNelMese(y, m);
  switch (ripeti.unita) {
    case 'giorni': return { tipo: 'giornaliero', ogni, inizio: data };
    case 'settimane': return { tipo: 'giornaliero', ogni: ogni * 7, inizio: data };
    case 'mesi': return { tipo: 'mensile', modo: 'giorno', giorni: [ripeti.fineMese || (ultimo && g >= 28) ? -1 : g], ogni, inizio: data };
    default: return { tipo: 'annuale', mese: m, giorno: ripeti.fineMese ? 31 : g, ogni, inizio: data };
  }
}

function normalizzaQuando(q, oggiISO) {
  q = q && typeof q === 'object' ? q : {};
  if (q.tipo === 'scadenza') q = quandoDaScadenza(q.scadenza, q.ripeti); // formato precedente
  const tipo = TIPI.includes(q.tipo) ? q.tipo : 'una-volta';
  const dataO = (v, def) => valida(v) ? v : def;
  const giorni = (v) => unici(lista(v).filter((g) => GIORNI.includes(g)));
  switch (tipo) {
    case 'una-volta': {
      // "Giorni specifici": un elenco di date (prima c'era una data sola, in `data`)
      let date = unici(lista(q.date).filter(valida)).sort().slice(0, LIMITI.date);
      if (!date.length) date = [dataO(q.data, oggiISO)];
      return { tipo, date, data: date[0] }; // `data`: per chi ha ancora l'app vecchia aperta
    }
    case 'giornaliero':
      return { tipo, ogni: int(q.ogni, 1, 365, 1), inizio: dataO(q.inizio, oggiISO) };
    case 'settimanale':
      return { tipo, giorni: giorni(q.giorni), ogni: int(q.ogni, 1, 12, 1), inizio: lunediDi(dataO(q.inizio, oggiISO)) };
    case 'rotazione': {
      let settimane = lista(q.settimane).slice(0, LIMITI.settimane).map((s, i) => {
        s = s && typeof s === 'object' ? s : {};
        const g = {};
        const src = s.giorni && typeof s.giorni === 'object' ? s.giorni : {};
        for (const k of GIORNI) {
          const v = src[k];
          if (v === true) g[k] = true;
          else if (Array.isArray(v) && v.length) g[k] = unici(v.map(String));
        }
        return { nome: str(s.nome || 'Settimana ' + String.fromCharCode(65 + i), 40), giorni: g };
      });
      if (!settimane.length) settimane = [{ nome: 'Settimana A', giorni: {} }, { nome: 'Settimana B', giorni: {} }];
      return { tipo, inizio: lunediDi(dataO(q.inizio, oggiISO)), settimane };
    }
    case 'mensile': {
      const modo = q.modo === 'settimana' ? 'settimana' : 'giorno';
      const n = [1, 2, 3, 4, -1].includes(Number(q.n)) ? Number(q.n) : 1;
      // giorni fissi del mese (1..31, -1 = fine mese). Prima ce n'era uno solo, in `giorno`,
      // e il 31 voleva dire "l'ultimo giorno": ora è "Fine mese".
      const ok = (g) => g === -1 || (Number.isInteger(g) && g >= 1 && g <= 31);
      let gg = Array.isArray(q.giorni) ? unici(q.giorni.map(Number).filter(ok)) : [];
      if (!gg.length) { const g = Number(q.giorno); gg = [g === -1 || g === 31 ? -1 : int(g, 1, 30, 1)]; }
      gg.sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b));
      return {
        tipo, modo, giorni: gg,
        giorno: gg[0], // per chi ha ancora l'app vecchia aperta
        n, giornoSett: GIORNI.includes(q.giornoSett) ? q.giornoSett : 'lun',
        ogni: int(q.ogni, 1, 12, 1), inizio: dataO(q.inizio, oggiISO),
      };
    }
    case 'annuale':
      return { tipo, mese: int(q.mese, 1, 12, 1), giorno: int(q.giorno, 1, 31, 1), ogni: int(q.ogni, 1, 20, 1), inizio: dataO(q.inizio, oggiISO) };
  }
}

/**
 * Opzione "scadenza" di un promemoria: se una data passa senza che si prema "Fatto",
 * arriva un avviso ogni `ogni` giorni finché non lo si preme.
 * `fattoFino`: le date fino a questa compresa sono già fatte (o precedenti all'attivazione).
 */
function normalizzaScadenza(p, quandoGrezzo, oggiISO) {
  const vecchia = quandoGrezzo && quandoGrezzo.tipo === 'scadenza'; // formato precedente
  const s = p.scadenza && typeof p.scadenza === 'object' ? p.scadenza : {};
  const attiva = vecchia || !!p.insisti || !!s.attiva;
  let fattoFino = valida(s.fattoFino) ? s.fattoFino : '';
  if (vecchia && !fattoFino && valida(quandoGrezzo.scadenza)) fattoFino = piuGiorni(quandoGrezzo.scadenza, -1);
  if (attiva && !fattoFino) fattoFino = piuGiorni(oggiISO, -1);
  const ogni = SCADENZA_OGNI.includes(Number(s.ogni)) ? Number(s.ogni) : (vecchia || p.insisti ? 3 : 1);
  return { attiva, ogni, fattoFino };
}

function normalizzaPromemoria(p, gruppi, oggiISO) {
  p = p && typeof p === 'object' ? p : {};
  const voci = lista(p.voci).slice(0, LIMITI.voci).filter((v) => v && idValido(v.id))
    .map((v) => ({ id: String(v.id), nome: str(v.nome || v.id, 60), colore: colore(v.colore), nota: str(v.nota) }))
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  const idVoci = voci.map((v) => v.id);
  const quando = normalizzaQuando(p.quando, oggiISO);
  if (quando.tipo === 'rotazione') {
    for (const s of quando.settimane) for (const k of Object.keys(s.giorni)) {
      const v = s.giorni[k];
      if (Array.isArray(v)) {
        const ok = v.filter((id) => idVoci.includes(id));
        if (ok.length) s.giorni[k] = ok; else delete s.giorni[k];
      } else if (voci.length) delete s.giorni[k]; // con le voci un giorno "true" non ha senso
    }
  }
  const avvisi = lista(p.avvisi).slice(0, LIMITI.avvisi).map((a) => ({
    prima: int(a?.prima, 0, 400, 0),
    unita: ['giorni', 'settimane', 'mesi'].includes(a?.unita) ? a.unita : 'giorni',
    ora: validaOra(a?.ora) ? a.ora : '09:00',
    testo: str(a?.testo, 140),
  }));
  const eccezioni = lista(p.eccezioni).slice(0, LIMITI.eccezioni).filter((e) => e && valida(e.data)).map((e) => ({
    id: idValido(e.id) ? e.id : nuovoId('e'),
    data: e.data,
    azione: AZIONI.includes(e.azione) ? e.azione : 'annulla',
    nuovaData: e.azione === 'sposta' && valida(e.nuovaData) ? e.nuovaData : '',
    voci: unici(lista(e.voci).map(String)).filter((id) => idVoci.includes(id)),
    nota: str(e.nota, 140),
  })).filter((e) => e.azione !== 'sposta' || e.nuovaData);
  return {
    id: idValido(p.id) ? p.id : nuovoId('p'),
    titolo: str(p.titolo || 'Promemoria', 80),
    gruppo: gruppi.some((g) => g.id === p.gruppo) ? p.gruppo : '',
    icona: icona(p.icona),
    nota: str(p.nota, LIMITI.nota),
    quando,
    voci,
    avvisi,
    eccezioni,
    scadenza: normalizzaScadenza(p, p.quando, oggiISO),
    pausa: !!p.pausa,
    destinatari: unici(lista(p.destinatari).map(String)).filter(idValido),
  };
}

/** Converte la configurazione del prototipo "Raccolta rifiuti" (v1) nel formato v2. */
export function daRaccoltaRifiuti(v1) {
  const voci = lista(v1.rifiuti).map((r) => ({ id: r.id, nome: r.nome, colore: r.colore, nota: r.nota }));
  const sera = v1.esponiSeraPrima !== false;
  const ora = v1.promemoria?.ora || '20:30';
  return {
    versione: VERSIONE,
    nome: v1.sottotitolo || v1.titolo || 'Casa',
    gruppi: [{ id: 'rifiuti', nome: 'Rifiuti', icona: 'spazzatura', colore: '#2e7d4f' }],
    promemoria: [{
      id: 'raccolta',
      titolo: v1.titolo && !/\?$/.test(v1.titolo) ? v1.titolo : 'Raccolta rifiuti',
      gruppo: 'rifiuti', icona: 'spazzatura',
      nota: [v1.orario ? 'Esposizione ' + v1.orario + '.' : '', ...lista(v1.note).map((n) => n.titolo + ': ' + n.testo)].filter(Boolean).join('\n'),
      quando: {
        tipo: 'rotazione', inizio: v1.inizioCiclo,
        settimane: lista(v1.settimane).map((s) => ({ nome: s.nome, giorni: s.giorni })),
      },
      voci,
      avvisi: [{ prima: sera ? 1 : 0, unita: 'giorni', ora, testo: sera ? 'Metti fuori stasera: {voci}' : 'Oggi si ritira: {voci}' }],
      eccezioni: lista(v1.eccezioni).map((e) => ({ ...e, voci: e.rifiuti })),
    }],
  };
}

/** Rende valida una bacheca qualsiasi. Lancia un errore solo se non è proprio un oggetto. */
export function normalizza(raw, oggiISO = oggi()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('I dati non contengono una bacheca valida.');
  if (!raw.versione || raw.versione < 2) {
    if (Array.isArray(raw.rifiuti) && Array.isArray(raw.settimane)) raw = daRaccoltaRifiuti(raw);
  }
  const gruppi = lista(raw.gruppi).slice(0, LIMITI.gruppi).filter((g) => g && idValido(g.id))
    .map((g) => ({ id: g.id, nome: str(g.nome || g.id, 40), icona: icona(g.icona) || 'campanella', colore: colore(g.colore) }))
    .filter((g, i, a) => a.findIndex((x) => x.id === g.id) === i);
  const persone = lista(raw.persone).slice(0, LIMITI.persone).filter((p) => p && idValido(p.id))
    .map((p) => ({ id: p.id, nome: str(p.nome || p.id, 60), email: str(p.email, 120), telegram: str(p.telegram, 60) }));
  const promemoria = lista(raw.promemoria).slice(0, LIMITI.promemoria).map((p) => normalizzaPromemoria(p, gruppi, oggiISO))
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
  return {
    versione: VERSIONE,
    nome: str(raw.nome || 'La mia bacheca', 60),
    fusoOrario: typeof raw.fusoOrario === 'string' && /^[A-Za-z_]+\/[A-Za-z_/]+$/.test(raw.fusoOrario) ? raw.fusoOrario : 'Europe/Rome',
    gruppi,
    persone,
    promemoria,
  };
}

export const bachecaVuota = (nome) => normalizza({ versione: VERSIONE, nome: nome || 'La mia bacheca', gruppi: [], promemoria: [] });
