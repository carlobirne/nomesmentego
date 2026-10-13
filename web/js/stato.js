// Stato dell'app e salvataggio automatico sul server.
import { normalizza } from '../core/modello.js';
import { oggi as oggiIn } from '../core/date.js';
import { api, cache, ricorda } from './api.js';
import { toast } from './ui.js';

export const S = {
  token: null,          // token del link aperto
  tipo: 'b',            // 'b' = link di modifica, 'v' = sola lettura
  permesso: null,       // 'modifica' | 'lettura'
  dati: null,           // bacheca normalizzata
  versione: 0,
  lettura: null,        // token di sola lettura (solo per chi può modificare)
  vista: 'oggi',
  param: '',
  bozza: null,          // promemoria in modifica (copia)
  ui: {},               // stato temporaneo dell'interfaccia
  salvataggio: 'ok',    // ok | attesa | invio | errore | offline
  offline: false,
};

let ridisegna = () => {};
export const suRidisegna = (fn) => { ridisegna = fn; };
export const render = () => ridisegna();

export const puoModificare = () => S.permesso === 'modifica' && !S.offline;
export const oggi = () => oggiIn(S.dati?.fusoOrario);

/* ---------- salvataggio con attesa (debounce) e controllo dei conflitti ---------- */
let timer = null, inVolo = false, ancora = false;

export function modifica(fn, { subito = false } = {}) {
  if (!puoModificare()) { toast('Questa bacheca è in sola lettura.'); return; }
  const copia = structuredClone(S.dati);
  fn(copia);
  S.dati = normalizza(copia, oggi());
  S.salvataggio = 'attesa';
  salvaCache();
  clearTimeout(timer);
  timer = setTimeout(invia, subito ? 0 : 700);
  render();
}

async function invia() {
  if (inVolo) { ancora = true; return; }
  inVolo = true; ancora = false;
  S.salvataggio = 'invio'; aggiornaIndicatore();
  try {
    const r = await api.salva(S.token, S.versione, S.dati);
    if (r.stato === 409) {
      S.dati = normalizza(r.dati); S.versione = r.versione;
      toast('Qualcun altro ha modificato la bacheca nello stesso momento: ho caricato la sua versione. Ripeti l\'ultima modifica.', 6000);
      render();
    } else {
      S.versione = r.versione;
    }
    S.salvataggio = 'ok';
    salvaCache();
  } catch (e) {
    S.salvataggio = e.offline ? 'offline' : 'errore';
    clearTimeout(timer);
    timer = setTimeout(invia, 8000); // riprova da solo
  } finally {
    inVolo = false;
    aggiornaIndicatore();
    if (ancora) invia();
  }
}

export const inSospeso = () => S.salvataggio !== 'ok' || inVolo;

export function salvaCache() {
  if (S.token) cache(S.token, { dati: S.dati, versione: S.versione, permesso: S.permesso, lettura: S.lettura });
}

export function aggiornaIndicatore() {
  const el = document.getElementById('statoSalvataggio');
  if (!el) return;
  const testi = {
    ok: S.permesso === 'lettura' ? '👀 Sola lettura' : '✓ Salvato',
    attesa: 'Salvataggio…', invio: 'Salvataggio…',
    errore: '⚠ Non salvato, riprovo…', offline: '⚠ Senza connessione, riprovo…',
  };
  el.textContent = S.token ? (S.offline ? '⚠ Offline: ultima versione salvata' : testi[S.salvataggio]) : '';
  el.classList.toggle('errore', S.offline || S.salvataggio === 'errore' || S.salvataggio === 'offline');
}

/* ---------- apertura di una bacheca ---------- */
export async function apri(token, tipo) {
  S.token = token; S.tipo = tipo;
  const c = cache(token);
  if (c?.dati) {
    Object.assign(S, { dati: normalizza(c.dati), versione: c.versione, permesso: c.permesso, lettura: c.lettura });
    render();
  }
  try {
    const r = await api.leggi(token);
    Object.assign(S, { dati: normalizza(r.dati), versione: r.versione, permesso: r.permesso, lettura: r.lettura ?? null, offline: false });
    salvaCache();
    ricorda({ token, nome: S.dati.nome, permesso: S.permesso });
  } catch (e) {
    if (e.offline && c?.dati) S.offline = true;
    else { S.dati = null; S.errore = e.message; }
  }
  render();
}

/** Ricarica dal server se nel frattempo qualcuno ha cambiato qualcosa (es. al ritorno sull'app). */
export async function ricarica() {
  if (!S.token || inSospeso() || S.bozza) return;
  try {
    const r = await api.leggi(S.token);
    if (r.versione !== S.versione || S.offline) {
      Object.assign(S, { dati: normalizza(r.dati), versione: r.versione, permesso: r.permesso, lettura: r.lettura ?? null, offline: false });
      salvaCache();
      render();
    }
  } catch { /* resta com'è */ }
}
