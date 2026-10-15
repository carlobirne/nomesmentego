// Piccole utilità HTTP condivise dai moduli del Worker.
export const MAX_BYTES = 300_000;

export function nuovoToken(byte = 18) {
  const b = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function impronta(token) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const json = (corpo, stato = 200, extra = {}) => new Response(JSON.stringify(corpo), {
  status: stato,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...extra },
});
export const errore = (stato, messaggio) => json({ errore: messaggio }, stato);

export async function leggiCorpo(request) {
  const testo = await request.text();
  if (new TextEncoder().encode(testo).length > MAX_BYTES) throw Object.assign(new Error('Bacheca troppo grande.'), { stato: 413 });
  try { return JSON.parse(testo || '{}'); } catch { throw Object.assign(new Error('JSON non valido.'), { stato: 400 }); }
}

