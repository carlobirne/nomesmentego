// Editor di un promemoria in 3 passi: Cosa, Quando, Avvisi.
// Lavora su una copia (S.bozza): niente viene salvato finché non si preme "Salva".
import { S, modifica, render, oggi } from './stato.js';
import { esc, toast, testoSu, COLORI } from './ui.js';
import { sceltaIcone } from './viste.js';
import { normalizza, nuovoId, SCADENZA_OGNI } from '../core/modello.js';
import { riassunto, prossime, settimanaDi, descriviQuando, nomiVoci, ogniGiorni } from '../core/motore.js';
import { GIORNI, GIORNI_NOMI, MESI_NOMI, lunediDi, piuGiorni, fmtGiorno, fmt, valida } from '../core/date.js';

// "Giorni speciali" (festività, recuperi…) per ora è nascosto: si vede solo se un promemoria ne ha già,
// così si possono togliere. Per riaccenderlo basta mettere true.
const GIORNI_SPECIALI = false;

const TIPI = [
  ['una-volta', 'Giorni specifici'], ['giornaliero', 'Ogni giorno'], ['settimanale', 'Ogni settimana'],
  ['rotazione', 'Settimane con voci'], ['mensile', 'Ogni mese'], ['annuale', 'Ogni anno'],
];
const PRESET_AVVISI = [
  ['0-giorni', 'Il giorno stesso'], ['1-giorni', 'Il giorno prima'], ['2-giorni', '2 giorni prima'], ['3-giorni', '3 giorni prima'],
  ['1-settimane', 'Una settimana prima'], ['2-settimane', '2 settimane prima'], ['20-giorni', '20 giorni prima'],
  ['1-mesi', 'Un mese prima'], ['2-mesi', '2 mesi prima'],
];

/** Apre l'editor per un promemoria esistente (copia) o restituisce false se non esiste. */
export function apriEditor(id) {
  if (S.bozza?.id === id) return true;
  const p = S.dati.promemoria.find((x) => x.id === id);
  if (!p) return false;
  S.bozza = structuredClone(p);
  S.bozzaNuova = false;
  S.ui.settSel = 0;
  return true;
}
export const chiudiEditor = () => { S.bozza = null; S.ui.conferma = null; };

/** Normalizza la bozza dopo una modifica strutturale (mantiene la coerenza dei dati). */
function sistema() {
  S.bozza = normalizza({ versione: 2, gruppi: S.dati.gruppi, promemoria: [S.bozza] }, oggi()).promemoria[0];
}

function aggiornaRiassunto() {
  const el = document.getElementById('riassunto');
  if (el) el.innerHTML = riassuntoHTML();
}
function riassuntoHTML() {
  const p = S.bozza;
  const prox = prossime(p, oggi(), 3);
  return '<div>' + esc(riassunto(p)) + '</div>' +
    (prox.length ? '<div class="small" style="margin-top:6px;font-weight:400">Prossime date: ' + prox.map((o) => esc(fmtGiorno(o.data) + (o.data.slice(0, 4) !== oggi().slice(0, 4) ? ' ' + o.data.slice(0, 4) : '')) + (o.voci.length ? ' (' + esc(nomiVoci(p, o.voci).join(', ')) + ')' : '')).join(' · ') + '</div>'
      : '<div class="small" style="margin-top:6px;font-weight:400">Nessuna data in arrivo con queste impostazioni.</div>');
}

