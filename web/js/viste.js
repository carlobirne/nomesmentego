// Le schermate dell'app (tranne l'editor di un promemoria, in editor.js).
import { S, modifica, render, puoModificare, oggi } from './stato.js';
import { api, recenti, dimentica } from './api.js';
import { esc, attr, chip, toast, copia, condividi, scarica, caricaScript, testoSu, ICONE, COLORI } from './ui.js';
import { normalizza, nuovoId } from '../core/modello.js';
import { tuttiGliAvvisi, agenda, prossime, prossimaScadenza, segnaFatto, riassunto, settimanaDi, nomiVoci } from '../core/motore.js';
import { generaICS } from '../core/ics.js';
import { MODELLI, VOCI_AUTO, creaAuto, primaRevisione } from '../core/modelli.js';
import { piuGiorni, piuMesi, differenza, lunediDi, fmt, fmtAnno, fmtGiorno, fmtLungo, GIORNI, valida } from '../core/date.js';

/* ---------- utilità comuni ---------- */
export const gruppoDi = (p) => S.dati.gruppi.find((g) => g.id === p.gruppo);
export const iconaDi = (p) => p.icona || gruppoDi(p)?.icona || '🔔';
const coloreDi = (p) => gruppoDi(p)?.colore || '#1d3b2f';
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
  if (!senzaTitolo) h += '<span>' + esc(iconaDi(p)) + '</span><b>' + esc(p.titolo) + '</b>';
  h += voci.map((v) => chip(v.nome, v.colore)).join('') + '</div>';
  h += o.note.map((n) => '<div class="nota-ecc">' + esc(n) + '</div>').join('');
  return h;
}

function avvisoHTML(a) {
  const p = S.dati.promemoria.find((x) => x.id === a.promemoria);
  return '<div class="avviso"><div class="ora">' + esc(a.ora) + '</div><div><div class="testo">' + esc(iconaDi(p)) + ' ' + esc(a.testo) + '</div>' +
    (a.occorrenza.voci?.length ? '<div class="chips" style="margin-top:6px">' + a.occorrenza.voci.map((id) => { const v = p.voci.find((x) => x.id === id); return v ? chip(v.nome, v.colore) : ''; }).join('') + '</div>' : '') +
    a.occorrenza.note.map((n) => '<div class="small" style="margin-top:4px">' + esc(n) + '</div>').join('') + '</div></div>';
}

/* ---------- pagina iniziale (nessuna bacheca aperta) ---------- */
export function vistaHome() {
  const r = recenti();
  let h = '<section class="card"><h1>I promemoria di famiglia 🗓️</h1>' +
    '<p>Spazzatura, mercato, scadenze dell\'auto, medicine, compleanni: li imposti una volta e arrivano da soli sul calendario del telefono, iPhone o Android.</p>' +
    '<p class="muted small">Niente account e niente password: ogni bacheca ha il suo link segreto. Chi ha il link la vede e la modifica dal browser.</p></section>';
  h += '<section class="card"><h2>Crea una bacheca</h2><div class="stack">' +
    '<label class="field">Come la chiamiamo?<input type="text" id="nomeNuova" class="grande" placeholder="es. Casa di mamma" maxlength="60"></label>' +
    (S.ui.serveCodice ? '<label class="field">Codice di invito<span class="aiuto">Te lo dà chi ha installato l\'app.</span><input type="text" id="codiceNuova" autocomplete="off"></label>' : '') +
    '<button class="btn primary big" data-act="crea-bacheca">Crea la bacheca</button></div></section>';
  if (r.length) {
    h += '<section class="card"><h2>Le tue bacheche</h2><p class="muted small">Aperte di recente su questo telefono.</p><div class="stack">';
    for (const x of r) {
      h += '<div class="row"><a class="btn wide" style="flex:1;justify-content:flex-start" href="/' + (x.permesso === 'lettura' ? 'v' : 'b') + '/' + esc(x.token) + '">' +
        (x.permesso === 'lettura' ? '👀 ' : '📋 ') + esc(x.nome) + '</a>' +
        '<button class="btn ghost piccolo" data-act="dimentica" data-token="' + esc(x.token) + '" aria-label="Togli ' + esc(x.nome) + ' da questo elenco">Togli</button></div>';
    }
    h += '</div></section>';
  }
  h += '<section class="card"><h2>Hai ricevuto un link?</h2><p class="muted">Aprilo e basta: la bacheca si apre qui e la ritrovi in questo elenco.</p></section>';
  return h;
}

