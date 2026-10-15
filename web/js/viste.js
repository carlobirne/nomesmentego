// Le schermate dell'app (tranne l'editor di un promemoria, in editor.js).
import { S, modifica, render, puoModificare, oggi } from './stato.js';
import { api, recenti, dimentica } from './api.js';
import { esc, attr, chip, toast, copia, condividi, scarica, caricaScript, testoSu, COLORI } from './ui.js';
import { icona, ICONE as DISEGNI, SCENE } from './disegni.js';
import { normalizza, nuovoId } from '../core/modello.js';
import { tuttiGliAvvisi, agenda, prossime, prossimaScadenza, segnaFatto, riassunto, settimanaDi, nomiVoci } from '../core/motore.js';
import { generaICS } from '../core/ics.js';
import { MODELLI, VOCI_AUTO, creaAuto, primaRevisione } from '../core/modelli.js';
import { piuGiorni, piuMesi, differenza, lunediDi, fmt, fmtAnno, fmtGiorno, fmtLungo, GIORNI, valida } from '../core/date.js';

/* ---------- utilità comuni ---------- */
export const gruppoDi = (p) => S.dati.gruppi.find((g) => g.id === p.gruppo);
export const iconaDi = (p) => p.icona || gruppoDi(p)?.icona || 'campanella';
const coloreDi = (p) => gruppoDi(p)?.colore || '#1f4aa8';

/** Fila di disegni tra cui scegliere. */
export function sceltaIcone(attiva, act, extra = '') {
  return '<div class="icone-pick" role="group" aria-label="Disegno">' + Object.entries(DISEGNI).map(([k, v]) =>
    '<button data-act="' + act + '" data-v="' + k + '"' + extra + ' aria-pressed="' + (attiva === k) + '" aria-label="' + esc(v.nome) + '" title="' + esc(v.nome) + '">' + icona(k) + '</button>').join('') + '</div>';
}
const origine = () => location.origin;
export const linkModifica = () => origine() + '/b/' + S.token;
const tokenLettura = () => (S.permesso === 'modifica' ? S.lettura : S.token);
export const linkLettura = () => origine() + '/v/' + tokenLettura();
const linkFeed = () => origine() + '/feed/' + tokenLettura() + '.ics';
const linkWebcal = () => linkFeed().replace(/^https?:/, 'webcal:');
const linkGoogle = () => 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(linkWebcal());

function occorrenzaHTML(p, o, { senzaTitolo = false } = {}) {
  const voci = (o.voci || []).map((id) => p.voci.find((v) => v.id === id)).filter(Boolean);
  let h = '<div class="riga-occ' + (o.voci === null ? ' annullata' : '') + '">';
  if (!senzaTitolo) h += icona(iconaDi(p), 'mini') + '<b>' + esc(p.titolo) + '</b>';
  h += voci.map((v) => chip(v.nome, v.colore)).join('') + '</div>';
  h += o.note.map((n) => '<div class="nota-ecc">' + esc(n) + '</div>').join('');
  return h;
}

function avvisoHTML(a) {
  const p = S.dati.promemoria.find((x) => x.id === a.promemoria);
  return '<div class="avviso"><div class="ora">' + esc(a.ora) + '</div><div><div class="testo">' + icona(iconaDi(p), 'mini') + '<span>' + esc(a.testo) + '</span></div>' +
    (a.occorrenza.voci?.length ? '<div class="chips" style="margin-top:6px">' + a.occorrenza.voci.map((id) => { const v = p.voci.find((x) => x.id === id); return v ? chip(v.nome, v.colore) : ''; }).join('') + '</div>' : '') +
    a.occorrenza.note.map((n) => '<div class="small" style="margin-top:4px">' + esc(n) + '</div>').join('') + '</div></div>';
}

/* ---------- pagina iniziale (nessuna bacheca aperta) ---------- */
export function vistaHome() {
  const r = recenti();
  let h = '<section class="card intro">' + SCENE.home + '<h1 class="motto">par non desmentegarse de niente</h1>' +
    '<p class="sottotitolo">Cosa, quando, ogni quanto?</p>' +
    '<p>I giorni della settimana di mercato, pagare il bollo, portare fuori la spazzatura, le medicine…: li imposti una volta e arrivano da soli sul calendario del telefono.</p>' +
    '<p class="muted small">Niente account e niente password: ogni bacheca ha il suo link segreto. Chi ha il link la vede e la modifica dal browser.</p></section>';
  h += '<section class="card"><h2>Crea una bacheca</h2><div class="stack">' +
    '<label class="field">Come la chiamiamo?<input type="text" id="nomeNuova" class="grande" placeholder="es. Casa di mamma" maxlength="60"></label>' +
    (S.ui.serveCodice ? '<label class="field">Codice di invito<span class="aiuto">Te lo dà chi ha installato l\'app.</span><input type="text" id="codiceNuova" autocomplete="off"></label>' : '') +
    '<button class="btn primary big" data-act="crea-bacheca">Crea la bacheca</button></div></section>';
  if (r.length) {
    h += '<section class="card"><h2>Le tue bacheche</h2><p class="muted small">Aperte di recente su questo telefono.</p><div class="stack">';
    for (const x of r) {
      h += '<div class="row"><a class="btn wide" style="flex:1;justify-content:flex-start" href="/' + (x.permesso === 'lettura' ? 'v' : 'b') + '/' + esc(x.token) + '">' +
        icona(x.permesso === 'lettura' ? 'occhio' : 'calendario', 'mini') + '<span>' + esc(x.nome) + (x.permesso === 'lettura' ? ' <span class="muted small">(sola lettura)</span>' : '') + '</span></a>' +
        '<button class="btn ghost piccolo" data-act="dimentica" data-token="' + esc(x.token) + '" aria-label="Togli ' + esc(x.nome) + ' da questo elenco">Togli</button></div>';
    }
    h += '</div></section>';
  }
  h += '<section class="card"><h2>Hai ricevuto un link?</h2><p class="muted">Aprilo e basta: la bacheca si apre qui e la ritrovi in questo elenco.</p></section>';
  return h;
}

export function vistaErrore() {
  return '<section class="card vuoto">' + SCENE.vuoto + '<h2>Bacheca non trovata</h2><p>' + esc(S.errore || 'Il link non è valido.') +
    '</p><p class="muted small">Se qualcuno ha cambiato il link della bacheca, chiedigli quello nuovo.</p><a class="btn primary" href="/">Vai alla pagina iniziale</a></section>';
}

