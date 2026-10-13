"use strict";
/* ---------- costanti e utilità ---------- */
const STORE_KEY = 'raccolta-rifiuti.config.v1';
const DAY_KEYS = ['lun','mar','mer','gio','ven','sab','dom'];
const DAY_NAMES = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAY_SHORT = ['lun','mar','mer','gio','ven','sab','dom'];
const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + Math.random().toString(36).slice(2,8);
const pad = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; };
const addDays = (d,n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); return x; };
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const dayIdx = d => (d.getDay()+6)%7;
const mondayOf = d => addDays(d, -dayIdx(d));
const daysBetween = (a,b) => Math.round((b - a)/864e5);
const fmt = d => d.getDate()+' '+MONTHS[d.getMonth()];
const fmtW = d => DAY_SHORT[dayIdx(d)]+' '+fmt(d);
function textOn(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex||''); if(!m) return '#111';
  const n = parseInt(m[1],16), r=(n>>16&255)/255, g=(n>>8&255)/255, b=(n&255)/255;
  const L = c => c<=.03928? c/12.92 : Math.pow((c+.055)/1.055,2.4);
  const lum = .2126*L(r)+.7152*L(g)+.0722*L(b);
  return lum > .4 ? '#111111' : '#ffffff';
}

/* ---------- configurazioni di partenza ---------- */
function emptyWeek(nome, descrizione){ const g={}; DAY_KEYS.forEach(k=>g[k]=[]); return {id:uid('w'), nome, descrizione:descrizione||'', giorni:g}; }
function blankConfig(){
  return normalize({
    titolo:'Raccolta rifiuti', sottotitolo:'', orario:'dalle 21:00 alle 24:00', esponiSeraPrima:true,
    inizioCiclo: iso(mondayOf(today())),
    promemoria:{ora:'20:30', avvisoMinuti:0, mesi:6},
    rifiuti:[
      {id:'umido', nome:'Umido', colore:'#6b3f1f', nota:''},
      {id:'secco', nome:'Secco', colore:'#4d5257', nota:''},
      {id:'plastica', nome:'Plastica e lattine', colore:'#f2c230', nota:''},
      {id:'carta', nome:'Carta e cartone', colore:'#22579a', nota:''},
      {id:'vetro', nome:'Vetro', colore:'#2f7d4f', nota:''}
    ],
    settimane:[emptyWeek('Settimana A'), emptyWeek('Settimana B')],
    eccezioni:[], note:[]
  });
}
function exampleConfig(){
  const A = emptyWeek('Settimana A','quella con secco e plastica');
  const B = emptyWeek('Settimana B','quella con la carta');
  A.giorni.lun=['umido']; A.giorni.mer=['secco']; A.giorni.ven=['umido','plastica'];
  B.giorni.lun=['umido']; B.giorni.ven=['umido']; B.giorni.sab=['carta'];
  return normalize({
    titolo:'Cosa metto fuori stasera?', sottotitolo:'Comune di Pescantina · Zona A1',
    orario:'dalle 21:00 alle 24:00', esponiSeraPrima:true, inizioCiclo:'2026-01-12',
    promemoria:{ora:'20:30', avvisoMinuti:0, mesi:6},
    rifiuti:[
      {id:'umido', nome:'Umido', colore:'#6b3f1f', nota:'Sacchetti mater-bi o carta, nella biopattumiera da 25 l. Mai sfuso.'},
      {id:'secco', nome:'Secco', colore:'#4d5257', nota:'Sacchi semitrasparenti.'},
      {id:'plastica', nome:'Plastica e lattine', colore:'#f2c230', nota:'Sacchi semitrasparenti, imballaggi senza residui.'},
      {id:'carta', nome:'Carta e cartone', colore:'#22579a', nota:'Scatole, buste di carta o legata. Mai in sacchi di plastica.'},
      {id:'verde', nome:'Verde', colore:'#3e7d3a', nota:'Solo con adesione a pagamento. Date variabili: aggiungile come eccezioni.'}
    ],
    settimane:[A,B],
    eccezioni:[
      {id:uid('e'), data:'2027-01-01', azione:'sposta', nuovaData:'2026-12-31', rifiuti:[], nota:'Capodanno: ritiro anticipato a giovedì 31 dicembre'}
    ],
    note:[
      {titolo:'Festività', testo:'Attorno a Natale (25 e 26 dicembre) il calendario ufficiale segnala anticipi: controlla quei giorni.'},
      {titolo:'Pannolini e pannoloni', testo:'Con il secco, oppure nel sacco rosso del Comune accanto al bidoncino nei giorni dell\'umido.'},
      {titolo:'Vetro', testo:'Nelle campane stradali.'},
      {titolo:'Ecocentro, via Bardoline 2', testo:'Pile, farmaci, oli, vernici, RAEE, ingombranti. Lun–ven 16–18:50, mer anche 10–12:30, sab 8:30–13 e 16–18:50.'},
      {titolo:'Numeri utili', testo:'Mancato ritiro (Serit) 800 125 850 · Ingombranti a domicilio 800 734 989 · Ufficio Ecologia 045 6764207.'},
      {titolo:'Regola generale', testo:'Massimo 15 kg per contenitore. In caso di dubbio vale il calendario ufficiale del Comune.'}
    ]
  });
}