export function vistaErrore() {
  return '<section class="card vuoto"><div class="ico">🔍</div><h2>Bacheca non trovata</h2><p>' + esc(S.errore || 'Il link non è valido.') +
    '</p><p class="muted small">Se qualcuno ha cambiato il link della bacheca, chiedigli quello nuovo.</p><a class="btn primary" href="/">Vai alla pagina iniziale</a></section>';
}

/* ---------- Oggi ---------- */
export function vistaOggi() {
  const d = S.dati, t = oggi(), dom = piuGiorni(t, 1);
  let h = '';
  let nuova = null;
  try { nuova = sessionStorage.getItem('nms.nuova'); } catch { /* */ }
  if (nuova === S.token) {
    h += '<section class="card notice attenzione"><h2>🎉 La bacheca è pronta!</h2><p><b>Il link di questa pagina è la chiave</b>: salvalo (per esempio mandalo a te stesso su WhatsApp) e aggiungi la pagina alla schermata Home.</p>' +
      '<div class="row"><button class="btn primary" data-act="condividi" data-url="' + esc(linkModifica()) + '">Salva o manda il link</button><button class="btn" data-act="chiudi-benvenuto">Fatto</button></div></section>';
  }
  if (!d.promemoria.length) {
    return h + '<section class="card vuoto"><div class="ico">📝</div><h2>Nessun promemoria, per ora</h2><p class="muted">Cominciamo dal primo: la spazzatura, il mercato, la revisione dell\'auto…</p>' +
      (puoModificare() ? '<a class="btn primary big" href="#nuovo">Aggiungi un promemoria</a>' : '') + '</section>';
  }
  const avOggi = tuttiGliAvvisi(d, t, t), avDomani = tuttiGliAvvisi(d, dom, dom);
  const succede = agenda(d, t, t)[0]?.voci ?? [];
  h += '<section class="card hero" aria-live="polite"><div class="label">Oggi, ' + esc(fmtLungo(t)) + '</div>';
  if (avOggi.length) h += '<div class="grande">Da ricordare</div>' + avOggi.map(avvisoHTML).join('');
  else h += '<div class="grande">' + (succede.length ? 'Oggi succede' : 'Niente da ricordare 🎉') + '</div>';
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
    h += '<div class="scadenza"><div class="grande-emoji" aria-hidden="true">' + esc(iconaDi(p)) + '</div><div class="info"><div class="titolo">' + esc(p.titolo) + '</div>' +
      '<div class="small muted">Scade ' + esc(fmtAnno(q.scadenza)) + (q.ultimaVolta ? ' · fatto l\'ultima volta il ' + esc(fmtAnno(q.ultimaVolta)) : '') + '</div></div>' +
      badgeScadenza(t, q.scadenza) +
      (puoModificare() && S.ui.fatto !== p.id ? '<button class="btn piccolo" data-act="fatto-apri" data-id="' + esc(p.id) + '">Fatto ✔</button>' : '');
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
  let h = puoModificare() ? '<a class="btn primary big wide" href="#nuovo">＋ Aggiungi un promemoria</a>' : '';
  if (!d.promemoria.length) return h + '<section class="card vuoto"><div class="ico">📭</div><p class="muted">Ancora nessun promemoria.</p></section>';
  const gruppi = [...d.gruppi.map((g) => ({ g, lista: d.promemoria.filter((p) => p.gruppo === g.id) })),
    { g: null, lista: d.promemoria.filter((p) => !p.gruppo) }].filter((x) => x.lista.length);
  for (const { g, lista } of gruppi) {
    if (gruppi.length > 1 || g) h += '<div class="gruppo-titolo">' + (g ? esc(g.icona) + ' ' + esc(g.nome) : 'Altri') + '</div>';
    for (const p of lista) {
      const pr = prossime(p, t, 1)[0];
      let extra = '';
      if (p.pausa) extra = '⏸ In pausa';
      else if (p.quando.tipo === 'rotazione' && p.quando.settimane.length > 1) extra = 'Questa settimana: ' + p.quando.settimane[settimanaDi(p.quando, t)].nome;
      if (!p.pausa && pr && p.quando.tipo !== 'scadenza') extra += (extra ? ' · ' : '') + 'Prossima volta: ' + fmtGiorno(pr.data) + (pr.voci.length ? ' (' + nomiVoci(p, pr.voci).join(', ') + ')' : '');
      h += '<a class="prom' + (p.pausa ? ' pausa' : '') + '" href="#modifica/' + esc(p.id) + '"><span class="ico" aria-hidden="true">' + esc(iconaDi(p)) + '</span><span class="corpo">' +
        '<span class="titolo">' + esc(p.titolo) + '</span><br><span class="descr">' + esc(riassunto(p)) + '</span>' +
        (extra ? '<br><span class="descr"><b>' + esc(extra) + '</b></span>' : '') + '</span></a>';
    }
  }
  return h;
}