/* ---------- Oggi ---------- */
export function vistaOggi() {
  const d = S.dati, t = oggi(), dom = piuGiorni(t, 1);
  let h = '';
  let nuova = null;
  try { nuova = sessionStorage.getItem('nms.nuova'); } catch { /* */ }
  if (nuova === S.token) {
    h += '<section class="card notice attenzione"><h2>La bacheca è pronta!</h2><p><b>Il link di questa pagina è la chiave</b>: salvalo (per esempio mandalo a te stesso su WhatsApp) e aggiungi la pagina alla schermata Home.</p>' +
      '<div class="row"><button class="btn primary" data-act="condividi" data-url="' + esc(linkModifica()) + '">Salva o manda il link</button><button class="btn" data-act="chiudi-benvenuto">Fatto</button></div></section>';
  }
  if (!d.promemoria.length) {
    return h + '<section class="card vuoto">' + SCENE.vuoto + '<h2>Nessun promemoria, per ora</h2><p class="muted">Cominciamo dal primo: la spazzatura, il mercato, la revisione dell\'auto…</p>' +
      (puoModificare() ? '<a class="btn primary big" href="#nuovo">Aggiungi un promemoria</a>' : '') + '</section>';
  }
  const avOggi = tuttiGliAvvisi(d, t, t), avDomani = tuttiGliAvvisi(d, dom, dom);
  const succede = agenda(d, t, t)[0]?.voci ?? [];
  h += '<section class="card hero" aria-live="polite">' + SCENE.oggi + '<div class="label">Oggi, ' + esc(fmtLungo(t)) + '</div>';
  if (avOggi.length) h += '<div class="grande">Da ricordare</div>' + avOggi.map(avvisoHTML).join('');
  else h += '<div class="grande">' + (succede.length ? 'Oggi succede' : 'Niente da ricordare') + '</div>';
  if (succede.length) {
    h += (avOggi.length ? '<div class="label" style="margin-top:12px">Succede oggi</div>' : '') +
      succede.map(({ p, o }) => occorrenzaHTML(p, o)).join('');
  }
  h += '</section>';

  h += '<section class="card"><h2>Domani, ' + esc(fmtLungo(dom)) + '</h2>';
  h += avDomani.length ? avDomani.map(avvisoHTML).join('') : '<p class="muted">Nessun avviso.</p>';
  h += '</section>';

  h += vistaScadenze(t);

  const prossimi = agenda(d, piuGiorni(t, 1), piuGiorni(t, 14));
  h += '<section class="card"><h2>Prossimi 14 giorni</h2>';
  if (!prossimi.length) h += '<p class="muted">Niente in programma.</p>';
  else {
    h += '<div class="list">' + prossimi.map((g) => '<div class="item"><div class="d">' + esc(fmtGiorno(g.data)) + '<span>' + esc(differenza(t, g.data) === 1 ? 'domani' : 'tra ' + differenza(t, g.data) + ' giorni') + '</span></div><div>' +
      g.voci.map(({ p, o }) => occorrenzaHTML(p, o)).join('') + '</div></div>').join('') + '</div>';
  }
  h += '</section>';
  return h;
}

function badgeScadenza(t, s) {
  const n = differenza(t, s);
  if (n < 0) return '<span class="badge rosso">Scaduta da ' + (-n) + (n === -1 ? ' giorno' : ' giorni') + '</span>';
  if (n === 0) return '<span class="badge rosso">Scade oggi</span>';
  const testo = n === 1 ? 'Domani' : n <= 60 ? 'Tra ' + n + ' giorni' : fmtAnno(s);
  return '<span class="badge ' + (n <= 7 ? 'rosso' : n <= 30 ? 'giallo' : n <= 60 ? 'verde' : 'grigio') + '">' + testo + '</span>';
}

function vistaScadenze(t) {
  const lista = S.dati.promemoria.filter((p) => p.quando.tipo === 'scadenza' && !p.pausa)
    .sort((a, b) => a.quando.scadenza.localeCompare(b.quando.scadenza));
  if (!lista.length) return '';
  let h = '<section class="card"><h2>Scadenze</h2>';
  for (const p of lista) {
    const q = p.quando;
    h += '<div class="scadenza">' + icona(iconaDi(p), 'medio') + '<div class="info"><div class="titolo">' + esc(p.titolo) + '</div>' +
      '<div class="small muted">Scade ' + esc(fmtAnno(q.scadenza)) + (q.ultimaVolta ? ' · fatto l\'ultima volta il ' + esc(fmtAnno(q.ultimaVolta)) : '') + '</div></div>' +
      badgeScadenza(t, q.scadenza) +
      (puoModificare() && S.ui.fatto !== p.id ? '<button class="btn piccolo" data-act="fatto-apri" data-id="' + esc(p.id) + '">Fatto</button>' : '');
    if (S.ui.fatto === p.id) {
      const il = S.ui.fattoIl || t;
      const prossima = S.ui.fattoProssima || prossimaScadenza(q, il) || '';
      h += '<div class="pannello"><div class="row end">' +
        '<label class="field">Quando l\'hai fatto?<input type="date" data-bind="fatto-il" value="' + esc(il) + '" max="' + esc(t) + '"></label>' +
        '<label class="field">Prossima scadenza<input type="date" data-bind="fatto-prossima" value="' + esc(prossima) + '"></label></div>' +
        (q.ripeti ? '<p class="small muted" style="margin:8px 0 0">Calcolata da sola: controllala sul documento (per esempio sul libretto o sulla polizza).</p>' : '<p class="small muted" style="margin:8px 0 0">Indica la prossima scadenza, se c\'è.</p>') +
        '<div class="row" style="margin-top:10px"><button class="btn primary" data-act="fatto-conferma">Conferma</button><button class="btn ghost" data-act="fatto-annulla">Annulla</button></div></div>';
    }
    h += '</div>';
  }
  return h + '</section>';
}

/* ---------- elenco promemoria ---------- */
export function vistaPromemoria() {
  const d = S.dati, t = oggi();
  let h = puoModificare() ? '<a class="btn primary big wide" href="#nuovo">+ Aggiungi un promemoria</a>' : '';
  if (!d.promemoria.length) return h + '<section class="card vuoto">' + SCENE.vuoto + '<p class="muted">Ancora nessun promemoria.</p></section>';
  const gruppi = [...d.gruppi.map((g) => ({ g, lista: d.promemoria.filter((p) => p.gruppo === g.id) })),
    { g: null, lista: d.promemoria.filter((p) => !p.gruppo) }].filter((x) => x.lista.length);
  for (const { g, lista } of gruppi) {
    if (gruppi.length > 1 || g) h += '<div class="gruppo-titolo">' + (g ? icona(g.icona, 'mini') + esc(g.nome) : 'Altri') + '</div>';
    for (const p of lista) {
      const pr = prossime(p, t, 1)[0];
      let extra = '';
      if (p.pausa) extra = 'In pausa';
      else if (p.quando.tipo === 'rotazione' && p.quando.settimane.length > 1) extra = 'Questa settimana: ' + p.quando.settimane[settimanaDi(p.quando, t)].nome;
      if (!p.pausa && pr && p.quando.tipo !== 'scadenza') extra += (extra ? ' · ' : '') + 'Prossima volta: ' + fmtGiorno(pr.data) + (pr.voci.length ? ' (' + nomiVoci(p, pr.voci).join(', ') + ')' : '');
      h += '<a class="prom' + (p.pausa ? ' pausa' : '') + '" href="#modifica/' + esc(p.id) + '">' + icona(iconaDi(p), 'medio') + '<span class="corpo">' +
        '<span class="titolo">' + esc(p.titolo) + '</span><br><span class="descr">' + esc(riassunto(p)) + '</span>' +
        (extra ? '<br><span class="descr"><b>' + esc(extra) + '</b></span>' : '') + '</span></a>';
    }
  }
  return h;
}