/* ---------- validazione / normalizzazione ---------- */
function normalize(raw){
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Il file non contiene una configurazione valida.');
  const c = {};
  c.versione = 1;
  c.titolo = String(raw.titolo ?? 'Raccolta rifiuti');
  c.sottotitolo = String(raw.sottotitolo ?? '');
  c.orario = String(raw.orario ?? '');
  c.esponiSeraPrima = raw.esponiSeraPrima !== false;
  const ic = parseISO(raw.inizioCiclo) || mondayOf(today());
  c.inizioCiclo = iso(mondayOf(ic));
  const p = raw.promemoria || {};
  c.promemoria = {
    ora: /^\d{2}:\d{2}$/.test(p.ora||'') ? p.ora : '20:30',
    avvisoMinuti: Math.max(0, parseInt(p.avvisoMinuti,10) || 0),
    mesi: [1,3,6,12].includes(+p.mesi) ? +p.mesi : 6
  };
  const seen = new Set();
  c.rifiuti = (Array.isArray(raw.rifiuti)? raw.rifiuti : []).map(r => {
    let id = String(r && r.id || '').trim().replace(/\s+/g,'-') || uid('r');
    while(seen.has(id)) id = id + '-2';
    seen.add(id);
    return { id, nome:String(r.nome ?? id), colore: /^#[0-9a-f]{6}$/i.test(r.colore||'') ? r.colore : '#777777', nota:String(r.nota ?? '') };
  });
  const valid = new Set(c.rifiuti.map(r=>r.id));
  const ids = a => (Array.isArray(a)? a : (a? [a] : [])).map(String).filter(x => valid.has(x));
  c.settimane = (Array.isArray(raw.settimane)? raw.settimane : []).map((w,i) => {
    const g = {}; const src = (w && w.giorni) || {};
    DAY_KEYS.forEach(k => g[k] = [...new Set(ids(src[k]))]);
    return { id: String(w && w.id || uid('w')), nome:String(w && w.nome || ('Settimana '+String.fromCharCode(65+i))), descrizione:String(w && w.descrizione || ''), giorni:g };
  });
  if(!c.settimane.length) c.settimane = [emptyWeek('Settimana A')];
  c.eccezioni = (Array.isArray(raw.eccezioni)? raw.eccezioni : []).filter(e => e && parseISO(e.data)).map(e => ({
    id: String(e.id || uid('e')), data: e.data,
    azione: ['annulla','sposta','aggiungi'].includes(e.azione) ? e.azione : 'annulla',
    nuovaData: parseISO(e.nuovaData) ? e.nuovaData : '',
    rifiuti: ids(e.rifiuti), nota: String(e.nota ?? '')
  }));
  c.note = (Array.isArray(raw.note)? raw.note : []).map(n => typeof n === 'string' ? {titolo:'', testo:n} : {titolo:String(n && n.titolo || ''), testo:String(n && n.testo || '')});
  return c;
}

/* ---------- motore del calendario ---------- */
let cfg = null;
function weekIndex(d){
  const n = cfg.settimane.length;
  const w = Math.floor(daysBetween(parseISO(cfg.inizioCiclo), mondayOf(d)) / 7);
  return ((w % n) + n) % n;
}
function baseOn(d){ return cfg.settimane[weekIndex(d)].giorni[DAY_KEYS[dayIdx(d)]].slice(); }
function collectionsOn(d){
  const key = iso(d);
  let list = baseOn(d);
  const notes = []; let changed = false;
  for(const e of cfg.eccezioni){
    if(e.data === key && (e.azione === 'annulla' || e.azione === 'sposta')){
      const rem = e.rifiuti.length ? e.rifiuti : list.slice();
      if(rem.some(r => list.includes(r))){ list = list.filter(r => !rem.includes(r)); changed = true; if(e.nota) notes.push(e.nota); else notes.push(e.azione==='sposta' ? 'Spostato al '+fmtW(parseISO(e.nuovaData)||d) : 'Raccolta annullata'); }
    }
  }
  for(const e of cfg.eccezioni){
    if(e.azione === 'sposta' && e.nuovaData === key){
      const add = e.rifiuti.length ? e.rifiuti : baseOn(parseISO(e.data));
      add.forEach(r => { if(!list.includes(r)) list.push(r); });
      if(add.length){ changed = true; notes.push(e.nota || ('Recupero del '+fmtW(parseISO(e.data)))); }
    }
    if(e.azione === 'aggiungi' && e.data === key){
      e.rifiuti.forEach(r => { if(!list.includes(r)) list.push(r); });
      if(e.rifiuti.length){ changed = true; if(e.nota) notes.push(e.nota); }
    }
  }
  const order = cfg.rifiuti.map(r=>r.id);
  list.sort((a,b) => order.indexOf(a) - order.indexOf(b));
  return {ids:list, notes:[...new Set(notes)], changed};
}
const rifiuto = id => cfg.rifiuti.find(r => r.id === id);
const exposeDate = d => cfg.esponiSeraPrima ? addDays(d,-1) : d;
function upcoming(fromDate, days){
  const out = [];
  for(let i=0;i<days;i++){ const d = addDays(fromDate,i); const c = collectionsOn(d); if(c.ids.length || c.notes.length) out.push({d, ...c}); }
  return out;
}
function nextDatesFor(id, from, count){
  const out = [];
  for(let i=0;i<450 && out.length<count;i++){ const d = addDays(from,i); const c = collectionsOn(d); if(c.ids.includes(id)) out.push({d, changed:c.changed}); }
  return out;
}
function isWeekly(id){ return cfg.settimane.every(w => DAY_KEYS.some(k => w.giorni[k].includes(id))) && cfg.settimane.length>0; }

/* ---------- salvataggio locale ---------- */
function save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }catch(e){} renderHeader(); }
function load(){ try{ const s = localStorage.getItem(STORE_KEY); if(s) return normalize(JSON.parse(s)); }catch(e){} return null; }