/* ---------- nuovo promemoria: scelta del modello ---------- */
export function vistaNuovo() {
  return '<section class="card"><h2>Cosa vuoi ricordare?</h2><p class="muted small">Scegli la cosa più simile: dopo puoi cambiare tutto.</p><div class="modelli">' +
    MODELLI.map((m) => '<button data-act="usa-modello" data-id="' + m.id + '"><span class="ico">' + m.icona + '</span><b>' + esc(m.nome) + '</b><span>' + esc(m.descrizione) + '</span></button>').join('') +
    '</div></section><a class="btn ghost" href="#promemoria">← Indietro</a>';
}

/* ---------- modello Auto ---------- */
export function vistaAuto() {
  const a = S.ui.auto ??= { nome: '', icona: '🚗', scadenze: {}, preavviso: 20, immatricolazione: '' };
  let h = '<section class="card"><div class="passo"><span class="n">1</span><h2>Quale auto?</h2></div>' +
    '<label class="field">Nome o modello<input type="text" class="grande" data-bind="auto-nome" value="' + esc(a.nome) + '" placeholder="es. Panda"></label>' +
    '<div class="emoji-pick" style="margin-top:10px" role="group" aria-label="Icona">' + ['🚗', '🚙', '🛻', '🚐', '🏍️', '🛵'].map((e) => '<button data-act="auto-icona" data-v="' + e + '" aria-pressed="' + (a.icona === e) + '">' + e + '</button>').join('') + '</div></section>';
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
    '<span class="spazio"></span><button class="btn" data-act="stampa">🖨️ Stampa</button></div></section>';
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
          h += '<span class="ev" style="background:' + c + ';color:' + testoSu(c) + '">' + esc(iconaDi(p) + ' ' + p.titolo) + '</span>';
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
  let h = '<section class="card"><h2>📅 Gli avvisi sul telefono</h2>' +
    '<p>Aggiungi la bacheca al calendario del telefono <b>una volta sola</b>: da lì in poi gli avvisi arrivano come quelli degli appuntamenti, e le modifiche fatte qui si aggiornano da sole.</p>' +
    '<div class="stack">' +
    '<a class="btn primary big" href="' + esc(linkWebcal()) + '">🍎 iPhone o iPad</a>' +
    '<a class="btn primary big" href="' + esc(linkGoogle()) + '" target="_blank" rel="noopener">🤖 Android (Google Calendar)</a>' +
    '<button class="btn" data-act="copia" data-testo="' + esc(linkFeed()) + '">Copia l\'indirizzo per un altro calendario</button></div>' +
    '<details class="altro"><summary>Come funziona, passo per passo</summary>' +
    '<h3 style="margin-top:8px">iPhone</h3><ol class="passi-guida"><li>Tocca <b>iPhone o iPad</b> e conferma con <b>Iscriviti</b>.</li><li>Controlla che "Rimuovi avvisi" sia <b>disattivato</b>, poi tocca <b>Aggiungi</b>.</li></ol>' +
    '<h3>Android</h3><ol class="passi-guida"><li>Tocca <b>Android</b>: si apre Google Calendar nel browser, entra con il tuo account Google e conferma <b>Aggiungi</b>.</li>' +
    '<li>Nell\'app Google Calendar apri il menu ☰ › Impostazioni, scegli il calendario "' + esc(d.nome) + '" e attiva <b>Sincronizza</b>.</li>' +
    '<li>Sempre lì, in <b>Notifiche predefinite</b>, scegli "All\'inizio dell\'evento" (0 minuti): gli eventi sono già all\'ora dell\'avviso.</li></ol>' +
    '<p class="small muted">Google aggiorna i calendari esterni ogni qualche ora: una modifica fatta adesso può arrivare sul telefono con un po\' di ritardo. Su Android l\'app gratuita <b>ICSx⁵</b> (incolla l\'indirizzo copiato) aggiorna più spesso.</p>' +
    '<p class="small muted">Non vuoi abbonarti? <button class="btn ghost piccolo" data-act="ics-scarica">Scarica un file .ics</button> con i prossimi 6 mesi (non si aggiorna da solo).</p></details></section>';

  h += '<section class="card"><h2>📱 Sulla schermata Home</h2><p>Così apri la bacheca come un\'app.</p><ul class="passi-guida">' +
    '<li><b>iPhone</b> (Safari): tocca Condividi <span aria-hidden="true">⎋</span> › <b>Aggiungi alla schermata Home</b>.</li>' +
    '<li><b>Android</b> (Chrome): menu ⋮ › <b>Aggiungi a schermata Home</b> (o "Installa app").</li></ul></section>';

  h += '<section class="card"><h2>👨‍👩‍👧 Condividi con la famiglia</h2>';
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

  h += '<section class="card"><h2>⚙️ Impostazioni</h2><label class="field">Nome della bacheca<input type="text" data-bind="nome-bacheca" value="' + esc(d.nome) + '" maxlength="60"></label>' +
    '<h3 style="margin-top:16px">Gruppi</h3><p class="small muted">Per raccogliere i promemoria: un\'auto, la casa, una persona…</p>';
  d.gruppi.forEach((g, i) => {
    h += '<div class="riga-ed"><input type="color" data-bind="gruppo-colore" data-i="' + i + '" value="' + g.colore + '" aria-label="Colore di ' + esc(g.nome) + '">' +
      '<label class="field stretto">Icona<select data-bind="gruppo-icona" data-i="' + i + '">' + [...new Set([g.icona, ...ICONE])].filter(Boolean).map((e) => '<option' + (e === g.icona ? ' selected' : '') + '>' + esc(e) + '</option>').join('') + '</select></label>' +
      '<label class="field">Nome<input type="text" data-bind="gruppo-nome" data-i="' + i + '" value="' + esc(g.nome) + '"></label>' +
      (S.ui.conferma === 'g' + g.id ? '<button class="btn danger" data-act="gruppo-del-ok" data-i="' + i + '">Conferma</button>' : '<button class="btn danger" data-act="gruppo-del" data-i="' + i + '">Elimina</button>') + '</div>';
  });
  h += '<button class="btn" data-act="gruppo-add" style="margin-top:8px">＋ Nuovo gruppo</button></section>';

  h += '<section class="card"><h2>🛟 Copie di sicurezza</h2><p class="small muted">Il server tiene da solo le ultime versioni: se qualcosa è andato storto puoi tornare indietro.</p>';
  if (!S.ui.copie) h += '<button class="btn" data-act="storico">Mostra le versioni precedenti</button>';
  else if (!S.ui.copie.length) h += '<p class="muted">Ancora nessuna copia: si crea da sola quando modifichi la bacheca.</p>';
  else {
    h += '<div class="list">' + S.ui.copie.map((c) => '<div class="item"><div class="d">' + esc(new Date(c.salvata).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })) + '</div><div>' +
      (S.ui.conferma === 'v' + c.versione ? '<button class="btn danger piccolo" data-act="ripristina-ok" data-v="' + c.versione + '">Conferma: torna a questa versione</button>' : '<button class="btn piccolo" data-act="ripristina" data-v="' + c.versione + '">Ripristina</button>') + '</div></div>').join('') + '</div>';
  }
  h += '<div class="row" style="margin-top:12px"><button class="btn" data-act="backup">Scarica una copia (file)</button><button class="btn" data-act="importa">Importa da file</button></div>' +
    '<p class="small muted" style="margin:8px 0 0">L\'importazione <b>aggiunge</b> i promemoria del file a quelli che ci sono. Va bene anche il file .yaml della vecchia app "Raccolta rifiuti".</p></section>';

  h += '<section class="card"><h2>🔒 Cambia i link</h2><p class="small muted">Se un link è finito nelle mani sbagliate, cambialo: quello vecchio smette di funzionare. Poi rimanda quello nuovo a chi serve (per il calendario: va riaggiunto sui telefoni).</p><div class="row">' +
    (S.ui.conferma === 'rig-modifica' ? '<button class="btn danger" data-act="rigenera-ok" data-quale="modifica">Conferma: cambia il link per modificare</button>' : '<button class="btn danger" data-act="rigenera" data-quale="modifica">Cambia il link per modificare</button>') +
    (S.ui.conferma === 'rig-lettura' ? '<button class="btn danger" data-act="rigenera-ok" data-quale="lettura">Conferma: cambia sola lettura e calendario</button>' : '<button class="btn danger" data-act="rigenera" data-quale="lettura">Cambia sola lettura e calendario</button>') +
    '</div></section>';
  return h;
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
  'auto-icona'(el) { S.ui.auto.icona = el.dataset.v; render(); },
  'auto-crea'() {
    const a = S.ui.auto;
    if (!a.nome.trim()) { toast('Scrivi il nome dell\'auto.'); return; }
    const { gruppo, promemoria } = creaAuto({ nome: a.nome.trim(), icona: a.icona, scadenze: a.scadenze, preavviso: a.preavviso });
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
    modifica((d) => d.gruppi.push({ id: nuovoId('g'), nome: 'Nuovo gruppo', icona: '🏠', colore: COLORI[d.gruppi.length % COLORI.length] }));
  },
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
  'gruppo-icona'(el) { modifica((d) => { d.gruppi[+el.dataset.i].icona = el.value; }); },
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