/* ---------- nuovo promemoria: scelta del modello ---------- */
export function vistaNuovo() {
  return '<section class="card"><h2>Cosa vuoi ricordare?</h2><p class="muted small">Scegli la cosa più simile: dopo puoi cambiare tutto.</p><div class="modelli">' +
    MODELLI.map((m) => '<button data-act="usa-modello" data-id="' + m.id + '">' + icona(m.icona, 'grande') + '<b>' + esc(m.nome) + '</b><span>' + esc(m.descrizione) + '</span></button>').join('') +
    '</div></section><a class="btn ghost" href="#promemoria">Indietro</a>';
}

/* ---------- modello Auto ---------- */
export function vistaAuto() {
  const a = S.ui.auto ??= { nome: '', icona: 'auto', colore: COLORI[0], scadenze: {}, preavviso: 20, immatricolazione: '' };
  let h = '<section class="card"><div class="passo"><span class="n">1</span><h2>Quale auto?</h2></div>' +
    '<label class="field">Nome o modello<input type="text" class="grande" data-bind="auto-nome" value="' + esc(a.nome) + '" placeholder="es. Panda"></label>' +
    '<div class="small" style="font-weight:700;margin:12px 0 6px">Colore</div><div class="colori-pick" role="group" aria-label="Colore">' + COLORI.slice(0, 8).map((c) => '<button data-act="auto-colore" data-v="' + c + '" aria-pressed="' + (a.colore === c) + '" style="background:' + c + '" aria-label="Colore ' + c + '"></button>').join('') + '</div></section>';
  h += '<section class="card"><div class="passo"><span class="n">2</span><h2>Le scadenze</h2></div><p class="muted small">Copiale dai documenti. Se una non la sai, lasciala vuota: potrai aggiungerla dopo.</p>';
  h += '<div class="notice small" style="margin-bottom:10px"><label class="field">Data di immatricolazione (facoltativa)<span class="aiuto">Se l\'auto ha meno di 4 anni calcolo io la prima revisione.</span><input type="date" data-bind="auto-immatricolazione" value="' + esc(a.immatricolazione) + '"></label></div>';
  for (const v of VOCI_AUTO) {
    h += '<div class="riga-ed"><label class="field">' + esc(v.nome) + '<span class="aiuto">' + esc(v.aiuto) + '</span><input type="date" data-bind="auto-scadenza" data-k="' + v.id + '" value="' + esc(a.scadenze[v.id] || '') + '"></label></div>';
  }
  h += '</section><section class="card"><div class="passo"><span class="n">3</span><h2>Quanto prima avvisarti?</h2></div>' +
    '<label class="field">Primo avviso<select data-bind="auto-preavviso">' + [7, 15, 20, 30, 45, 60].map((n) => '<option value="' + n + '"' + (n === a.preavviso ? ' selected' : '') + '>' + n + ' giorni prima</option>').join('') + '</select></label>' +
    '<p class="small muted" style="margin:8px 0 0">Poi ti avviso anche una settimana prima e il giorno stesso. Se la scadenza passa e non premi "Fatto", te lo ricordo ogni 3 giorni.</p></section>';
  h += '<div class="barra-salva"><button class="btn primary big" data-act="auto-crea">Crea i promemoria</button><a class="btn ghost" href="#nuovo">Annulla</a></div>';
  return h;
}

