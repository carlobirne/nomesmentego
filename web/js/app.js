// Avvio, navigazione tra le schermate e gestione degli eventi.
import { S, suRidisegna, render, apri, ricarica, aggiornaIndicatore, puoModificare } from './stato.js';
import { api } from './api.js';
import { $, toast } from './ui.js';
import { vistaHome, vistaErrore, vistaOggi, vistaPromemoria, vistaNuovo, vistaAuto, vistaCalendario, vistaCondividi, AZIONI, LEGAMI, importaFile } from './viste.js';
import { vistaEditor, apriEditor, chiudiEditor, AZIONI_EDITOR, LEGAMI_EDITOR, dopoInput } from './editor.js';

const SCHEDE = { oggi: vistaOggi, promemoria: vistaPromemoria, calendario: vistaCalendario, condividi: vistaCondividi, nuovo: vistaNuovo, auto: vistaAuto, modifica: vistaEditor };
const SOLO_MODIFICA = ['nuovo', 'auto', 'modifica'];
const SCHEDA_DI = { nuovo: 'promemoria', auto: 'promemoria', modifica: 'promemoria' };

/* ---------- percorso: /b/<token> (modifica) o /v/<token> (sola lettura) ---------- */
const m = /^\/(b|v)\/([A-Za-z0-9_-]{20,64})\/?$/.exec(location.pathname);

function leggiHash() {
  const [vista, param = ''] = location.hash.replace(/^#/, '').split('/');
  S.vista = SCHEDE[vista] ? vista : 'oggi';
  S.param = decodeURIComponent(param);
  if (!S.dati) return;
  if (SOLO_MODIFICA.includes(S.vista) && !puoModificare()) { S.vista = 'oggi'; return; }
  if (S.vista === 'modifica') {
    if (!apriEditor(S.param)) { location.replace('#promemoria'); S.vista = 'promemoria'; }
  } else if (S.bozza) chiudiEditor();
  if (S.vista !== 'oggi') S.ui.fatto = null;
}

function ridisegna() {
  const vista = $('#vista');
  const schede = $('#schede');
  const titolo = $('#titolo'), titoloLink = $('#titoloLink');
  if (!m) {
    titolo.textContent = 'Nomesmentego'; titoloLink.href = '/';
    $('#rinomina').classList.add('hidden');
    schede.classList.add('hidden');
    vista.innerHTML = vistaHome();
    return;
  }
  if (!S.dati) {
    vista.innerHTML = S.errore ? vistaErrore() : '<p class="muted">Caricamento…</p>';
    aggiornaIndicatore();
    return;
  }
  if (S.vista === 'modifica' && !S.bozza) leggiHash();
  titolo.textContent = S.dati.nome; titoloLink.href = '#oggi';
  $('#rinomina').classList.toggle('hidden', !puoModificare());
  document.title = S.dati.nome + ' · Promemoria';
  schede.classList.remove('hidden');
  const attiva = SCHEDA_DI[S.vista] || S.vista;
  schede.querySelectorAll('a').forEach((a) => a.setAttribute('aria-current', a.dataset.scheda === attiva ? 'page' : 'false'));
  const offline = S.offline ? '<p class="notice attenzione small">Sei senza connessione: vedi l\'ultima versione salvata su questo telefono. Le modifiche tornano disponibili appena c\'è rete.</p>' : '';
  vista.innerHTML = offline + SCHEDE[S.vista]();
  aggiornaIndicatore();
}
suRidisegna(ridisegna);

/* ---------- eventi ---------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = AZIONI[el.dataset.act] || AZIONI_EDITOR[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  if (!['ripristina', 'rigenera', 'gruppo-del', 'ed-elimina', 'ed-sett-del', 'tg-togli', 'push-togli', 'email-togli'].includes(el.dataset.act) && !el.dataset.act.endsWith('-ok')) S.ui.conferma = null;
  try { await fn(el, ev); } catch (e) { console.error(e); toast('Qualcosa non ha funzionato: ' + e.message); }
});

const testuale = (el) => el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'number', 'url', ''].includes(el.type));
const legame = (el) => LEGAMI[el.dataset.bind] || LEGAMI_EDITOR[el.dataset.bind];

document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-bind]');
  if (!el || !testuale(el) || !legame(el)) return;
  legame(el)(el, 'input');
  if (S.bozza) dopoInput();
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-bind]');
  if (!el || !legame(el)) return;
  const ridisegnare = legame(el)(el, 'change');
  if (ridisegnare) render(); else if (S.bozza) dopoInput();
});

$('#fileImport').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (f) await importaFile(f);
});

window.addEventListener('hashchange', () => { leggiHash(); render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ricarica(); });
setInterval(() => { if (document.visibilityState === 'visible') ricarica(); }, 120_000);
window.addEventListener('beforeunload', (ev) => {
  if (S.salvataggio !== 'ok' && !S.offline) { ev.preventDefault(); ev.returnValue = ''; }
});

/* ---------- avvio ---------- */
// service worker: serve solo per ricevere le notifiche dell'app
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

(async function avvio() {
  if (!m) {
    render();
    try { S.ui.serveCodice = (await api.config()).serveCodice; render(); } catch { /* offline: niente */ }
    return;
  }
  const [, tipo, token] = m;
  // chi ha anche il link di modifica di questa bacheca (es. arriva da una notifica) torna lì
  if (tipo === 'v') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k.startsWith('nms.cache.')) continue;
        const c = JSON.parse(localStorage.getItem(k));
        if (c?.permesso === 'modifica' && c.lettura === token) { location.replace('/b/' + k.slice(10) + location.hash); return; }
      }
    } catch { /* archiviazione non disponibile */ }
  }
  // "Aggiungi a schermata Home" deve riaprire questa bacheca, non la pagina iniziale
  $('#manifest').href = '/manifest/' + tipo + '/' + token;
  leggiHash();
  await apri(token, tipo);
  if (S.dati) {
    $('#manifest').href = '/manifest/' + tipo + '/' + token + '?nome=' + encodeURIComponent(S.dati.nome);
    leggiHash();
    render();
  }
})();