/* ---------- vista ---------- */
export function vistaEditor() {
  const p = S.bozza, q = p.quando;
  let h = '<section class="card"><div class="passo"><span class="n">1</span><h2>Cosa</h2></div><div class="stack">' +
    '<label class="field">Nome del promemoria<input type="text" class="grande" data-bind="titolo" value="' + esc(p.titolo) + '" placeholder="es. Mercato in piazza" maxlength="80"></label>' +
    '<div><div class="small" style="font-weight:700;margin-bottom:6px">Disegno</div>' + sceltaIcone(p.icona, 'ed-icona') + '</div>' +
    '<div class="row end"><label class="field">Gruppo<span class="aiuto">Per tenere insieme le cose: un\'auto, la casa…</span><select data-bind="gruppo"><option value="">Nessun gruppo</option>' +
    S.dati.gruppi.map((g) => '<option value="' + esc(g.id) + '"' + (g.id === p.gruppo ? ' selected' : '') + '>' + esc(g.nome) + '</option>').join('') +
    '<option value="__nuovo">+ Nuovo gruppo…</option></select></label></div>' +
    '<label class="field">Nota (facoltativa)<span class="aiuto">Compare nel calendario: istruzioni, numeri utili, targa…</span><textarea data-bind="nota" maxlength="2000">' + esc(p.nota) + '</textarea></label>' +
    '</div></section>';

  h += '<section class="card"><div class="passo"><span class="n">2</span><h2>Quando succede</h2></div>' +
    '<div class="scelte" role="group" aria-label="Tipo di ripetizione">' +
    TIPI.map(([t, n]) => '<button data-act="ed-tipo" data-v="' + t + '" aria-pressed="' + (q.tipo === t) + '">' + n + '</button>').join('') + '</div>' +
    '<div style="margin-top:14px">' + editorQuando(p) + '</div>' + editorScadenza(p) + '</section>';

  h += '<section class="card"><div class="passo"><span class="n">3</span><h2>Quando avvisarti</h2></div>';
  h += editorAvvisi(p) + '</section>';

  if (q.tipo !== 'una-volta' && (GIORNI_SPECIALI || p.eccezioni.length)) h += editorEccezioni(p);

  h += '<section class="card"><div class="riassunto" id="riassunto" aria-live="polite">' + riassuntoHTML() + '</div>';
  if (!S.bozzaNuova) {
    h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="ed-pausa">' + (p.pausa ? 'Riattiva' : 'Metti in pausa') + '</button>' +
      '<button class="btn" data-act="ed-duplica">Duplica</button>' +
      (S.ui.conferma === 'del' ? '<button class="btn danger" data-act="ed-elimina-ok">Conferma: elimina</button>' : '<button class="btn danger" data-act="ed-elimina">Elimina</button>') + '</div>';
  }
  h += '</section><div class="barra-salva"><button class="btn primary big" data-act="ed-salva">' + (S.bozzaNuova ? 'Salva il promemoria' : 'Salva le modifiche') + '</button><button class="btn ghost big" data-act="ed-annulla">Annulla</button></div>';
  return h;
}

