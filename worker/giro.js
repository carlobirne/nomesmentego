// Parti comuni dei canali di avviso (Telegram, notifiche dell'app, email):
// quali avvisi mandare a un destinatario dall'ultimo giro a adesso.
import { tuttiGliAvvisi } from '../web/core/motore.js';
import { oggi, oraAttuale, piuGiorni } from '../web/core/date.js';

const MAX_INDIETRO_GIORNI = 1; // dopo un'interruzione si recuperano al massimo gli avvisi dell'ultimo giorno

/** "AAAA-MM-GGTHH:MM" nell'ora locale del fuso indicato */
export const adessoLocale = (fuso, d = new Date()) => oggi(fuso, d) + 'T' + oraAttuale(fuso, d);

export function filtroDi(riga) {
  try { return riga.filtro ? JSON.parse(riga.filtro) : null; } catch { return null; }
}
export const passaFiltro = (p, filtro) => !!p && (!filtro || filtro.includes(p.gruppo || ''));

/** Filtro ricevuto dall'interfaccia: elenco di gruppi esistenti ('' = senza gruppo) oppure null = tutto. */
export function pulisciFiltro(filtro, bacheca) {
  if (!Array.isArray(filtro)) return null;
  const f = [...new Set(filtro.map(String))].filter((g) => g === '' || bacheca.gruppi.some((x) => x.id === g));
  return f.length ? f : null;
}

/**
 * Avvisi scattati per un destinatario dopo `riga.ultimo` e fino a adesso (compreso).
 * @returns { avvisi, ora } dove `ora` va salvato come nuovo `ultimo` dopo l'invio.
 */
export function avvisiDaMandare(riga, bacheca, adesso) {
  const ora = adessoLocale(bacheca.fusoOrario, adesso);
  const limite = piuGiorni(ora.slice(0, 10), -MAX_INDIETRO_GIORNI) + ora.slice(10);
  const da = riga.ultimo > limite ? riga.ultimo : limite;
  if (da >= ora) return { avvisi: [], ora };
  const filtro = filtroDi(riga);
  const avvisi = tuttiGliAvvisi(bacheca, da.slice(0, 10), ora.slice(0, 10))
    .filter((a) => { const k = a.data + 'T' + a.ora; return k > da && k <= ora; })
    .filter((a) => passaFiltro(bacheca.promemoria.find((p) => p.id === a.promemoria), filtro));
  return { avvisi, ora };
}

/** Descrizione di un destinatario per l'interfaccia (senza dati riservati). */
export const descriviFiltro = (riga, bacheca) => {
  const f = filtroDi(riga);
  return f ? f.filter((g) => g === '' || bacheca.gruppi.some((x) => x.id === g)) : null;
};
