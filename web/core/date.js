// Date di calendario come stringhe "AAAA-MM-GG", calcolate in UTC:
// lo stesso codice dà gli stessi risultati nel browser e nel Worker, senza problemi di ora legale.

export const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
export const GIORNI_NOMI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
export const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const MESI_NOMI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');

export function valida(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const validaOra = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s ?? ''));

/** "AAAA-MM-GG" -> numero di giorni dal 1970-01-01 */
export function giorno(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}
/** numero di giorni -> "AAAA-MM-GG" */
export function data(n) {
  const d = new Date(n * DAY);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
export const parti = (s) => s.split('-').map(Number);
export const piuGiorni = (s, n) => data(giorno(s) + n);
export const differenza = (a, b) => giorno(b) - giorno(a);
/** 0 = lunedì ... 6 = domenica */
export const giornoSettimana = (s) => (new Date(giorno(s) * DAY).getUTCDay() + 6) % 7;
export const lunediDi = (s) => piuGiorni(s, -giornoSettimana(s));
export const giorniNelMese = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
export const fineMese = (s) => { const [y, m] = parti(s); return y + '-' + pad(m) + '-' + pad(giorniNelMese(y, m)); };
export const componi = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);

/** aggiunge mesi tenendo il giorno, o l'ultimo del mese se non esiste (31 gen + 1 mese = 28/29 feb) */
export function piuMesi(s, n) {
  const [y, m, d] = parti(s);
  const t = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(t / 12), nm = t - ny * 12 + 1;
  return componi(ny, nm, Math.min(d, giorniNelMese(ny, nm)));
}
export function piu(s, n, unita) {
  switch (unita) {
    case 'giorni': return piuGiorni(s, n);
    case 'settimane': return piuGiorni(s, n * 7);
    case 'mesi': return piuMesi(s, n);
    case 'anni': return piuMesi(s, n * 12);
    default: throw new Error('Unità sconosciuta: ' + unita);
  }
}

/** oggi nel fuso indicato, come "AAAA-MM-GG" */
export function oggi(fuso = 'Europe/Rome', adesso = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
  } catch {
    return data(Math.floor(adesso.getTime() / DAY));
  }
}
/** ora attuale "HH:MM" nel fuso indicato */
export function oraAttuale(fuso = 'Europe/Rome', adesso = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(adesso);
  } catch {
    return pad(adesso.getHours()) + ':' + pad(adesso.getMinutes());
  }
}

/* ---------- formati brevi in italiano ---------- */
export const fmt = (s) => { const [, m, d] = parti(s); return d + ' ' + MESI[m - 1]; };
export const fmtAnno = (s) => { const [y, m, d] = parti(s); return d + ' ' + MESI[m - 1] + ' ' + y; };
export const fmtGiorno = (s) => GIORNI[giornoSettimana(s)] + ' ' + fmt(s);
export const fmtLungo = (s) => GIORNI_NOMI[giornoSettimana(s)] + ' ' + fmt(s);

/** "oggi", "domani", "tra 3 giorni", "ieri", "3 giorni fa" */
export function relativo(da, a) {
  const n = differenza(da, a);
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === 2) return 'dopodomani';
  if (n === -1) return 'ieri';
  if (n > 0) return 'tra ' + n + ' giorni';
  return (-n) + ' giorni fa';
}