/* ---------- file: download e import ---------- */
let dlNs; // undefined = non ancora richiesto
async function getDownloads(){
  if(dlNs !== undefined) return dlNs;
  if(!(window.claude && typeof window.claude.use === 'function')){ dlNs = null; return null; }
  try{ dlNs = await window.claude.use('downloads'); }catch(e){ dlNs = null; }
  return dlNs;
}
const inClaude = () => !!(window.claude && typeof window.claude.use === 'function');
const CLAUDE_EXT = ['txt','json','md','html','csv','pdf'];
async function saveFile(filename, content, mime){
  const ns = await getDownloads();
  if(ns){
    let name = filename; const ext = name.split('.').pop().toLowerCase();
    if(!CLAUDE_EXT.includes(ext)) name = name + '.txt';
    try{ await ns.save({filename:name, data:content}); return {ok:true, renamed: name!==filename, name}; }
    catch(e){
      if(e && e.code === 'declined') return {ok:false, msg:'Download annullato.'};
      if(e && e.code === 'rate_limited') return {ok:false, msg:'C\'è già una richiesta di download aperta. Riprova tra poco.'};
      // altrimenti prova il download classico
    }
  }
  try{
    const blob = new Blob([content], {type:mime || 'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return {ok:true, name:filename};
  }catch(e){ return {ok:false, msg:'Il download non è disponibile qui. Usa "Mostra il testo" e copialo.'}; }
}
function toYAML(c){
  const out = {
    titolo:c.titolo, sottotitolo:c.sottotitolo, orario:c.orario, esponiSeraPrima:c.esponiSeraPrima,
    inizioCiclo:c.inizioCiclo, promemoria:c.promemoria,
    rifiuti:c.rifiuti.map(r=>({id:r.id, nome:r.nome, colore:r.colore, nota:r.nota})),
    settimane:c.settimane.map(w=>{ const g={}; DAY_KEYS.forEach(k=>{ if(w.giorni[k].length) g[k]=w.giorni[k]; }); return {nome:w.nome, descrizione:w.descrizione, giorni:g}; }),
    eccezioni:c.eccezioni.map(e=>{ const o={data:e.data, azione:e.azione}; if(e.azione==='sposta') o.nuovaData=e.nuovaData; if(e.rifiuti.length) o.rifiuti=e.rifiuti; if(e.nota) o.nota=e.nota; return o; }),
    note:c.note
  };
  const head = '# Configurazione "Raccolta rifiuti" (versione 1)\n# Reimportala nell\'app da Stampa e backup > Importa.\n# Giorni: lun mar mer gio ven sab dom = giorni di RITIRO.\n# inizioCiclo: un lunedì in cui comincia la prima settimana della lista.\n# Eccezioni: azione annulla | sposta (con nuovaData) | aggiungi. Senza "rifiuti" vale per tutti.\n\n';
  return head + jsyaml.dump(out, {lineWidth:-1, noRefs:true, quotingType:'"'});
}
function fromText(text){
  let data;
  try{ data = jsyaml.load(text, {schema: jsyaml.JSON_SCHEMA}); }
  catch(e){ throw new Error('Non riesco a leggere il testo: '+(e.reason || e.message)+(e.mark? ' (riga '+(e.mark.line+1)+')':'')); }
  return normalize(data);
}

/* ---------- ICS ---------- */
function icsEscape(s){ return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
function fold(line){
  const enc = new TextEncoder(); if(enc.encode(line).length <= 74) return line;
  let out = '', cur = '', len = 0;
  for(const ch of line){ const l = enc.encode(ch).length; if(len + l > 73){ out += cur + '\r\n '; cur=''; len=1; } cur += ch; len += l; }
  return out + cur;
}
function buildICS(){
  const now = new Date();
  const stamp = now.getUTCFullYear()+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'+pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
  const [hh,mm] = cfg.promemoria.ora.split(':').map(Number);
  const start = today(); const end = new Date(start.getFullYear(), start.getMonth()+cfg.promemoria.mesi, start.getDate());
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Raccolta rifiuti//IT','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEscape('Rifiuti'+(cfg.sottotitolo? ' – '+cfg.sottotitolo : ''))];
  const slug = (cfg.sottotitolo || cfg.titolo || 'rifiuti').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,30);
  let count = 0;
  for(let i=0; addDays(start,i) < end; i++){
    const d = addDays(start, i); const c = collectionsOn(d); if(!c.ids.length) continue;
    const ex = exposeDate(d); if(ex < start) continue;
    const names = c.ids.map(id => rifiuto(id)?.nome).filter(Boolean);
    const dt = ex.getFullYear()+pad(ex.getMonth()+1)+pad(ex.getDate())+'T'+pad(hh)+pad(mm)+'00';
    const endT = new Date(ex.getFullYear(), ex.getMonth(), ex.getDate(), hh, mm+15);
    const dtEnd = endT.getFullYear()+pad(endT.getMonth()+1)+pad(endT.getDate())+'T'+pad(endT.getHours())+pad(endT.getMinutes())+'00';
    const summary = (cfg.esponiSeraPrima ? 'Esponi: ' : 'Ritiro: ') + names.join(', ');
    const desc = [cfg.esponiSeraPrima ? ('Ritiro '+fmtW(d)+'. Esponi '+(cfg.orario||'la sera prima')+'.') : ('Ritiro '+fmtW(d)+'.')]
      .concat(c.notes).concat(c.ids.map(id => { const r = rifiuto(id); return r && r.nota ? r.nome+': '+r.nota : ''; }).filter(Boolean)).join('\n');
    lines.push('BEGIN:VEVENT','UID:'+iso(d)+'-'+slug+'@raccolta-rifiuti','DTSTAMP:'+stamp,'DTSTART:'+dt,'DTEND:'+dtEnd,
      'SUMMARY:'+icsEscape(summary),'DESCRIPTION:'+icsEscape(desc),'TRANSP:TRANSPARENT',
      'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(summary),'TRIGGER:-PT'+cfg.promemoria.avvisoMinuti+'M','END:VALARM','END:VEVENT');
    count++;
  }
  lines.push('END:VCALENDAR');
  return {text: lines.map(fold).join('\r\n') + '\r\n', count};
}

/* ---------- foglio A4 ---------- */
function chipHTML(id, cls){
  const r = rifiuto(id); if(!r) return '';
  return '<span class="'+(cls||'sh-chip')+'" style="background:'+r.colore+';color:'+textOn(r.colore)+'">'+esc(r.nome)+'</span>';
}
function sheetHTML(){
  const W = cfg.settimane; const t0 = today();
  const usedDays = DAY_KEYS.map((k,i)=>i).filter(i => W.some(w => w.giorni[DAY_KEYS[i]].length));
  const cols = W.length;
  let h = '<div class="sh">';
  h += '<div class="sh-head"><div><div class="sh-sub">'+esc(cfg.sottotitolo)+'</div><div class="sh-title">'+esc(cfg.titolo)+'</div></div>';
  h += '<div class="sh-when">'+(cfg.esponiSeraPrima ? '<b>Sera prima'+(cfg.orario? ', '+esc(cfg.orario):'')+'</b>' : (cfg.orario? '<b>'+esc(cfg.orario)+'</b>' : ''))+'</div></div>';
  if(!usedDays.length){ h += '<p class="sh-empty">Nessun giorno di raccolta impostato.</p>'; }
  else{
    h += '<div class="sh-table" style="grid-template-columns:1.1fr repeat('+cols+',minmax(0,1fr))">';
    h += '<div class="sh-th">'+(cfg.esponiSeraPrima ? 'La sera di…' : 'Giorno')+'</div>';
    W.forEach(w => { h += '<div class="sh-th sh-thw"><span class="sh-wn">'+esc(w.nome)+'</span>'+(w.descrizione? '<span class="sh-wd">'+esc(w.descrizione)+'</span>':'')+'</div>'; });
    usedDays.forEach(i => {
      const prev = (i+6)%7;
      h += '<div class="sh-td sh-day">'+(cfg.esponiSeraPrima ? '<span class="sh-dn">'+DAY_NAMES[prev]+'</span><span class="sh-dr">ritiro '+DAY_NAMES[i].toLowerCase()+'</span>' : '<span class="sh-dn">'+DAY_NAMES[i]+'</span>')+'</div>';
      W.forEach(w => { const ids = w.giorni[DAY_KEYS[i]]; h += '<div class="sh-td sh-cell">'+(ids.length ? ids.map(id=>chipHTML(id)).join('') : '<span class="sh-none">niente</span>')+'</div>'; });
    });
    h += '</div>';
  }
  const nonWeekly = cfg.rifiuti.filter(r => !isWeekly(r.id)).map(r => ({r, dates: nextDatesFor(r.id, t0, 8)})).filter(x => x.dates.length);
  if(cols > 1 || nonWeekly.length){
    h += '<div class="sh-sec"><div class="sh-h2">'+(cols>1 ? 'Che settimana è? Prossime date di ritiro' : 'Prossime date di ritiro')+'</div>';
    if(cols > 1){
      h += '<div class="sh-line">';
      W.forEach((w,wi) => {
        const mons = []; for(let k=0; mons.length<6 && k<60; k++){ const m = addDays(mondayOf(t0), k*7); if(weekIndex(m)===wi && m >= addDays(mondayOf(t0),0)) mons.push(fmt(m)); }
        h += '<span><b>'+esc(w.nome)+'</b> dal lunedì '+mons.join(', ')+'</span>';
      });
      h += '</div>';
    }
    if(nonWeekly.length){
      h += '<div class="sh-dates">';
      nonWeekly.forEach(({r,dates}) => {
        h += '<div class="sh-db" style="border-color:'+r.colore+'"><div class="sh-dbt"><span class="sh-dot" style="background:'+r.colore+'"></span>'+esc(r.nome)+'</div><div class="sh-dbl">'+dates.map(x => x.changed ? '<b>'+fmtW(x.d)+'*</b>' : fmt(x.d)).join(' · ')+'</div></div>';
      });
      h += '</div><div class="sh-foot">Date del giorno di ritiro'+(cfg.esponiSeraPrima? ': esponi la sera prima':'')+'. * = data cambiata da un\'eccezione.</div>';
    }
    h += '</div>';
  }
  const futureExc = cfg.eccezioni.filter(e => parseISO(e.data) >= t0 || (e.nuovaData && parseISO(e.nuovaData) >= t0)).sort((a,b)=>a.data.localeCompare(b.data));
  const notes = cfg.note.filter(n => n.titolo || n.testo);
  const rnotes = cfg.rifiuti.filter(r => r.nota);
  if(futureExc.length || notes.length || rnotes.length){
    h += '<div class="sh-sec"><div class="sh-h2">Note ed eccezioni</div><div class="sh-notes">';
    futureExc.forEach(e => {
      const what = e.rifiuti.length ? e.rifiuti.map(id=>rifiuto(id)?.nome).filter(Boolean).join(', ') : 'tutte le raccolte';
      const act = e.azione==='annulla' ? 'annullato' : e.azione==='sposta' ? 'spostato a '+fmtW(parseISO(e.nuovaData)||parseISO(e.data)) : 'raccolta in più';
      h += '<div><b>'+fmtW(parseISO(e.data))+'</b> · '+esc(what)+': '+act+(e.nota? '. '+esc(e.nota):'')+'</div>';
    });
    rnotes.forEach(r => { h += '<div><b>'+esc(r.nome)+'.</b> '+esc(r.nota)+'</div>'; });
    notes.forEach(n => { h += '<div>'+(n.titolo? '<b>'+esc(n.titolo)+'.</b> ':'')+esc(n.testo)+'</div>'; });
    h += '</div></div>';
  }
  h += '</div>';
  return h;
}
const SHEET_CSS = /*@SHEET_CSS_JSON@*/"";
function standaloneSheet(){
  const css = SHEET_CSS;
  return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(cfg.titolo)+'</title>'+
    '<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" rel="stylesheet">'+
    '<style>:root{--font-body:\'Atkinson Hyperlegible\',\'Segoe UI\',Helvetica,Arial,sans-serif;--font-display:\'Bricolage Grotesque\',\'Segoe UI\',Helvetica,Arial,sans-serif}body{margin:0;background:#e5e7e4;font-family:var(--font-body)}.bar{max-width:794px;margin:16px auto;display:flex;gap:10px;align-items:center;font-family:var(--font-body)}.bar button{min-height:44px;padding:10px 16px;border-radius:10px;border:0;background:#1d3b2f;color:#fff;font-weight:700;font-size:16px;cursor:pointer}.page{max-width:794px;margin:0 auto 24px;background:#fff;padding:34px 38px;box-shadow:0 2px 12px rgba(0,0,0,.15)}@media print{@page{size:A4;margin:10mm}body{background:#fff}.bar{display:none}.page{box-shadow:none;padding:0;max-width:none}}'+css+'</style></head><body>'+
    '<div class="bar"><button onclick="window.print()">Stampa o salva in PDF</button><span>Formato A4, verticale.</span></div><div class="page">'+sheetHTML()+'</div></body></html>';
}

/* ---------- interfaccia ---------- */
let tab = 'oggi', weekSel = 0, pendingDelete = null, showYaml = false;
function toast(msg){ const t = document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent = msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 3200); }
function renderHeader(){
  $('#hdrTitle').textContent = cfg ? (cfg.titolo || 'Raccolta rifiuti') : 'Raccolta rifiuti';
  $('#hdrSub').textContent = cfg ? cfg.sottotitolo : '';
  const b = $('#hdrWeek');
  if(cfg && cfg.settimane.length > 1){ b.textContent = 'Questa settimana: '+cfg.settimane[weekIndex(today())].nome; b.classList.remove('hidden'); } else b.classList.add('hidden');
  $('#tabs').classList.toggle('hidden', !cfg);
  document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-current', x.dataset.tab===tab ? 'page' : 'false'));
}
function render(){
  renderHeader();
  const v = $('#view');
  if(!cfg){ v.innerHTML = viewWelcome(); return; }
  if(weekSel >= cfg.settimane.length) weekSel = 0;
  v.innerHTML = ({oggi:viewOggi, settimane:viewSettimane, rifiuti:viewRifiuti, eccezioni:viewEccezioni, testi:viewTesti, esporta:viewEsporta}[tab] || viewOggi)();
  if(tab==='esporta') fitPreview();
  $('#printRoot').innerHTML = sheetHTML();
}
function viewWelcome(){
  return '<section class="card"><h2>Crea il tuo calendario</h2><p class="muted">Imposti tipi di rifiuto, settimane e giorni di ritiro. Tutto resta salvato su questo dispositivo, e puoi esportarlo in un file quando vuoi.</p>'+
  '<div class="welcome">'+
  '<button class="btn primary" data-act="start-blank">Parti da zero<span>Due settimane vuote (A e B) e i rifiuti più comuni, da modificare.</span></button>'+
  '<button class="btn" data-act="start-example">Usa l\'esempio Pescantina Zona A1<span>Il calendario 2026 già compilato, da adattare.</span></button>'+
  '<button class="btn" data-act="import-file">Importa una configurazione salvata<span>File .yaml, .txt o .json esportato da questa app.</span></button>'+
  '</div></section>';
}
function chipsFor(ids, big){ return '<div class="chips">'+ids.map(id => { const r = rifiuto(id); return r ? '<span class="chip'+(big?' big':'')+'" style="background:'+r.colore+';color:'+textOn(r.colore)+'">'+esc(r.nome)+'</span>' : ''; }).join('')+'</div>'; }
function viewOggi(){
  const t = today();
  const target = cfg.esponiSeraPrima ? addDays(t,1) : t;
  const c = collectionsOn(target);
  let h = '<section class="card tonight" aria-live="polite">';
  h += '<div class="label">'+(cfg.esponiSeraPrima ? 'Stasera, '+fmtW(t)+(cfg.orario? ', '+esc(cfg.orario):'') : 'Oggi, '+fmtW(t))+'</div>';
  if(c.ids.length){
    h += '<div class="when">'+(cfg.esponiSeraPrima ? 'Metti fuori' : 'Si ritira')+'</div>'+chipsFor(c.ids, true);
    if(cfg.esponiSeraPrima) h += '<p class="small" style="margin:12px 0 0">Ritiro '+fmtW(target)+'.</p>';
  } else {
    h += '<div class="when">Niente da esporre</div>';
    const nx = upcoming(addDays(target,1), 30).find(x => x.ids.length);
    if(nx) h += '<p class="none">Prossimo: '+(cfg.esponiSeraPrima ? DAY_NAMES[dayIdx(exposeDate(nx.d))].toLowerCase()+' sera ('+fmt(exposeDate(nx.d))+')' : fmtW(nx.d))+'</p>'+chipsFor(nx.ids);
    else h += '<p class="none">Nessuna raccolta nei prossimi 30 giorni. Imposta i giorni in Settimane.</p>';
  }
  c.notes.forEach(n => h += '<p class="small" style="margin:10px 0 0"><b>Nota:</b> '+esc(n)+'</p>');
  h += '</section>';
  const list = upcoming(addDays(target,1), 14);
  h += '<section class="card"><h2>Prossimi 14 giorni</h2>';
  if(!list.length) h += '<p class="muted">Nessuna raccolta in programma.</p>';
  else{
    h += '<div class="list">';
    list.forEach(x => {
      const e = exposeDate(x.d);
      h += '<div class="item"><div class="d">'+(cfg.esponiSeraPrima ? DAY_SHORT[dayIdx(e)]+' '+fmt(e)+' sera<span>ritiro '+fmtW(x.d)+'</span>' : fmtW(x.d))+'</div><div>'+(x.ids.length? chipsFor(x.ids) : '<span class="muted">niente</span>')+x.notes.map(n=>'<div class="exc-note">'+esc(n)+'</div>').join('')+'</div></div>';
    });
    h += '</div>';
  }
  h += '</section>';
  return h;
}
function viewSettimane(){
  const W = cfg.settimane; const w = W[weekSel]; const t = today();
  let h = '<section class="card"><h2>Le tue settimane</h2><p class="muted small">Si ripetono in ordine, una dopo l\'altra. Per ogni giorno di <b>ritiro</b> tocca i rifiuti che passano'+(cfg.esponiSeraPrima?'; l\'app calcola da sola la sera in cui esporli':'')+'.</p>';
  h += '<div class="week-tabs" role="group" aria-label="Scegli la settimana">'+W.map((x,i)=>'<button data-act="week-sel" data-i="'+i+'" aria-pressed="'+(i===weekSel)+'">'+esc(x.nome)+'</button>').join('')+'</div>';
  h += '<div class="row" style="margin-top:10px"><button class="btn" data-act="week-add">Aggiungi settimana</button><button class="btn" data-act="week-dup">Duplica questa</button>'+
       (W.length>1 ? (pendingDelete==='w'+w.id ? '<button class="btn danger" data-act="week-del-ok">Conferma: elimina '+esc(w.nome)+'</button>' : '<button class="btn danger" data-act="week-del">Elimina questa</button>') : '')+'</div>';
  h += '</section>';
  h += '<section class="card"><div class="row"><label class="field">Nome<input type="text" data-bind="week-nome" value="'+esc(w.nome)+'"></label><label class="field">Descrizione breve (facoltativa)<input type="text" data-bind="week-desc" value="'+esc(w.descrizione)+'" placeholder="es. quella con la carta"></label></div>';
  DAY_KEYS.forEach((k,i) => {
    h += '<div class="dayrow"><div class="dn">'+DAY_NAMES[i]+(cfg.esponiSeraPrima? '<span>esponi '+DAY_NAMES[(i+6)%7].toLowerCase()+' sera</span>':'')+'</div><div class="chips">';
    if(!cfg.rifiuti.length) h += '<span class="muted small">Aggiungi prima i tipi di rifiuto.</span>';
    cfg.rifiuti.forEach(r => {
      const on = w.giorni[k].includes(r.id);
      h += '<button class="chip" data-act="toggle-day" data-k="'+k+'" data-r="'+esc(r.id)+'" aria-pressed="'+on+'" style="'+(on? 'background:'+r.colore+';color:'+textOn(r.colore) : '')+'"><span class="dot" style="background:'+r.colore+'"></span>'+esc(r.nome)+'</button>';
    });
    h += '</div></div>';
  });
  h += '</section>';
  h += '<section class="card"><h2>Rotazione</h2>';
  if(W.length>1){
    h += '<label class="field">Questa settimana (dal lunedì '+fmt(mondayOf(t))+') è la<select data-bind="cycle-now">'+W.map((x,i)=>'<option value="'+i+'"'+(i===weekIndex(t)?' selected':'')+'>'+esc(x.nome)+'</option>').join('')+'</select></label>';
    h += '<p class="small muted" style="margin-top:8px">In alternativa indica un lunedì in cui comincia «'+esc(W[0].nome)+'»:</p>';
  }
  h += '<label class="field">Inizio di «'+esc(W[0].nome)+'»<input type="date" data-bind="cycle-date" value="'+cfg.inizioCiclo+'"></label>';
  h += '<label class="check" style="margin-top:8px"><input type="checkbox" data-bind="sera"'+(cfg.esponiSeraPrima?' checked':'')+'> Si espone la sera prima del ritiro</label>';
  h += '</section>';
  return h;
}
function viewRifiuti(){
  let h = '<section class="card"><h2>Tipi di rifiuto</h2><p class="muted small">Nome, colore e una nota su come esporlo (finisce nel foglio stampato e nei promemoria).</p>';
  cfg.rifiuti.forEach((r,i) => {
    h += '<div class="editrow"><input type="color" aria-label="Colore di '+esc(r.nome)+'" data-bind="r-col" data-i="'+i+'" value="'+r.colore+'">'+
      '<label class="field">Nome<input type="text" data-bind="r-nome" data-i="'+i+'" value="'+esc(r.nome)+'"></label>'+
      '<label class="field" style="flex-basis:100%">Nota<input type="text" data-bind="r-nota" data-i="'+i+'" value="'+esc(r.nota)+'" placeholder="es. sacchi semitrasparenti"></label>'+
      '<div class="row"><button class="btn ghost" data-act="r-up" data-i="'+i+'" aria-label="Sposta su"'+(i===0?' disabled':'')+'>Su</button><button class="btn ghost" data-act="r-down" data-i="'+i+'" aria-label="Sposta giù"'+(i===cfg.rifiuti.length-1?' disabled':'')+'>Giù</button>'+
      (pendingDelete==='r'+r.id ? '<button class="btn danger" data-act="r-del-ok" data-i="'+i+'">Conferma: elimina ovunque</button>' : '<button class="btn danger" data-act="r-del" data-i="'+i+'">Elimina</button>')+'</div></div>';
  });
  if(!cfg.rifiuti.length) h += '<p class="muted">Nessun tipo di rifiuto. Aggiungine uno.</p>';
  h += '<div class="row" style="margin-top:8px"><button class="btn primary" data-act="r-add">Aggiungi rifiuto</button></div></section>';
  return h;
}
function viewEccezioni(){
  const t = today();
  const list = cfg.eccezioni.map((e,i)=>({e,i})).sort((a,b)=>a.e.data.localeCompare(b.e.data));
  let h = '<section class="card"><h2>Eccezioni e date speciali</h2><p class="muted small">Festivi, recuperi, raccolte a date variabili (per esempio il verde). La data è sempre il giorno di <b>ritiro</b>. Se non scegli rifiuti, l\'eccezione vale per tutti quelli di quel giorno.</p>';
  h += '<div class="row"><button class="btn primary" data-act="e-add">Aggiungi eccezione</button></div></section>';
  list.forEach(({e,i}) => {
    const past = parseISO(e.data) < t && !(e.nuovaData && parseISO(e.nuovaData) >= t);
    h += '<section class="card"'+(past?' style="opacity:.6"':'')+'><div class="row">'+
      '<label class="field">Data di ritiro<input type="date" data-bind="e-data" data-i="'+i+'" value="'+e.data+'"></label>'+
      '<label class="field">Cosa succede<select data-bind="e-az" data-i="'+i+'"><option value="annulla"'+(e.azione==='annulla'?' selected':'')+'>Non si ritira</option><option value="sposta"'+(e.azione==='sposta'?' selected':'')+'>Si sposta a un\'altra data</option><option value="aggiungi"'+(e.azione==='aggiungi'?' selected':'')+'>Raccolta in più</option></select></label>'+
      (e.azione==='sposta' ? '<label class="field">Nuova data<input type="date" data-bind="e-nuova" data-i="'+i+'" value="'+e.nuovaData+'"></label>' : '')+
      '</div><div style="margin-top:10px"><div class="small" style="font-weight:700;margin-bottom:6px">Rifiuti'+(e.azione==='aggiungi'?' (scegline almeno uno)':' (nessuno = tutti)')+'</div><div class="chips">'+
      cfg.rifiuti.map(r => { const on = e.rifiuti.includes(r.id); return '<button class="chip" data-act="e-toggle" data-i="'+i+'" data-r="'+esc(r.id)+'" aria-pressed="'+on+'" style="'+(on?'background:'+r.colore+';color:'+textOn(r.colore):'')+'"><span class="dot" style="background:'+r.colore+'"></span>'+esc(r.nome)+'</button>'; }).join('')+
      '</div></div><div class="row" style="margin-top:10px"><label class="field">Nota<input type="text" data-bind="e-nota" data-i="'+i+'" value="'+esc(e.nota)+'" placeholder="es. Capodanno"></label>'+
      '<button class="btn danger" data-act="e-del" data-i="'+i+'">Elimina</button></div>'+(past?'<p class="small muted" style="margin:8px 0 0">Data passata.</p>':'')+'</section>';
  });
  if(!list.length) h += '<p class="muted">Nessuna eccezione.</p>';
  return h;
}
function viewTesti(){
  let h = '<section class="card"><h2>Testi del foglio</h2><div class="stack">'+
    '<label class="field">Titolo<input type="text" data-bind="t-titolo" value="'+esc(cfg.titolo)+'"></label>'+
    '<label class="field">Sottotitolo (comune, zona, indirizzo)<input type="text" data-bind="t-sub" value="'+esc(cfg.sottotitolo)+'"></label>'+
    '<label class="field">Orario di esposizione<input type="text" data-bind="t-orario" value="'+esc(cfg.orario)+'" placeholder="es. dalle 21:00 alle 24:00"></label>'+
    '</div></section><section class="card"><h2>Note</h2><p class="muted small">Blocchi di testo stampati in fondo al foglio.</p>';
  cfg.note.forEach((n,i) => {
    h += '<div class="editrow"><label class="field">Titolo<input type="text" data-bind="n-tit" data-i="'+i+'" value="'+esc(n.titolo)+'"></label>'+
      '<label class="field" style="flex-basis:100%">Testo<textarea data-bind="n-txt" data-i="'+i+'">'+esc(n.testo)+'</textarea></label>'+
      '<div class="row"><button class="btn ghost" data-act="n-up" data-i="'+i+'"'+(i===0?' disabled':'')+'>Su</button><button class="btn ghost" data-act="n-down" data-i="'+i+'"'+(i===cfg.note.length-1?' disabled':'')+'>Giù</button><button class="btn danger" data-act="n-del" data-i="'+i+'">Elimina</button></div></div>';
  });
  h += '<div class="row" style="margin-top:8px"><button class="btn primary" data-act="n-add">Aggiungi nota</button></div></section>';
  return h;
}
function viewEsporta(){
  const p = cfg.promemoria;
  let h = '<section class="card"><h2>Foglio A4</h2><p class="muted small">Si aggiorna da solo con i tuoi dati. Da Android: Stampa, poi "Salva come PDF" o la tua stampante.</p>'+
    '<div class="row"><button class="btn primary" data-act="print">Stampa o salva in PDF</button><button class="btn" data-act="sheet-dl">Scarica il foglio (.html)</button></div>'+
    (inClaude()? '<p class="small muted" style="margin:8px 0 0">Se qui la stampa non parte, scarica il foglio e aprilo nel browser: ha il suo pulsante Stampa.</p>':'')+
    '<div class="preview-box" style="margin-top:12px"><div class="preview-scale" id="pv"><div style="width:794px;background:#fff;padding:34px 38px;box-shadow:0 2px 10px rgba(0,0,0,.15)">'+sheetHTML()+'</div></div></div></section>';
  h += '<section class="card"><h2>Promemoria nel calendario (.ics)</h2><p class="muted small">Un evento con avviso per ogni sera in cui c\'è qualcosa da esporre, eccezioni comprese.</p><div class="row">'+
    '<label class="field">Ora del promemoria<input type="time" data-bind="p-ora" value="'+p.ora+'"></label>'+
    '<label class="field">Avviso<select data-bind="p-avv">'+[0,15,30,60,120].map(m=>'<option value="'+m+'"'+(m===p.avvisoMinuti?' selected':'')+'>'+(m? m+' minuti prima':'all\'ora dell\'evento')+'</option>').join('')+'</select></label>'+
    '<label class="field">Periodo<select data-bind="p-mesi">'+[1,3,6,12].map(m=>'<option value="'+m+'"'+(m===p.mesi?' selected':'')+'>'+(m===1?'1 mese':m+' mesi')+' da oggi</option>').join('')+'</select></label>'+
    '</div><div class="row" style="margin-top:10px"><button class="btn primary" data-act="ics">Scarica i promemoria (.ics)</button></div>'+
    '<div class="notice" style="margin-top:12px"><b>Google Calendar:</b> l\'app Android non importa i file, serve il computer. Su calendar.google.com crea un calendario nuovo (es. "Rifiuti"), poi Impostazioni › Importa ed esporta › scegli il file e quel calendario. Le notifiche arrivano poi sul telefono. Quando cambi qualcosa, elimina quel calendario e reimporta.'+
    (inClaude()? '<br><br><b>Dentro Claude</b> il file viene salvato come <i>.ics.txt</i>: rinominalo togliendo ".txt" prima di importarlo. Dalla copia standalone dell\'app il file è già .ics.':'')+'</div></section>';
  h += '<section class="card"><h2>Backup della configurazione</h2><p class="muted small">Tutta la configurazione in un file di testo (YAML) da conservare dove vuoi e reimportare qui. Si può anche modificare a mano.</p>'+
    '<div class="row"><button class="btn primary" data-act="yaml-dl">Scarica configurazione</button><button class="btn" data-act="yaml-show">'+(showYaml?'Nascondi il testo':'Mostra il testo')+'</button><button class="btn" data-act="import-file">Importa da file</button></div>';
  if(showYaml) h += '<label class="field" style="margin-top:12px">Configurazione (selezionala e copiala)<textarea id="yamlOut" readonly style="min-height:260px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem">'+esc(toYAML(cfg))+'</textarea></label><div class="row" style="margin-top:8px"><button class="btn" data-act="yaml-copy">Copia</button></div>';
  h += '<label class="field" style="margin-top:14px">Oppure incolla qui una configurazione<textarea id="yamlIn" placeholder="titolo: ..." style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem"></textarea></label><div class="row" style="margin-top:8px"><button class="btn" data-act="import-text">Importa dal testo</button></div>'+
    '<p class="small muted" style="margin:10px 0 0">'+(inClaude()? 'Dentro Claude il file si chiama .txt (contiene YAML). ':'')+'L\'importazione sostituisce la configurazione attuale.</p></section>';
  h += '<section class="card"><h2>Ricomincia</h2><p class="muted small">Cancella la configurazione da questo dispositivo. Fai prima un backup se ti serve.</p>'+
    (pendingDelete==='reset' ? '<button class="btn danger" data-act="reset-ok">Conferma: cancella tutto</button>' : '<button class="btn danger" data-act="reset">Ricomincia da capo</button>')+'</section>';
  return h;
}
function fitPreview(){
  const box = document.querySelector('.preview-box'), pv = $('#pv'); if(!box||!pv) return;
  const s = Math.min(1, (box.clientWidth - 24) / 794);
  pv.style.transform = 'scale('+s+')';
  const inner = pv.firstElementChild; pv.style.height = (inner.offsetHeight * s)+'px'; pv.style.width = (794*s)+'px';
}
window.addEventListener('resize', () => { if(tab==='esporta') fitPreview(); });

/* ---------- eventi ---------- */
function setTab(t){ tab = t; pendingDelete = null; render(); window.scrollTo(0,0); }
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if(b) setTab(b.dataset.tab); });
const move = (arr,i,d) => { const j=i+d; if(j<0||j>=arr.length) return; [arr[i],arr[j]]=[arr[j],arr[i]]; };
function applyImported(c){ cfg = c; weekSel = 0; save(); tab='oggi'; render(); toast('Configurazione importata.'); }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if(!b) return;
  const a = b.dataset.act, i = +b.dataset.i;
  const keepDelete = ['week-del','r-del','reset'].includes(a);
  if(!keepDelete) pendingDelete = null;
  switch(a){
    case 'start-blank': cfg = blankConfig(); save(); tab='settimane'; render(); return;
    case 'start-example': cfg = exampleConfig(); save(); tab='oggi'; render(); return;
    case 'import-file': $('#fileInput').value=''; $('#fileInput').click(); return;
    case 'week-sel': weekSel = i; break;
    case 'week-add': cfg.settimane.push(emptyWeek('Settimana '+String.fromCharCode(65+cfg.settimane.length))); weekSel = cfg.settimane.length-1; break;
    case 'week-dup': { const w = JSON.parse(JSON.stringify(cfg.settimane[weekSel])); w.id = uid('w'); w.nome += ' (copia)'; cfg.settimane.splice(weekSel+1,0,w); weekSel++; break; }
    case 'week-del': pendingDelete = 'w'+cfg.settimane[weekSel].id; break;
    case 'week-del-ok': cfg.settimane.splice(weekSel,1); weekSel = 0; break;
    case 'toggle-day': { const g = cfg.settimane[weekSel].giorni[b.dataset.k]; const r = b.dataset.r; const k = g.indexOf(r); if(k>=0) g.splice(k,1); else g.push(r); break; }
    case 'r-add': cfg.rifiuti.push({id:uid('r'), nome:'Nuovo rifiuto', colore:'#8a6d3b', nota:''}); break;
    case 'r-up': move(cfg.rifiuti,i,-1); break;
    case 'r-down': move(cfg.rifiuti,i,1); break;
    case 'r-del': pendingDelete = 'r'+cfg.rifiuti[i].id; break;
    case 'r-del-ok': { const id = cfg.rifiuti[i].id; cfg.rifiuti.splice(i,1); cfg.settimane.forEach(w => DAY_KEYS.forEach(k => w.giorni[k] = w.giorni[k].filter(x=>x!==id))); cfg.eccezioni.forEach(x => x.rifiuti = x.rifiuti.filter(r=>r!==id)); break; }
    case 'e-add': cfg.eccezioni.push({id:uid('e'), data:iso(today()), azione:'annulla', nuovaData:'', rifiuti:[], nota:''}); break;
    case 'e-toggle': { const x = cfg.eccezioni[i]; const r = b.dataset.r; const k = x.rifiuti.indexOf(r); if(k>=0) x.rifiuti.splice(k,1); else x.rifiuti.push(r); break; }
    case 'e-del': cfg.eccezioni.splice(i,1); break;
    case 'n-add': cfg.note.push({titolo:'', testo:''}); break;
    case 'n-up': move(cfg.note,i,-1); break;
    case 'n-down': move(cfg.note,i,1); break;
    case 'n-del': cfg.note.splice(i,1); break;
    case 'print': $('#printRoot').innerHTML = sheetHTML(); try{ window.print(); }catch(err){ toast('La stampa non è disponibile qui: scarica il foglio .html.'); } return;
    case 'sheet-dl': { const r = await saveFile('foglio-rifiuti.html', standaloneSheet(), 'text/html'); if(r.ok) toast('Foglio salvato: aprilo e premi Stampa.'); else toast(r.msg); return; }
    case 'ics': { const {text,count} = buildICS(); if(!count){ toast('Nessuna raccolta nel periodo scelto.'); return; } const r = await saveFile('promemoria-rifiuti.ics', text, 'text/calendar'); if(r.ok) toast(count+' promemoria salvati'+(r.renamed?' (rinomina il file in .ics)':'')+'.'); else toast(r.msg); return; }
    case 'yaml-dl': { const r = await saveFile(inClaude()? 'rifiuti-config.txt' : 'rifiuti-config.yaml', toYAML(cfg), 'text/yaml'); if(r.ok) toast('Configurazione salvata.'); else toast(r.msg); return; }
    case 'yaml-show': showYaml = !showYaml; break;
    case 'yaml-copy': { const ta = $('#yamlOut'); try{ await navigator.clipboard.writeText(ta.value); toast('Copiata negli appunti.'); }catch(err){ ta.focus(); ta.select(); toast('Testo selezionato: copialo dal menu del telefono.'); } return; }
    case 'import-text': { const txt = $('#yamlIn').value.trim(); if(!txt){ toast('Incolla prima il testo della configurazione.'); return; } try{ applyImported(fromText(txt)); }catch(err){ toast(err.message); } return; }
    case 'reset': pendingDelete = 'reset'; break;
    case 'reset-ok': try{ localStorage.removeItem(STORE_KEY); }catch(err){} cfg = null; tab='oggi'; render(); return;
    default: return;
  }
  save(); render();
});
$('#fileInput').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if(!f) return;
  try{ const txt = await f.text(); applyImported(fromText(txt)); }catch(err){ toast(err.message || 'File non valido.'); }
});
// campi di testo: salvano senza ridisegnare (non si perde il focus)
document.addEventListener('input', e => {
  const el = e.target; const k = el.dataset && el.dataset.bind; if(!k || !cfg) return;
  const i = +el.dataset.i, v = el.value;
  const map = {
    'week-nome': () => cfg.settimane[weekSel].nome = v,
    'week-desc': () => cfg.settimane[weekSel].descrizione = v,
    'r-nome': () => cfg.rifiuti[i].nome = v,
    'r-nota': () => cfg.rifiuti[i].nota = v,
    'r-col': () => cfg.rifiuti[i].colore = v,
    'e-nota': () => cfg.eccezioni[i].nota = v,
    't-titolo': () => cfg.titolo = v,
    't-sub': () => cfg.sottotitolo = v,
    't-orario': () => cfg.orario = v,
    'n-tit': () => cfg.note[i].titolo = v,
    'n-txt': () => cfg.note[i].testo = v
  };
  if(map[k]){ map[k](); save(); }
});
// campi a scelta: salvano e ridisegnano
document.addEventListener('change', e => {
  const el = e.target; const k = el.dataset && el.dataset.bind; if(!k || !cfg) return;
  const i = +el.dataset.i, v = el.value;
  switch(k){
    case 'cycle-now': { const idx = +v; cfg.inizioCiclo = iso(addDays(mondayOf(today()), -7*idx)); break; }
    case 'cycle-date': { const d = parseISO(v); if(!d) return; cfg.inizioCiclo = iso(mondayOf(d)); if(dayIdx(d)!==0) toast('Uso il lunedì di quella settimana: '+fmtW(mondayOf(d))+'.'); break; }
    case 'sera': cfg.esponiSeraPrima = el.checked; break;
    case 'e-data': if(!parseISO(v)) return; cfg.eccezioni[i].data = v; break;
    case 'e-nuova': cfg.eccezioni[i].nuovaData = parseISO(v) ? v : ''; break;
    case 'e-az': cfg.eccezioni[i].azione = v; break;
    case 'p-ora': if(/^\d{2}:\d{2}$/.test(v)) cfg.promemoria.ora = v; break;
    case 'p-avv': cfg.promemoria.avvisoMinuti = +v; break;
    case 'p-mesi': cfg.promemoria.mesi = +v; break;
    case 'r-col': case 'week-nome': case 'r-nome': case 't-titolo': case 'n-tit': case 'n-txt': case 'week-desc': case 'r-nota': case 'e-nota': case 't-sub': case 't-orario':
      save(); if(['r-col','week-nome','r-nome'].includes(k)) render(); return;
    default: return;
  }
  save(); render();
});

/* ---------- avvio ---------- */
cfg = load();
render();