/* ---------- schema su N settimane ---------- */
export function vistaCalendario() {
  const d = S.dati, t = oggi();
  const n = S.ui.settimane ?? 4;
  const inizio = lunediDi(t), fine = piuGiorni(inizio, n * 7 - 1);
  const ag = new Map(agenda(d, inizio, fine).map((g) => [g.data, g.voci]));
  const rot = d.promemoria.find((p) => p.quando.tipo === 'rotazione' && p.quando.settimane.length > 1 && !p.pausa);
  let h = '<section class="card no-print"><h2>Schema delle prossime settimane</h2><p class="muted small">Utile da stampare e attaccare al frigo.</p><div class="row">' +
    '<label class="field stretto">Settimane<select data-bind="schema-settimane">' + [2, 4, 6, 8].map((x) => '<option' + (x === n ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
    '<span class="spazio"></span><button class="btn" data-act="stampa">Stampa</button></div></section>';
  h += '<section class="card"><h2 class="stampa-titolo">' + esc(d.nome) + '</h2><div class="schema-wrap"><table class="schema"><thead><tr>' +
    GIORNI.map((g) => '<th scope="col">' + g + '</th>').join('') + '</tr></thead><tbody>';
  for (let w = 0; w < n; w++) {
    const lun = piuGiorni(inizio, w * 7);
    if (rot) h += '<tr><td colspan="7" style="height:auto;border:none;padding:8px 2px 2px"><span class="settimana">Settimana del ' + esc(fmt(lun)) + ' · ' + esc(rot.quando.settimane[settimanaDi(rot.quando, lun)].nome) + '</span></td></tr>';
    h += '<tr>';
    for (let i = 0; i < 7; i++) {
      const g = piuGiorni(lun, i);
      const cls = g === t ? 'oggi' : g < t ? 'passato' : '';
      h += '<td' + attr({ class: cls || null }) + '><div class="num">' + esc(fmt(g)) + '</div>';
      for (const { p, o } of ag.get(g) || []) {
        if (o.voci === null) { h += '<span class="ev annullata">' + esc(p.titolo) + '</span>'; continue; }
        if (o.voci.length) {
          h += o.voci.map((id) => { const v = p.voci.find((x) => x.id === id); return v ? '<span class="ev" style="background:' + v.colore + ';color:' + testoSu(v.colore) + '">' + esc(v.nome) + '</span>' : ''; }).join('');
        } else {
          const c = coloreDi(p);
          h += '<span class="ev" style="background:' + c + ';color:' + testoSu(c) + '">' + esc(p.titolo) + '</span>';
        }
      }
      h += '</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  const conAvvisoSera = d.promemoria.some((p) => p.avvisi.some((a) => a.prima === 1 && a.unita === 'giorni'));
  if (conAvvisoSera) h += '<p class="small muted" style="margin:8px 0 0">Nello schema ci sono i giorni in cui le cose succedono (per la spazzatura, il giorno di ritiro: si espone la sera prima).</p>';
  return h + '</section>';
}

/* ---------- telefono e condivisione ---------- */
export function vistaCondividi() {
  const d = S.dati;
  const mod = S.permesso === 'modifica';
  let h = '<section class="card"><h2>' + icona('calendario', 'titolo') + 'Gli avvisi sul telefono</h2>' +
    '<p>Aggiungi la bacheca al calendario del telefono <b>una volta sola</b>: da lì in poi gli avvisi arrivano come quelli degli appuntamenti, e le modifiche fatte qui si aggiornano da sole.</p>' +
    '<div class="stack">' +
    '<a class="btn primary big" href="' + esc(linkWebcal()) + '">Apple Calendar</a>' +
    '<a class="btn primary big" href="' + esc(linkGoogle()) + '" target="_blank" rel="noopener">Google Calendar</a>' +
    '<p class="small muted" style="margin:-4px 0 0">Da telefono Android, se dopo l\'aggiunta non vedi gli eventi, segui "Come funziona, passo per passo" qui sotto.</p>' +
    '<button class="btn" data-act="copia" data-testo="' + esc(linkFeed()) + '">Copia l\'indirizzo per un altro calendario</button></div>' +
    '<details class="altro"><summary>Come funziona, passo per passo</summary>' +
    '<h3 style="margin-top:8px">Apple Calendar (iPhone, iPad, Mac)</h3><ol class="passi-guida"><li>Tocca <b>Apple Calendar</b> e conferma con <b>Iscriviti</b>.</li><li>Controlla che "Rimuovi avvisi" sia <b>disattivato</b>, poi tocca <b>Aggiungi</b>.</li></ol>' +
    '<h3>Google Calendar</h3><p class="small">Dal telefono Google non sempre completa l\'aggiunta di un calendario tramite link (a volte non dà errori ma non aggiunge niente). Il modo sicuro è farlo <b>una volta da un computer</b>:</p>' +
    '<ol class="passi-guida"><li>Sul computer apri <b>calendar.google.com</b> con lo stesso account Google del telefono.</li>' +
    '<li>A sinistra, accanto ad <b>Altri calendari</b>, premi <b>+</b> › <b>Da URL</b>, incolla l\'indirizzo copiato qui sopra e premi <b>Aggiungi calendario</b>.</li>' +
    '<li>Sul telefono, nell\'app Google Calendar: menu › <b>Impostazioni</b> › tocca il calendario "' + esc(d.nome) + '" e attiva <b>Sincronizza</b>; poi nel menu controlla che sia spuntato.</li>' +
    '<li>Sempre nelle impostazioni di quel calendario, in <b>Notifiche</b>, scegli "All\'inizio dell\'evento": gli eventi sono già all\'ora dell\'avviso.</li></ol>' +
    '<p class="small muted">La prima volta Google può metterci da qualche minuto ad alcune ore a leggere il calendario, e poi lo aggiorna ogni qualche ora.</p>' +
    '<h3>Solo dal telefono Android</h3><p class="small">Installa l\'app <b>ICSx⁵</b> (gratis su F-Droid, pochi euro sul Play Store), premi <b>+</b> e incolla l\'indirizzo copiato: il calendario compare nell\'app Calendario del telefono, anche in Google Calendar, e si aggiorna più spesso.</p>' +
    '<p class="small muted">Non vuoi abbonarti? <button class="btn ghost piccolo" data-act="ics-scarica">Scarica un file .ics</button> con i prossimi 6 mesi (non si aggiorna da solo).</p></details></section>';

  h += vistaPush();
  h += vistaTelegram();
  h += vistaEmail();

  h += '<section class="card"><h2>' + icona('casa', 'titolo') + 'Sulla schermata Home</h2><p>Così apri la bacheca come un\'app.</p><ul class="passi-guida">' +
    '<li><b>iPhone</b> (Safari): tocca Condividi › <b>Aggiungi alla schermata Home</b>.</li>' +
    '<li><b>Android</b> (Chrome): menu con i tre puntini › <b>Aggiungi a schermata Home</b> (o "Installa app").</li></ul></section>';

  h += '<section class="card"><h2>' + icona('uccello', 'titolo') + 'Condividi con la famiglia</h2>';
  if (mod) {
    h += '<h3>Link per modificare</h3><p class="small muted">Chi lo ha può vedere e <b>cambiare</b> tutto: mandalo solo a chi ti fidi.</p>' +
      '<div class="row"><input class="copia" type="text" readonly value="' + esc(linkModifica()) + '" aria-label="Link per modificare" style="flex:1 1 220px"><button class="btn" data-act="condividi" data-url="' + esc(linkModifica()) + '">Manda</button></div>' +
      '<h3 style="margin-top:14px">Link di sola lettura</h3><p class="small muted">Per chi deve solo vedere e ricevere gli avvisi sul calendario.</p>' +
      '<div class="row"><input class="copia" type="text" readonly value="' + esc(linkLettura()) + '" aria-label="Link di sola lettura" style="flex:1 1 220px"><button class="btn" data-act="condividi" data-url="' + esc(linkLettura()) + '">Manda</button></div>';
  } else {
    h += '<p>Stai guardando la bacheca in <b>sola lettura</b>. Per cambiarla chiedi il link di modifica a chi l\'ha creata.</p>' +
      '<div class="row"><button class="btn" data-act="condividi" data-url="' + esc(linkLettura()) + '">Manda questo link</button></div>';
  }
  h += '</section>';
  if (!mod) return h;

  h += '<section class="card"><h2>' + icona('stella', 'titolo') + 'Impostazioni</h2><label class="field">Nome della bacheca<input type="text" data-bind="nome-bacheca" value="' + esc(d.nome) + '" maxlength="60"></label>' +
    '<h3 style="margin-top:16px">Gruppi</h3><p class="small muted">Per raccogliere i promemoria: un\'auto, la casa, una persona…</p>';
  d.gruppi.forEach((g, i) => {
    h += '<div class="riga-ed"><input type="color" data-bind="gruppo-colore" data-i="' + i + '" value="' + g.colore + '" aria-label="Colore di ' + esc(g.nome) + '">' +
      '<button class="btn piccolo icona-gruppo" data-act="gruppo-icone" data-i="' + i + '" aria-label="Cambia disegno">' + icona(g.icona, 'mini') + '</button>' +
      '<label class="field">Nome<input type="text" data-bind="gruppo-nome" data-i="' + i + '" value="' + esc(g.nome) + '"></label>' +
      (S.ui.conferma === 'g' + g.id ? '<button class="btn danger" data-act="gruppo-del-ok" data-i="' + i + '">Conferma</button>' : '<button class="btn danger" data-act="gruppo-del" data-i="' + i + '">Elimina</button>') + '</div>' +
      (S.ui.iconeGruppo === i ? sceltaIcone(g.icona, 'gruppo-icona', ' data-i="' + i + '"') : '');
  });
  h += '<button class="btn" data-act="gruppo-add" style="margin-top:8px">+ Nuovo gruppo</button></section>';

  h += '<section class="card"><h2>' + icona('luna', 'titolo') + 'Copie di sicurezza</h2><p class="small muted">Il server tiene da solo le ultime versioni: se qualcosa è andato storto puoi tornare indietro.</p>';
  if (!S.ui.copie) h += '<button class="btn" data-act="storico">Mostra le versioni precedenti</button>';
  else if (!S.ui.copie.length) h += '<p class="muted">Ancora nessuna copia: si crea da sola quando modifichi la bacheca.</p>';
  else {
    h += '<div class="list">' + S.ui.copie.map((c) => '<div class="item"><div class="d">' + esc(new Date(c.salvata).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })) + '</div><div>' +
      (S.ui.conferma === 'v' + c.versione ? '<button class="btn danger piccolo" data-act="ripristina-ok" data-v="' + c.versione + '">Conferma: torna a questa versione</button>' : '<button class="btn piccolo" data-act="ripristina" data-v="' + c.versione + '">Ripristina</button>') + '</div></div>').join('') + '</div>';
  }
  h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="backup">Scarica una copia (file)</button><button class="btn" data-act="importa">Importa da file</button></div>' +
    '<p class="small muted" style="margin:8px 0 0">L\'importazione <b>aggiunge</b> i promemoria del file a quelli che ci sono. Va bene anche il file .yaml della vecchia app "Raccolta rifiuti".</p></section>';

  h += '<section class="card"><h2>' + icona('occhio', 'titolo') + 'Cambia i link</h2><p class="small muted">Se un link è finito nelle mani sbagliate, cambialo: quello vecchio smette di funzionare. Poi rimanda quello nuovo a chi serve (per il calendario: va riaggiunto sui telefoni).</p><div class="row">' +
    (S.ui.conferma === 'rig-modifica' ? '<button class="btn danger" data-act="rigenera-ok" data-quale="modifica">Conferma: cambia il link per modificare</button>' : '<button class="btn danger" data-act="rigenera" data-quale="modifica">Cambia il link per modificare</button>') +
    (S.ui.conferma === 'rig-lettura' ? '<button class="btn danger" data-act="rigenera-ok" data-quale="lettura">Conferma: cambia sola lettura e calendario</button>' : '<button class="btn danger" data-act="rigenera" data-quale="lettura">Cambia sola lettura e calendario</button>') +
    '</div></section>';
  return h;
}


/* ---------- scelta dei gruppi da ricevere (Telegram, notifiche, email) ---------- */
function sceltaFiltro(canale, id, f) {
  const gruppi = S.dati.gruppi;
  if (!gruppi.length) return '';
  const scelta = (g, nome) => '<button class="chip" data-act="filtro" data-canale="' + canale + '" data-id="' + esc(id) + '" data-g="' + esc(g) + '" aria-pressed="' + (!!f && f.includes(g)) + '">' + esc(nome) + '</button>';
  return '<div style="flex-basis:100%"><div class="small" style="font-weight:700;margin-bottom:6px">Riceve</div><div class="chips">' +
    '<button class="chip" data-act="filtro" data-canale="' + canale + '" data-id="' + esc(id) + '" data-g="*" aria-pressed="' + !f + '">Tutto</button>' +
    gruppi.map((g) => scelta(g.id, g.nome)).join('') + scelta('', 'Senza gruppo') + '</div></div>';
}
const elencoDi = (canale) => ({ telegram: S.ui.tg?.iscrizioni, push: S.ui.push?.telefoni, email: S.ui.email?.destinatari }[canale] || []);
const chiaveDi = (canale, x) => (canale === 'telegram' ? x.chat : x.id);

/* ---------- notifiche dell'app (Web Push) ---------- */
const pushSupportato = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const suIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function nomeDispositivo() {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : suIOS() ? (/iPad/.test(ua) || navigator.maxTouchPoints > 1 && !/iPhone/.test(ua) ? 'iPad' : 'iPhone') : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Computer';
  const br = /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return so + (br ? ' · ' + br : '');
}
const chiaveB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function abbonamentoAttuale() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function caricaPush() {
  const p = S.ui.push = { ...(S.ui.push || {}), caricamento: true };
  try {
    if (pushSupportato() && Notification.permission === 'granted') {
      const sub = await abbonamentoAttuale();
      p.attivo = sub ? (await api.pushMio(S.token, sub.endpoint)).attivo : false;
    } else p.attivo = false;
    if (S.permesso === 'modifica') p.telefoni = (await api.pushElenco(S.token)).telefoni;
  } catch (e) { p.errore = e.message; }
  p.caricamento = false;
  render();
}

function vistaPush() {
  const p = S.ui.push;
  if (!p) { caricaPush(); return ''; }
  let h = '<section class="card"><h2>' + icona('campanella', 'titolo') + 'Notifiche dell\'app</h2>' +
    '<p>Senza installare niente: gli avvisi arrivano come notifiche su questo telefono, all\'ora di ogni promemoria.</p>';
  if (!pushSupportato() || (suIOS() && !inStandalone())) {
    h += suIOS()
      ? '<p class="notice small">Su <b>iPhone e iPad</b> le notifiche funzionano solo dall\'icona sulla schermata Home (iOS 16.4 o successivo): in Safari tocca <b>Condividi › Aggiungi alla schermata Home</b>, apri la bacheca da quell\'icona e torna qui.</p>'
      : '<p class="notice small">Questo browser non supporta le notifiche. Su Android usa <b>Chrome</b>; in alternativa usa Telegram o l\'email qui sotto.</p>';
  } else if (Notification.permission === 'denied') {
    h += '<p class="notice attenzione small">Le notifiche per questo sito sono bloccate. Riattivale dalle impostazioni del browser (icona accanto all\'indirizzo › Autorizzazioni › Notifiche), poi torna qui.</p>';
  } else if (p.attivo) {
    h += '<p class="riassunto">Attive su questo telefono.</p><div class="row" style="margin-top:10px"><button class="btn" data-act="push-prova">Manda una notifica di prova</button>' +
      '<button class="btn danger" data-act="push-disattiva">Disattiva su questo telefono</button></div>';
  } else {
    h += '<button class="btn primary big wide" data-act="push-attiva"' + (p.caricamento ? ' disabled' : '') + '>Attiva le notifiche su questo telefono</button>' +
      '<p class="small muted" style="margin:8px 0 0">Il telefono ti chiederà il permesso: rispondi <b>Consenti</b>.</p>';
  }
  if (p.errore) h += '<p class="notice attenzione small" style="margin-top:10px">' + esc(p.errore) + '</p>';
  if (S.permesso === 'modifica' && p.telefoni?.length) {
    h += '<h3 style="margin-top:16px">Telefoni con le notifiche</h3>';
    for (const t of p.telefoni) {
      h += '<div class="riga-ed" style="align-items:center">' + icona('telefono', 'mini') + '<div style="flex:1 1 160px;min-width:0"><b>' + esc(t.nome) + '</b>' +
        '<div class="small muted">dal ' + esc(new Date(t.creata).toLocaleDateString('it-IT')) + '</div></div>' +
        (S.ui.conferma === 'push' + t.id ? '<button class="btn danger piccolo" data-act="push-togli-ok" data-id="' + esc(t.id) + '">Conferma</button>'
          : '<button class="btn danger piccolo" data-act="push-togli" data-id="' + esc(t.id) + '">Togli</button>') +
        sceltaFiltro('push', t.id, t.filtro) + '</div>';
    }
  }
  return h + '</section>';
}

/* ---------- avvisi via email ---------- */
async function caricaEmail() {
  const e = S.ui.email = { ...(S.ui.email || {}), caricamento: true };
  try { Object.assign(e, await api.email(S.token)); e.bozza ??= { ...e.modello }; } catch (x) { e.errore = x.message; }
  e.caricamento = false;
  render();
}

function vistaEmail() {
  if (S.permesso !== 'modifica') return '';
  const e = S.ui.email;
  if (!e) { caricaEmail(); return ''; }
  if (e.caricamento && !e.modello) return '';
  let h = '<section class="card"><h2>' + icona('documento', 'titolo') + 'Avvisi via email</h2>';
  if (!e.attiva) {
    return h + '<p class="notice small">L\'invio di email non è ancora configurato su questo server: chi gestisce l\'app deve aggiungere i segreti <b>BREVO_API_KEY</b> ed <b>EMAIL_MITTENTE</b> (vedi il README).</p></section>';
  }
  h += '<p>Un\'email a ogni avviso, agli indirizzi qui sotto. Ogni indirizzo riceve prima un\'email per <b>confermare</b>: finché non conferma non riceve niente, e in ogni email c\'è il link per smettere.</p>';
  if (e.errore) h += '<p class="notice attenzione small">' + esc(e.errore) + '</p>';
  for (const d of e.destinatari || []) {
    h += '<div class="riga-ed" style="align-items:center">' + icona('documento', 'mini') + '<div style="flex:1 1 160px;min-width:0"><b>' + esc(d.nome) + '</b>' +
      (d.nome !== d.indirizzo ? '<div class="small muted">' + esc(d.indirizzo) + '</div>' : '') + '</div>' +
      (d.stato === 'attivo' ? '<span class="badge verde">Attivo</span>' : '<span class="badge giallo">Da confermare</span><button class="btn piccolo" data-act="email-conferma" data-id="' + esc(d.id) + '">Rimanda la conferma</button>') +
      (S.ui.conferma === 'email' + d.id ? '<button class="btn danger piccolo" data-act="email-togli-ok" data-id="' + esc(d.id) + '">Conferma</button>'
        : '<button class="btn danger piccolo" data-act="email-togli" data-id="' + esc(d.id) + '">Togli</button>') +
      sceltaFiltro('email', d.id, d.filtro) + '</div>';
  }
  h += '<div class="riga-ed"><label class="field">Indirizzo email<input type="email" id="emailNuova" autocomplete="email" inputmode="email" placeholder="nome@esempio.it"></label>' +
    '<label class="field">Nome (facoltativo)<input type="text" id="emailNome" placeholder="es. Mamma"></label>' +
    '<button class="btn primary" data-act="email-aggiungi">Aggiungi</button></div>';

  const b = e.bozza;
  h += '<details class="altro"' + (S.ui.emailModello ? ' open' : '') + '><summary data-act="email-modello-apri">Oggetto e testo dell\'email</summary>' +
    '<div class="stack" style="margin-top:8px"><label class="field">Oggetto<input type="text" data-bind="email-oggetto" value="' + esc(b.oggetto) + '" maxlength="200"></label>' +
    '<label class="field">Testo<textarea data-bind="email-corpo" maxlength="4000" style="min-height:160px">' + esc(b.corpo) + '</textarea></label>' +
    '<div class="small"><b>Parole che si riempiono da sole</b> (toccale per aggiungerle al testo):<div class="chips" style="margin-top:6px">' +
    (e.segnaposto || []).map((k) => '<button class="chip" data-act="email-segnaposto" data-v="' + k + '">{' + k + '}</button>').join('') + '</div>' +
    '<p class="muted" style="margin:6px 0 0">{testo} il testo dell\'avviso · {promemoria} il nome · {voci} es. i tipi di rifiuto · {gruppo} · {data} il giorno · {quando} es. "domani" · {ripetizione} · {nota} · {bacheca}. In fondo aggiungo sempre il link alla bacheca e quello per non ricevere più.</p></div>' +
    '<div class="row"><button class="btn primary" data-act="email-modello-salva">Salva</button><button class="btn" data-act="email-anteprima">Anteprima</button><button class="btn ghost" data-act="email-modello-predefinito">Testo predefinito</button></div>';
  if (e.anteprima) h += '<div class="pannello"><div class="small muted">Oggetto</div><b>' + esc(e.anteprima.oggetto) + '</b><div class="small muted" style="margin-top:8px">Testo</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(e.anteprima.testo) + '</div></div>';
  h += '</div></details>';
  if ((e.destinatari || []).some((d) => d.stato === 'attivo')) h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="email-prova">Manda un\'email di prova</button></div>';
  return h + '</section>';
}

/* ---------- avvisi su Telegram ---------- */
const VALIDITA_LINK = 50 * 60 * 1000; // il codice dura un'ora sul server

async function caricaTelegram() {
  const tg = S.ui.tg = { ...(S.ui.tg || {}), caricamento: true };
  try {
    Object.assign(tg, await api.telegram(S.token));
    if (tg.attivo && (!tg.link || Date.now() - tg.creato > VALIDITA_LINK)) {
      Object.assign(tg, await api.telegramCollega(S.token), { creato: Date.now() });
    }
  } catch (e) { tg.errore = e.message; }
  tg.caricamento = false;
  render();
}

function vistaTelegram() {
  const tg = S.ui.tg;
  const mod = S.permesso === 'modifica';
  if (!tg) { caricaTelegram(); return ''; }
  if (tg.caricamento && !tg.attivo) return '';
  if (!tg.attivo) {
    return mod ? '<section class="card"><h2>' + icona('telefono', 'titolo') + 'Avvisi su Telegram</h2><p class="notice small">Il bot Telegram non è ancora configurato su questo server: chi gestisce l\'app deve aggiungere il segreto <b>TELEGRAM_BOT_TOKEN</b> (vedi il README).</p></section>' : '';
  }
  let h = '<section class="card"><h2>' + icona('telefono', 'titolo') + 'Avvisi su Telegram</h2>' +
    '<p>Ricevi i promemoria come messaggi su Telegram, all\'ora di ogni avviso. Va bene anche un gruppo di famiglia. Per le scadenze c\'è il tasto <b>Fatto</b> direttamente nel messaggio.</p>';
  if (tg.errore) h += '<p class="notice attenzione small">' + esc(tg.errore) + '</p>';
  if (tg.link) {
    h += '<div class="stack"><a class="btn primary big" href="' + esc(tg.link) + '" target="_blank" rel="noopener">Collega la mia chat Telegram</a>' +
      '<a class="btn" href="' + esc(tg.linkGruppo) + '" target="_blank" rel="noopener">Collega un gruppo Telegram</a></div>' +
      '<p class="small muted" style="margin:10px 0 0">Si apre Telegram: tocca <b>Avvia</b> (o scegli il gruppo). Poi torna qui e tocca <b>Aggiorna</b>.</p>';
  }
  if (mod) {
    h += '<h3 style="margin-top:16px">Chat collegate</h3>';
    if (!tg.iscrizioni?.length) h += '<p class="muted small">Ancora nessuna.</p>';
    for (const i of tg.iscrizioni || []) {
      h += '<div class="riga-ed" style="align-items:center">' + icona('uccello', 'mini') + '<div style="flex:1 1 160px;min-width:0"><b>' + esc(i.nome) + '</b>' +
        (i.modifica ? '' : '<div class="small muted">Collegata con il link di sola lettura: niente tasto "Fatto"</div>') + '</div>' +
        (S.ui.conferma === 'tg' + i.chat ? '<button class="btn danger piccolo" data-act="tg-togli-ok" data-chat="' + esc(i.chat) + '">Conferma</button>'
          : '<button class="btn danger piccolo" data-act="tg-togli" data-chat="' + esc(i.chat) + '">Togli</button>');
      h += sceltaFiltro('telegram', i.chat, i.filtro) + '</div>';
    }
    h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="tg-aggiorna">Aggiorna</button>' +
      (tg.iscrizioni?.length ? '<button class="btn" data-act="tg-prova">Manda un messaggio di prova</button>' : '') + '</div>';
  } else {
    h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="tg-aggiorna">Aggiorna</button></div>';
  }
  h += '<p class="small muted" style="margin:10px 0 0">Comandi del bot: <b>/oggi</b> per vedere cosa c\'è oggi, <b>/stop</b> per non ricevere più messaggi.</p>';
  return h + '</section>';
}

/* ---------- azioni ---------- */
export const AZIONI = {
  async 'crea-bacheca'(el) {
    const nome = document.getElementById('nomeNuova')?.value.trim() || 'La mia bacheca';
    const codice = document.getElementById('codiceNuova')?.value.trim();
    el.disabled = true;
    try {
      const r = await api.crea(nome, codice);
      try { sessionStorage.setItem('nms.nuova', r.modifica); } catch { /* */ }
      location.href = '/b/' + r.modifica + '#oggi';
    } catch (e) { toast(e.message); el.disabled = false; }
  },
  'dimentica'(el) { dimentica(el.dataset.token); render(); },
  'chiudi-benvenuto'() { try { sessionStorage.removeItem('nms.nuova'); } catch { /* */ } render(); },
  'copia'(el) { copia(el.dataset.testo); },
  'condividi'(el) { condividi(S.dati?.nome || 'Promemoria', 'I promemoria di "' + (S.dati?.nome || '') + '":', el.dataset.url); },
  'stampa'() { window.print(); },

  'fatto-apri'(el) { S.ui.fatto = el.dataset.id; S.ui.fattoIl = oggi(); S.ui.fattoProssima = null; render(); },
  'fatto-annulla'() { S.ui.fatto = null; render(); },
  'fatto-conferma'() {
    const id = S.ui.fatto, il = S.ui.fattoIl || oggi();
    const p = S.dati.promemoria.find((x) => x.id === id);
    const prossima = S.ui.fattoProssima || prossimaScadenza(p.quando, il);
    S.ui.fatto = null;
    modifica((d) => { const i = d.promemoria.findIndex((x) => x.id === id); d.promemoria[i] = segnaFatto(d.promemoria[i], il, valida(prossima) ? prossima : null); }, { subito: true });
    toast(valida(prossima) && prossima !== p.quando.scadenza ? 'Bravo! Prossima scadenza: ' + fmtAnno(prossima) : 'Segnato come fatto.');
  },

  'usa-modello'(el) {
    const m = MODELLI.find((x) => x.id === el.dataset.id);
    if (m.speciale) { S.ui.auto = null; location.hash = '#auto'; return; }
    S.bozza = normalizza({ versione: 2, gruppi: S.dati.gruppi, promemoria: [{ ...m.crea(oggi()), id: nuovoId('p') }] }, oggi()).promemoria[0];
    S.bozzaNuova = true;
    location.hash = '#modifica/' + S.bozza.id;
  },
  'auto-colore'(el) { S.ui.auto.colore = el.dataset.v; render(); },
  'auto-crea'() {
    const a = S.ui.auto;
    if (!a.nome.trim()) { toast('Scrivi il nome dell\'auto.'); return; }
    const { gruppo, promemoria } = creaAuto({ nome: a.nome.trim(), icona: 'auto', colore: a.colore, scadenze: a.scadenze, preavviso: a.preavviso });
    if (!promemoria.length) { toast('Inserisci almeno una scadenza.'); return; }
    modifica((d) => { d.gruppi.push(gruppo); d.promemoria.push(...promemoria); }, { subito: true });
    S.ui.auto = null;
    toast(promemoria.length + ' promemoria creati per ' + gruppo.nome + '.');
    location.hash = '#oggi';
  },

  'ics-scarica'() {
    const t = oggi();
    const { testo, eventi } = generaICS(S.dati, { da: t, a: piuMesi(t, 6), link: linkLettura() });
    scarica('promemoria.ics', testo, 'text/calendar');
    toast(eventi + ' eventi nel file.');
  },
  'backup'() {
    scarica((S.dati.nome || 'bacheca').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json', JSON.stringify(S.dati, null, 2), 'application/json');
  },
  'importa'() { document.getElementById('fileImport').click(); },
  async 'storico'() {
    try { S.ui.copie = (await api.storico(S.token)).copie; render(); } catch (e) { toast(e.message); }
  },
  'ripristina'(el) { S.ui.conferma = 'v' + el.dataset.v; render(); },
  async 'ripristina-ok'(el) {
    try {
      const r = await api.copia(S.token, el.dataset.v);
      S.ui.conferma = null; S.ui.copie = null;
      modifica((d) => Object.assign(d, r.dati), { subito: true });
      toast('Versione ripristinata.');
    } catch (e) { toast(e.message); }
  },
  'rigenera'(el) { S.ui.conferma = 'rig-' + el.dataset.quale; render(); },
  async 'rigenera-ok'(el) {
    try {
      const r = await api.rigenera(S.token, el.dataset.quale);
      S.ui.conferma = null;
      if (r.modifica) {
        dimentica(S.token);
        try { sessionStorage.setItem('nms.nuova', r.modifica); } catch { /* */ }
        location.replace('/b/' + r.modifica + '#condividi');
      } else { S.lettura = r.lettura; render(); toast('Link cambiato. Rimandalo a chi serve.'); }
    } catch (e) { toast(e.message); }
  },
  'gruppo-add'() {
    modifica((d) => d.gruppi.push({ id: nuovoId('g'), nome: 'Nuovo gruppo', icona: 'casa', colore: COLORI[d.gruppi.length % COLORI.length] }));
  },
  'tg-aggiorna'() { caricaTelegram(); },
  async 'tg-prova'() {
    try { const r = await api.telegramProva(S.token); toast('Messaggio mandato a ' + r.inviati + ' chat su ' + r.totale + '.'); } catch (e) { toast(e.message); }
  },
  'tg-togli'(el) { S.ui.conferma = 'tg' + el.dataset.chat; render(); },
  async 'tg-togli-ok'(el) {
    S.ui.conferma = null;
    try { await api.telegramTogli(S.token, el.dataset.chat); toast('Chat scollegata.'); } catch (e) { toast(e.message); }
    caricaTelegram();
  },
  async 'filtro'(el) {
    const canale = el.dataset.canale;
    const x = elencoDi(canale).find((y) => chiaveDi(canale, y) === el.dataset.id);
    if (!x) return;
    const g = el.dataset.g;
    let f = g === '*' ? null : (x.filtro ? [...x.filtro] : []);
    if (f) f = f.includes(g) ? f.filter((y) => y !== g) : [...f, g];
    if (f && !f.length) f = null;
    x.filtro = f; render();
    const salva = { telegram: api.telegramFiltro, push: api.pushFiltro, email: api.emailFiltro }[canale];
    try { x.filtro = (await salva(S.token, el.dataset.id, f)).filtro; } catch (e) { toast(e.message); }
  },

  async 'push-attiva'(el) {
    el.disabled = true;
    try {
      const permesso = await Notification.requestPermission(); // va chiesto subito, dentro il tocco
      if (permesso !== 'granted') { toast('Senza il permesso le notifiche non possono arrivare.'); render(); return; }
      const { chiave } = await api.pushChiave(S.token);
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveB64(chiave) });
      await api.pushIscrivi(S.token, sub.toJSON(), nomeDispositivo());
      S.ui.push.attivo = true; S.ui.push.errore = null;
      toast('Notifiche attive su questo telefono.');
    } catch (e) { S.ui.push.errore = 'Non sono riuscito ad attivare le notifiche: ' + e.message; }
    caricaPush();
  },
  async 'push-disattiva'() {
    try { const sub = await abbonamentoAttuale(); if (sub) await api.pushVia(S.token, sub.endpoint); toast('Notifiche disattivate su questo telefono.'); } catch (e) { toast(e.message); }
    caricaPush();
  },
  async 'push-prova'() {
    try { const sub = await abbonamentoAttuale(); const r = await api.pushProva(S.token, sub?.endpoint); toast(r.inviati ? 'Notifica mandata: dovrebbe arrivare tra pochi secondi.' : 'Non è arrivata: prova a disattivare e riattivare.'); } catch (e) { toast(e.message); }
  },
  'push-togli'(el) { S.ui.conferma = 'push' + el.dataset.id; render(); },
  async 'push-togli-ok'(el) {
    S.ui.conferma = null;
    try { await api.pushTogli(S.token, el.dataset.id); toast('Telefono tolto.'); } catch (e) { toast(e.message); }
    caricaPush();
  },

  async 'email-aggiungi'(el) {
    const indirizzo = document.getElementById('emailNuova')?.value.trim(), nome = document.getElementById('emailNome')?.value.trim();
    if (!indirizzo) { toast('Scrivi un indirizzo email.'); return; }
    el.disabled = true;
    try {
      const d = await api.emailAggiungi(S.token, indirizzo, nome);
      toast(d.stato === 'attivo' ? 'Questo indirizzo riceve già i promemoria.' : 'Ho mandato a ' + d.indirizzo + ' un\'email per confermare.', 5000);
    } catch (e) { toast(e.message); }
    caricaEmail();
  },
  async 'email-conferma'(el) {
    try { await api.emailConferma(S.token, el.dataset.id); toast('Email di conferma rimandata.'); } catch (e) { toast(e.message); }
  },
  'email-togli'(el) { S.ui.conferma = 'email' + el.dataset.id; render(); },
  async 'email-togli-ok'(el) {
    S.ui.conferma = null;
    try { await api.emailTogli(S.token, el.dataset.id); toast('Indirizzo tolto.'); } catch (e) { toast(e.message); }
    caricaEmail();
  },
  'email-modello-apri'() { S.ui.emailModello = !S.ui.emailModello; render(); },
  'email-segnaposto'(el) {
    const t = document.querySelector('[data-bind="email-corpo"]');
    const ins = '{' + el.dataset.v + '}';
    const fermo = !t.selectionStart && !t.selectionEnd && t.value; // campo mai toccato: aggiungo in fondo
    const i = fermo ? t.value.length : (t.selectionStart ?? t.value.length);
    if (fermo) t.setSelectionRange(i, i);
    t.value = t.value.slice(0, i) + ins + t.value.slice(t.selectionEnd ?? i);
    S.ui.email.bozza.corpo = t.value;
    t.focus(); t.selectionStart = t.selectionEnd = i + ins.length;
  },
  async 'email-anteprima'() {
    const b = S.ui.email.bozza;
    try { S.ui.email.anteprima = await api.emailAnteprima(S.token, b.oggetto, b.corpo); render(); } catch (e) { toast(e.message); }
  },
  async 'email-modello-salva'() {
    const b = S.ui.email.bozza;
    try { S.ui.email.modello = (await api.emailModello(S.token, b.oggetto, b.corpo)).modello; toast('Oggetto e testo salvati.'); } catch (e) { toast(e.message); }
  },
  async 'email-modello-predefinito'() {
    try {
      S.ui.email.modello = (await api.emailModello(S.token, '', '')).modello;
      S.ui.email.bozza = { ...S.ui.email.modello }; S.ui.email.anteprima = null;
      render(); toast('Ripristinato il testo predefinito.');
    } catch (e) { toast(e.message); }
  },
  async 'email-prova'() {
    try { const r = await api.emailProva(S.token); toast('Email di prova mandata a ' + r.inviati + ' indirizzi.'); } catch (e) { toast(e.message); }
  },
  'gruppo-icone'(el) { S.ui.iconeGruppo = S.ui.iconeGruppo === +el.dataset.i ? null : +el.dataset.i; render(); },
  'gruppo-icona'(el) { S.ui.iconeGruppo = null; modifica((d) => { d.gruppi[+el.dataset.i].icona = el.dataset.v; }); },
  'gruppo-del'(el) { S.ui.conferma = 'g' + S.dati.gruppi[+el.dataset.i].id; render(); },
  'gruppo-del-ok'(el) { S.ui.conferma = null; modifica((d) => d.gruppi.splice(+el.dataset.i, 1)); toast('Gruppo eliminato (i promemoria restano).'); },
};

export const LEGAMI = {
  'fatto-il'(el) {
    S.ui.fattoIl = valida(el.value) ? el.value : oggi();
    S.ui.fattoProssima = null;
    return true;
  },
  'fatto-prossima'(el) { S.ui.fattoProssima = el.value; },
  'email-oggetto'(el) { S.ui.email.bozza.oggetto = el.value; },
  'email-corpo'(el) { S.ui.email.bozza.corpo = el.value; },
  'schema-settimane'(el) { S.ui.settimane = +el.value; return true; },
  'auto-nome'(el) { S.ui.auto.nome = el.value; },
  'auto-scadenza'(el) { S.ui.auto.scadenze[el.dataset.k] = el.value; },
  'auto-preavviso'(el) { S.ui.auto.preavviso = +el.value; },
  'auto-immatricolazione'(el) {
    const a = S.ui.auto;
    a.immatricolazione = el.value;
    if (valida(el.value)) {
      let r = primaRevisione(el.value);
      while (r < oggi()) r = piuMesi(r, 24);
      a.scadenze.revisione = r;
      toast('Revisione calcolata: ' + fmtAnno(r));
      return true;
    }
  },
  'nome-bacheca'(el, evento) { if (evento === 'change') modifica((d) => { d.nome = el.value; }); },
  'gruppo-nome'(el, evento) { if (evento === 'change') modifica((d) => { d.gruppi[+el.dataset.i].nome = el.value; }); },
  'gruppo-colore'(el, evento) { if (evento === 'change') modifica((d) => { d.gruppi[+el.dataset.i].colore = el.value; }); },
};

/** Import da file: JSON o YAML (anche la vecchia app "Raccolta rifiuti"); aggiunge senza cancellare. */
export async function importaFile(file) {
  const testo = await file.text();
  let raw;
  try { raw = JSON.parse(testo); } catch {
    try { await caricaScript('/vendor/js-yaml.min.js'); raw = window.jsyaml.load(testo); } catch { toast('Il file non è leggibile.'); return; }
  }
  let nuova;
  try { nuova = normalizza(raw, oggi()); } catch (e) { toast(e.message); return; }
  const mappaGruppi = new Map(nuova.gruppi.map((g) => [g.id, S.dati.gruppi.some((x) => x.id === g.id) ? nuovoId('g') : g.id]));
  modifica((d) => {
    d.gruppi.push(...nuova.gruppi.map((g) => ({ ...g, id: mappaGruppi.get(g.id) })));
    d.promemoria.push(...nuova.promemoria.map((p) => ({
      ...p, id: d.promemoria.some((x) => x.id === p.id) ? nuovoId('p') : p.id, gruppo: mappaGruppi.get(p.gruppo) || '',
    })));
  }, { subito: true });
  toast(nuova.promemoria.length + ' promemoria importati.');
  location.hash = '#promemoria';
}

