// Piccole utilità per l'interfaccia.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => v === true ? ' ' + k : ' ' + k + '="' + esc(v) + '"').join('');

export function testoSu(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const L = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * L((n >> 16 & 255) / 255) + 0.7152 * L((n >> 8 & 255) / 255) + 0.0722 * L((n & 255) / 255);
  return lum > 0.4 ? '#111111' : '#ffffff';
}

export const chip = (testo, colore, cls = '') =>
  '<span class="chip ' + cls + '"' + (colore ? ' style="background:' + colore + ';color:' + testoSu(colore) + '"' : '') + '>' + esc(testo) + '</span>';

export function toast(msg, ms = 3200) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export async function copia(testo) {
  try { await navigator.clipboard.writeText(testo); toast('Copiato!'); return; } catch { /* ripiego sotto */ }
  const t = document.createElement('textarea');
  t.value = testo; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); toast('Copiato!'); } catch { toast('Copia non riuscita: tieni premuto sul testo per copiarlo.'); }
  t.remove();
}

export async function condividi(titolo, testo, url) {
  if (navigator.share) {
    try { await navigator.share({ title: titolo, text: testo, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  await copia(url);
}

export function scarica(nome, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function caricaScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Impossibile caricare ' + src));
    document.head.appendChild(s);
  });
}

export const ICONE = ['🗑️', '♻️', '🛒', '🚗', '🚙', '📄', '💊', '🎂', '📅', '🏠', '🔥', '💧', '🐶', '🌱', '🏥', '🎒', '⚽', '💶', '✂️', '📞', '✏️'];
export const COLORI = ['#1d3b2f', '#3e7d3a', '#22579a', '#6b3f1f', '#f2c230', '#b42318', '#7a3e9d', '#4d5257', '#0e7c86', '#d9622b'];