function editorQuando(p) {
  const q = p.quando;
  switch (q.tipo) {
    case 'una-volta':
      return '<p class="muted small" style="margin-top:0">Scegli le date una per una: puoi aggiungerne quante vuoi.</p>' +
        q.date.map((d, i) => '<div class="riga-ed compatta"><input type="date" data-bind="q-data" data-i="' + i + '" value="' + d + '" aria-label="Data ' + (i + 1) + '" style="flex:1 1 160px;width:auto">' +
          (q.date.length > 1 ? '<button class="btn danger piccolo" data-act="ed-data-del" data-i="' + i + '">Togli</button>' : '') + '</div>').join('') +
        '<button class="btn piccolo" data-act="ed-data-add" style="margin-top:6px">+ Aggiungi un giorno</button>';
    case 'giornaliero':
      return '<div class="row end"><label class="field stretto">Ogni quanti giorni<select data-bind="q-ogni">' +
        [1, 2, 3, 4, 5, 6, 7, 10, 14, 15, 30].map((n) => '<option value="' + n + '"' + (n === q.ogni ? ' selected' : '') + '>' + (n === 1 ? 'ogni giorno' : 'ogni ' + n + ' giorni') + '</option>').join('') + '</select></label>' +
        '<label class="field">A partire dal<input type="date" data-bind="q-inizio" value="' + q.inizio + '"></label></div>';
    case 'settimanale':
      return '<div class="small" style="font-weight:700;margin-bottom:6px">In quali giorni?</div><div class="giorni-sett" role="group" aria-label="Giorni della settimana">' +
        GIORNI.map((g, i) => '<button data-act="ed-giorno" data-v="' + g + '" aria-pressed="' + q.giorni.includes(g) + '" aria-label="' + GIORNI_NOMI[i] + '">' + g.slice(0, 1).toUpperCase() + g.slice(1, 3) + '</button>').join('') + '</div>' +
        '<div class="row end" style="margin-top:12px"><label class="field">Quante volte<select data-bind="q-ogni">' +
        [[1, 'Tutte le settimane'], [2, 'Una settimana sì e una no'], [3, 'Ogni 3 settimane'], [4, 'Ogni 4 settimane']].map(([n, t]) => '<option value="' + n + '"' + (n === q.ogni ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
        (q.ogni > 1 ? '<label class="field">Una delle settimane giuste è quella del<input type="date" data-bind="q-inizio" value="' + q.inizio + '"></label>' : '') + '</div>';
    case 'rotazione':
      return editorRotazione(p);
    case 'mensile':
      return '<div class="scelte" role="group" aria-label="Come"><button data-act="ed-mensile-modo" data-v="giorno" aria-pressed="' + (q.modo === 'giorno') + '">Giorni fissi</button>' +
        '<button data-act="ed-mensile-modo" data-v="settimana" aria-pressed="' + (q.modo === 'settimana') + '">Es. il primo lunedì</button></div>' +
        (q.modo === 'giorno' ? editorGiorniMese(q) : '') +
        '<div class="row end" style="margin-top:12px">' +
        (q.modo === 'giorno' ? ''
          : '<label class="field stretto">Quale<select data-bind="q-n">' + [[1, 'Il primo'], [2, 'Il secondo'], [3, 'Il terzo'], [4, 'Il quarto'], [-1, "L'ultimo"]].map(([n, t]) => '<option value="' + n + '"' + (n === q.n ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
            '<label class="field stretto">Giorno<select data-bind="q-giornoSett">' + GIORNI.map((g, i) => '<option value="' + g + '"' + (g === q.giornoSett ? ' selected' : '') + '>' + GIORNI_NOMI[i] + '</option>').join('') + '</select></label>') +
        '<label class="field stretto">Ogni<select data-bind="q-ogni">' + [1, 2, 3, 4, 6, 12].map((n) => '<option value="' + n + '"' + (n === q.ogni ? ' selected' : '') + '>' + (n === 1 ? 'mese' : n + ' mesi') + '</option>').join('') + '</select></label>' +
        (q.ogni > 1 ? '<label class="field">A partire dal<input type="date" data-bind="q-inizio" value="' + q.inizio + '"></label>' : '') + '</div>';
    case 'annuale':
      return '<div class="row end"><label class="field stretto">Giorno<select data-bind="q-giorno">' + Array.from({ length: 31 }, (_, i) => i + 1).map((n) => '<option value="' + n + '"' + (n === q.giorno ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
        '<label class="field">Mese<select data-bind="q-mese">' + MESI_NOMI.map((m, i) => '<option value="' + (i + 1) + '"' + (i + 1 === q.mese ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>' +
        '<label class="field stretto">Ogni<select data-bind="q-ogni">' + [1, 2, 3, 4, 5, 10].map((n) => '<option value="' + n + '"' + (n === q.ogni ? ' selected' : '') + '>' + (n === 1 ? 'anno' : n + ' anni') + '</option>').join('') + '</select></label>' +
        (q.ogni > 1 ? '<label class="field stretto">A partire dal<input type="number" min="2000" max="2100" data-bind="q-anno" value="' + q.inizio.slice(0, 4) + '"></label>' : '') + '</div>' +
        (q.giorno > 28 ? '<p class="small muted" style="margin:8px 0 0">Se il mese è più corto vale l\'ultimo giorno del mese.</p>' : '');
  }
  return '';
}

/** Ogni mese, giorni fissi: 1..31 più "Fine mese", che si adatta alla lunghezza del mese. */
function editorGiorniMese(q) {
  const tasto = (g, testo, extra = '') => '<button data-act="ed-mese-giorno" data-v="' + g + '" aria-pressed="' + q.giorni.includes(g) + '"' + extra + '>' + testo + '</button>';
  let h = '<div class="small" style="font-weight:700;margin:14px 0 6px">Quali giorni del mese?</div><div class="giorni-mese" role="group" aria-label="Giorni del mese">' +
    Array.from({ length: 31 }, (_, i) => tasto(i + 1, i + 1)).join('') + tasto(-1, 'Fine mese', ' class="fine-mese"') + '</div>';
  const lunghi = q.giorni.filter((g) => g > 28);
  if (lunghi.length && !q.giorni.includes(-1)) {
    h += '<div class="notice small" style="margin-top:10px">Il ' + lunghi.join(', il ') + ' non c\'è in tutti i mesi: in quei mesi l\'avviso non arriva. ' +
      'Se vuoi l\'ultimo giorno di ogni mese, aggiungi <b>Fine mese</b>: si adatta da solo a mesi di 28, 30 o 31 giorni.' +
      '<div class="row" style="margin-top:8px"><button class="btn piccolo" data-act="ed-mese-giorno" data-v="-1">+ Aggiungi Fine mese</button></div></div>';
  }
  return h;
}

/** Opzione "Scadenza": vale per qualsiasi ripetizione. */
function editorScadenza(p) {
  const s = p.scadenza;
  return '<div class="scadenza-opzione' + (s.attiva ? ' attiva' : '') + '">' +
    '<label class="check"><input type="checkbox" data-bind="scadenza-attiva"' + (s.attiva ? ' checked' : '') + '> Scadenza</label>' +
    '<div class="row" style="gap:8px;margin-top:2px"><span>si riceverà un avviso</span>' +
    '<select data-bind="scadenza-ogni" aria-label="Ogni quanti giorni"' + (s.attiva ? '' : ' disabled') + ' style="width:auto;min-width:0;flex:0 0 auto">' +
    SCADENZA_OGNI.map((n) => '<option value="' + n + '"' + (n === s.ogni ? ' selected' : '') + '>' + ogniGiorni(n) + '</option>').join('') + '</select>' +
    '<span>passata la scadenza finché non si preme <b>Fatto</b>.</span></div>' +
    (s.attiva ? '<p class="small muted" style="margin:8px 0 0">"Fatto" si preme nella schermata Oggi, accanto al promemoria in "I prossimi promemoria" (o dal messaggio Telegram). Se lo premi in anticipo, gli avvisi di quella data non arrivano più.</p>' : '') +
    '</div>';
}

function editorRotazione(p) {
  const q = p.quando, t = oggi();
  const sel = Math.min(S.ui.settSel ?? 0, q.settimane.length - 1);
  const w = q.settimane[sel];
  let h = '<p class="muted small">Per esempio: 2 settimane che si alternano, settimana A e settimana B. Se ti serve, aggiungi <b>voci</b> (per differenziare gli avvisi) e scegli quali voci associare ai giorni. Se vuoi una sola settimana con le voci, basta togliere l\'altra.</p>';
  // voci
  h += '<details class="altro"' + (p.voci.length ? ' open' : '') + '><summary>Voci (' + p.voci.length + ')</summary>';
  p.voci.forEach((v, i) => {
    h += '<div class="riga-ed compatta"><input type="color" data-bind="voce-colore" data-i="' + i + '" value="' + v.colore + '" aria-label="Colore di ' + esc(v.nome) + '">' +
      '<input type="text" data-bind="voce-nome" data-i="' + i + '" value="' + esc(v.nome) + '" aria-label="Nome della voce" style="flex:1 1 120px;width:auto">' +
      '<button class="btn danger piccolo" data-act="ed-voce-del" data-i="' + i + '">Elimina</button></div>';
  });
  h += '<button class="btn piccolo" data-act="ed-voce-add" style="margin-top:6px">+ Aggiungi voce</button></details>';
  // settimane
  h += '<div class="week-tabs" role="group" aria-label="Scegli la settimana" style="margin-top:14px">' +
    q.settimane.map((x, i) => '<button data-act="ed-sett" data-i="' + i + '" aria-pressed="' + (i === sel) + '">' + esc(x.nome) + (i === settimanaDi(q, t) ? ' • questa' : '') + '</button>').join('') +
    (q.settimane.length < 12 ? '<button data-act="ed-sett-add" aria-label="Aggiungi una settimana">+</button>' : '') + '</div>';
  h += '<div class="row end" style="margin-top:10px"><label class="field">Nome della settimana<input type="text" data-bind="sett-nome" value="' + esc(w.nome) + '" maxlength="40"></label>' +
    (q.settimane.length > 1 ? (S.ui.conferma === 'sett' ? '<button class="btn danger" data-act="ed-sett-del-ok">Conferma</button>' : '<button class="btn danger" data-act="ed-sett-del">Elimina settimana</button>') : '') + '</div>';
  GIORNI.forEach((k, i) => {
    const v = w.giorni[k];
    h += '<div class="dayrow"><div class="dn">' + GIORNI_NOMI[i] + '</div><div class="chips">';
    if (!p.voci.length) {
      h += '<button class="chip" data-act="ed-rot-giorno" data-k="' + k + '" aria-pressed="' + (v === true) + '">' + (v === true ? 'Sì' : 'No') + '</button>';
    } else {
      p.voci.forEach((x) => {
        const on = Array.isArray(v) && v.includes(x.id);
        h += '<button class="chip" data-act="ed-rot-voce" data-k="' + k + '" data-v="' + esc(x.id) + '" aria-pressed="' + on + '" style="' + (on ? 'background:' + x.colore + ';color:' + testoSu(x.colore) : '') + '"><span class="dot" style="background:' + x.colore + '"></span>' + esc(x.nome) + '</button>';
      });
    }
    h += '</div></div>';
  });
  if (q.settimane.length > 1) {
    h += '<label class="field" style="margin-top:12px">Questa settimana (dal lunedì ' + fmt(lunediDi(t)) + ') è la<select data-bind="sett-attuale">' +
      q.settimane.map((x, i) => '<option value="' + i + '"' + (i === settimanaDi(q, t) ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>';
  }
  return h;
}

function editorAvvisi(p) {
  let h = '<p class="muted small">Ogni avviso diventa un promemoria sul calendario del telefono, all\'ora che scegli. Puoi impostare anche più orari diversi.</p>';
  if (!p.avvisi.length) h += '<p class="notice small">Nessun avviso: il promemoria si vedrà nell\'app e nel calendario, ma senza notifica.</p>';
  const voci = p.voci.map((v) => v.nome);
  p.avvisi.forEach((a, i) => {
    const chiave = a.prima + '-' + a.unita;
    const preset = PRESET_AVVISI.some(([v]) => v === chiave);
    h += '<div class="riga-ed avviso-ed">' + (p.avvisi.length > 1 ? '<div class="avviso-n">Avviso ' + (i + 1) + '</div>' : '') +
      '<label class="field">Quando<select data-bind="avv-quando" data-i="' + i + '">' +
      PRESET_AVVISI.map(([v, t]) => '<option value="' + v + '"' + (v === chiave ? ' selected' : '') + '>' + t + '</option>').join('') +
      (!preset ? '<option value="' + chiave + '" selected>' + a.prima + ' ' + a.unita + ' prima</option>' : '') +
      '<option value="altro">Altro…</option></select></label>' +
      (S.ui.avvAltro === i || !preset ? '<label class="field stretto">Quanti<input type="number" min="0" max="400" data-bind="avv-prima" data-i="' + i + '" value="' + a.prima + '"></label>' +
        '<label class="field stretto">Cosa<select data-bind="avv-unita" data-i="' + i + '">' + ['giorni', 'settimane', 'mesi'].map((u) => '<option' + (u === a.unita ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></label>' : '') +
      '<label class="field stretto">Ora<input type="time" data-bind="avv-ora" data-i="' + i + '" value="' + a.ora + '"></label>' +
      '<button class="btn danger piccolo" data-act="ed-avv-del" data-i="' + i + '" aria-label="Togli questo avviso">Togli</button>' +
      '<label class="field" style="flex-basis:100%">Testo dell\'avviso <span class="aiuto">' + (i > 0 ? '(facoltativo, come sopra)' :
        '(facoltativo: se vuoto uso il nome del promemoria; puoi usare le voci definite per questo promemoria scrivendo {voci}' +
        (voci.length ? ', cioè ' + esc(voci.join(', ')) : '') + '). Es. con le voci Tachipirina e Vitamina D, «Prendi {voci} dopo colazione» diventa «Prendi Tachipirina, Vitamina D dopo colazione».') + '</span>' +
      '<input type="text" data-bind="avv-testo" data-i="' + i + '" value="' + esc(a.testo) + '" placeholder="' + (voci.length ? 'es. Prendi {voci} dopo colazione' : 'es. Non parcheggiare in piazza stasera') + '" maxlength="140"></label></div>';
  });
  if (p.avvisi.length < 6) h += '<button class="btn" data-act="ed-avv-add" style="margin-top:8px">+ Aggiungi ' + (p.avvisi.length ? 'un altro avviso' : 'un avviso') + '</button>';
  return h;
}

function editorEccezioni(p) {
  const t = oggi();
  const lista = p.eccezioni.map((e, i) => ({ e, i })).sort((a, b) => a.e.data.localeCompare(b.e.data));
  let h = '<section class="card"><details class="altro" style="border:none;margin:0;padding:0"' + (p.eccezioni.length ? ' open' : '') + '><summary><h2 style="margin:0">Giorni speciali (' + p.eccezioni.length + ')</h2></summary>' +
    '<p class="muted small">Festività, recuperi, un giorno in più o in meno.</p>';
  for (const { e, i } of lista) {
    const passato = e.data < t && !(e.nuovaData && e.nuovaData >= t);
    h += '<div class="riga-ed"' + (passato ? ' style="opacity:.6"' : '') + '><label class="field">Giorno<input type="date" data-bind="ecc-data" data-i="' + i + '" value="' + e.data + '"></label>' +
      '<label class="field">Cosa succede<select data-bind="ecc-azione" data-i="' + i + '"><option value="annulla"' + (e.azione === 'annulla' ? ' selected' : '') + '>Quel giorno no</option>' +
      '<option value="sposta"' + (e.azione === 'sposta' ? ' selected' : '') + '>Si sposta a un altro giorno</option><option value="aggiungi"' + (e.azione === 'aggiungi' ? ' selected' : '') + '>Un giorno in più</option></select></label>' +
      (e.azione === 'sposta' ? '<label class="field">Nuovo giorno<input type="date" data-bind="ecc-nuova" data-i="' + i + '" value="' + e.nuovaData + '"></label>' : '');
    if (p.voci.length) {
      h += '<div style="flex-basis:100%"><div class="small" style="font-weight:700;margin-bottom:6px">Solo per ' + (e.azione === 'aggiungi' ? '(scegline almeno una)' : '(nessuna = tutte)') + '</div><div class="chips">' +
        p.voci.map((v) => { const on = e.voci.includes(v.id); return '<button class="chip" data-act="ed-ecc-voce" data-i="' + i + '" data-v="' + esc(v.id) + '" aria-pressed="' + on + '" style="' + (on ? 'background:' + v.colore + ';color:' + testoSu(v.colore) : '') + '">' + esc(v.nome) + '</button>'; }).join('') + '</div></div>';
    }
    h += '<label class="field">Nota<input type="text" data-bind="ecc-nota" data-i="' + i + '" value="' + esc(e.nota) + '" placeholder="es. Capodanno" maxlength="140"></label>' +
      '<button class="btn danger piccolo" data-act="ed-ecc-del" data-i="' + i + '">Togli</button></div>';
  }
  if (GIORNI_SPECIALI) h += '<button class="btn" data-act="ed-ecc-add" style="margin-top:8px">+ Aggiungi un giorno speciale</button>';
  h += '</details></section>';
  return h;
}

/* ---------- azioni ---------- */
const giorniVuoti = () => ({});
export const AZIONI_EDITOR = {
  'ed-icona'(el) { S.bozza.icona = S.bozza.icona === el.dataset.v ? '' : el.dataset.v; render(); },
  'ed-tipo'(el) {
    const t = el.dataset.v, p = S.bozza, oggiISO = oggi();
    if (p.quando.tipo === t) return;
    const prima = p.quando;
    const giorno = prima.data || prima.inizio || oggiISO;
    const base = {
      'una-volta': { date: [giorno] }, 'giornaliero': { inizio: oggiISO },
      'settimanale': { giorni: prima.tipo === 'rotazione' ? [] : [GIORNI[(new Date().getDay() + 6) % 7]] },
      'rotazione': { inizio: lunediDi(oggiISO), settimane: [{ nome: 'Settimana A', giorni: giorniVuoti() }, { nome: 'Settimana B', giorni: giorniVuoti() }] },
      'mensile': { modo: 'giorno', giorni: [+giorno.slice(8, 10)], inizio: oggiISO },
      'annuale': { mese: +giorno.slice(5, 7), giorno: +giorno.slice(8, 10), ogni: 1, inizio: giorno },
    }[t];
    p.quando = { tipo: t, ...base };
    if (prima.tipo === 'settimanale' && t === 'rotazione') { // porta i giorni già scelti in tutte le settimane
      for (const s of p.quando.settimane) for (const g of prima.giorni) s.giorni[g] = true;
    }
    sistema(); render();
  },
  'ed-giorno'(el) {
    const g = S.bozza.quando.giorni, v = el.dataset.v;
    S.bozza.quando.giorni = g.includes(v) ? g.filter((x) => x !== v) : GIORNI.filter((x) => x === v || g.includes(x));
    render();
  },
  'ed-mensile-modo'(el) { S.bozza.quando.modo = el.dataset.v; render(); },
  'ed-sett'(el) { S.ui.settSel = +el.dataset.i; S.ui.conferma = null; render(); },
  'ed-sett-add'() {
    const s = S.bozza.quando.settimane;
    s.push({ nome: 'Settimana ' + String.fromCharCode(65 + s.length), giorni: structuredClone(s[s.length - 1].giorni) });
    S.ui.settSel = s.length - 1; render();
  },
  'ed-sett-del'() { S.ui.conferma = 'sett'; render(); },
  'ed-sett-del-ok'() { S.bozza.quando.settimane.splice(S.ui.settSel, 1); S.ui.settSel = 0; S.ui.conferma = null; render(); },
  'ed-rot-giorno'(el) {
    const g = S.bozza.quando.settimane[S.ui.settSel ?? 0].giorni, k = el.dataset.k;
    if (g[k] === true) delete g[k]; else g[k] = true;
    render();
  },
  'ed-rot-voce'(el) {
    const g = S.bozza.quando.settimane[S.ui.settSel ?? 0].giorni, k = el.dataset.k, v = el.dataset.v;
    const l = Array.isArray(g[k]) ? g[k] : [];
    g[k] = l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
    if (!g[k].length) delete g[k];
    render();
  },
  'ed-voce-add'() {
    const p = S.bozza;
    if (!p.voci.length) for (const s of p.quando.settimane) for (const k of Object.keys(s.giorni)) delete s.giorni[k];
    p.voci.push({ id: nuovoId('v'), nome: 'Nuova voce', colore: COLORI[p.voci.length % COLORI.length], nota: '' });
    render();
  },
  'ed-voce-del'(el) { S.bozza.voci.splice(+el.dataset.i, 1); sistema(); render(); },
  'ed-avv-add'() {
    const av = S.bozza.avvisi;
    if (av.length >= 6) { toast('Al massimo 6 avvisi.'); return; }
    // il primo: il giorno stesso alle 8; i successivi: la sera prima alle 21 (se non c'è già)
    const c = av.some((a) => a.prima === 0) ? { prima: 1, unita: 'giorni', ora: '21:00' } : { prima: 0, unita: 'giorni', ora: '08:00' };
    if (av.length && av.some((a) => a.prima === c.prima && a.unita === c.unita)) c.ora = '12:00';
    av.push({ ...c, testo: '' });
    S.ui.avvAltro = null;
    render();
  },
  'ed-data-add'() {
    const q = S.bozza.quando;
    if (q.date.length >= 200) { toast('Al massimo 200 date.'); return; }
    const ultima = q.date[q.date.length - 1];
    q.date.push(piuGiorni(ultima > oggi() ? ultima : oggi(), 1));
    render();
  },
  'ed-data-del'(el) { const q = S.bozza.quando; if (q.date.length > 1) q.date.splice(+el.dataset.i, 1); q.data = q.date[0]; render(); },
  'ed-mese-giorno'(el) {
    const q = S.bozza.quando, g = +el.dataset.v;
    if (q.giorni.includes(g)) { if (q.giorni.length > 1) q.giorni = q.giorni.filter((x) => x !== g); else toast('Serve almeno un giorno.'); } else q.giorni.push(g);
    q.giorni.sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b));
    render();
  },
  'ed-avv-del'(el) { S.bozza.avvisi.splice(+el.dataset.i, 1); S.ui.avvAltro = null; render(); },
  'ed-ecc-add'() {
    S.bozza.eccezioni.push({ id: nuovoId('e'), data: piuGiorni(oggi(), 1), azione: 'annulla', nuovaData: '', voci: [], nota: '' });
    render();
  },
  'ed-ecc-del'(el) { S.bozza.eccezioni.splice(+el.dataset.i, 1); render(); },
  'ed-ecc-voce'(el) {
    const e = S.bozza.eccezioni[+el.dataset.i], v = el.dataset.v;
    e.voci = e.voci.includes(v) ? e.voci.filter((x) => x !== v) : [...e.voci, v];
    render();
  },
  'ed-pausa'() { S.bozza.pausa = !S.bozza.pausa; render(); },
  'ed-duplica'() {
    const copia = { ...structuredClone(S.bozza), id: nuovoId('p'), titolo: S.bozza.titolo + ' (copia)' };
    S.bozza = copia; S.bozzaNuova = true;
    location.hash = '#modifica/' + copia.id;
    toast('Copia creata: modificala e salva.');
  },
  'ed-elimina'() { S.ui.conferma = 'del'; render(); },
  'ed-elimina-ok'() {
    const id = S.bozza.id;
    chiudiEditor();
    modifica((d) => { d.promemoria = d.promemoria.filter((x) => x.id !== id); }, { subito: true });
    toast('Promemoria eliminato.');
    location.hash = '#promemoria';
  },
  'ed-annulla'() { chiudiEditor(); history.length > 1 ? history.back() : (location.hash = '#promemoria'); },
  'ed-salva'() {
    const p = S.bozza;
    if (!p.titolo.trim() || p.titolo === 'Promemoria') { toast('Dai un nome al promemoria.'); document.querySelector('[data-bind="titolo"]')?.focus(); return; }
    if (p.quando.tipo === 'settimanale' && !p.quando.giorni.length) { toast('Scegli almeno un giorno della settimana.'); return; }
    if (p.quando.tipo === 'rotazione' && p.quando.settimane.every((s) => !Object.keys(s.giorni).length)) { toast('Scegli almeno un giorno in una delle settimane.'); return; }
    sistema();
    const salvato = S.bozza, nuovo = S.bozzaNuova;
    chiudiEditor();
    modifica((d) => {
      const i = d.promemoria.findIndex((x) => x.id === salvato.id);
      if (i >= 0) d.promemoria[i] = salvato; else d.promemoria.push(salvato);
    }, { subito: true });
    toast(nuovo ? 'Promemoria aggiunto.' : 'Modifiche salvate.');
    location.hash = '#promemoria';
  },
};

const q = () => S.bozza.quando;
export const LEGAMI_EDITOR = {
  'titolo'(el) { S.bozza.titolo = el.value; },
  'nota'(el) { S.bozza.nota = el.value; },
  'gruppo'(el) {
    if (el.value === '__nuovo') {
      const nome = prompt('Nome del nuovo gruppo (es. Panda, Casa al mare):');
      if (nome && nome.trim()) {
        const g = { id: nuovoId('g'), nome: nome.trim().slice(0, 40), icona: S.bozza.icona || 'casa', colore: COLORI[S.dati.gruppi.length % COLORI.length] };
        modifica((d) => d.gruppi.push(g));
        S.bozza.gruppo = g.id;
      }
      return true;
    }
    S.bozza.gruppo = el.value;
  },
  'scadenza-attiva'(el) {
    const s = S.bozza.scadenza;
    s.attiva = el.checked;
    // le date già passate non contano: si parte da adesso
    if (s.attiva) s.fattoFino = piuGiorni(oggi(), -1);
    return true;
  },
  'scadenza-ogni'(el) { S.bozza.scadenza.ogni = +el.value; return true; },
  'q-anno'(el) {
    const y = Math.round(+el.value);
    if (y >= 2000 && y <= 2100) q().inizio = y + q().inizio.slice(4);
    return true;
  },
  'q-data'(el) {
    if (!valida(el.value)) return;
    q().date[+el.dataset.i] = el.value;
    q().date = [...new Set(q().date)].sort(); q().data = q().date[0];
    return true;
  },
  'q-inizio'(el) { if (valida(el.value)) q().inizio = q().tipo === 'settimanale' ? lunediDi(el.value) : el.value; return true; },
  'q-ogni'(el) { q().ogni = +el.value; return true; },
  'q-giorno'(el) { q().giorno = +el.value; return true; },
  'q-n'(el) { q().n = +el.value; return true; },
  'q-giornoSett'(el) { q().giornoSett = el.value; return true; },
  'q-mese'(el) { q().mese = +el.value; return true; },
  'sett-nome'(el) { q().settimane[S.ui.settSel ?? 0].nome = el.value; },
  'sett-attuale'(el) {
    // sposta l'inizio del ciclo perché la settimana corrente sia quella scelta
    const t = oggi(), n = q().settimane.length;
    const att = settimanaDi(q(), t), voluta = +el.value;
    q().inizio = piuGiorni(q().inizio, ((att - voluta + n) % n) * 7);
    return true;
  },
  'voce-nome'(el) { S.bozza.voci[+el.dataset.i].nome = el.value; },
  'voce-colore'(el) { S.bozza.voci[+el.dataset.i].colore = el.value; return true; },
  'avv-quando'(el) {
    const a = S.bozza.avvisi[+el.dataset.i];
    if (el.value === 'altro') { S.ui.avvAltro = +el.dataset.i; return true; }
    const [prima, unita] = el.value.split('-');
    a.prima = +prima; a.unita = unita;
    if (a.prima === 1 && unita === 'giorni' && a.ora < '12:00') a.ora = '20:00';
    S.ui.avvAltro = null;
    return true;
  },
  'avv-prima'(el) { S.bozza.avvisi[+el.dataset.i].prima = Math.max(0, Math.min(400, +el.value || 0)); return true; },
  'avv-unita'(el) { S.bozza.avvisi[+el.dataset.i].unita = el.value; return true; },
  'avv-ora'(el) { if (/^\d\d:\d\d$/.test(el.value)) S.bozza.avvisi[+el.dataset.i].ora = el.value; },
  'avv-testo'(el) { S.bozza.avvisi[+el.dataset.i].testo = el.value; },
  'ecc-data'(el) { if (valida(el.value)) S.bozza.eccezioni[+el.dataset.i].data = el.value; return true; },
  'ecc-azione'(el) {
    const e = S.bozza.eccezioni[+el.dataset.i];
    e.azione = el.value;
    if (e.azione === 'sposta' && !e.nuovaData) e.nuovaData = piuGiorni(e.data, 1);
    return true;
  },
  'ecc-nuova'(el) { if (valida(el.value)) S.bozza.eccezioni[+el.dataset.i].nuovaData = el.value; return true; },
  'ecc-nota'(el) { S.bozza.eccezioni[+el.dataset.i].nota = el.value; },
};

/** Dopo un "input" senza ridisegno aggiorna solo la frase riassuntiva. */
export const dopoInput = aggiornaRiassunto;
export { descriviQuando };
