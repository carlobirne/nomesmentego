// Calendario iCalendar (RFC 5545) generato dagli avvisi della bacheca.
// Ogni avviso diventa un evento breve all'ora dell'avviso, con allarme "all'ora dell'evento":
// così l'avviso arriva anche dove il calendario ignora gli allarmi del feed
// (basta lasciare la notifica predefinita "all'inizio dell'evento").
import { piuGiorni } from './date.js';
import { tuttiGliAvvisi, agenda, descriviQuando } from './motore.js';

const pad = (n) => String(n).padStart(2, '0');
export const escapeICS = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function piega(riga) {
  const enc = new TextEncoder();
  if (enc.encode(riga).length <= 75) return riga;
  let out = '', cur = '', len = 0;
  for (const ch of riga) {
    const l = enc.encode(ch).length;
    if (len + l > 74) { out += cur + '\r\n '; cur = ''; len = 1; }
    cur += ch; len += l;
  }
  return out + cur;
}

const dt = (data, ora) => data.replaceAll('-', '') + 'T' + ora.replace(':', '') + '00';
function piuMinuti(data, ora, min) {
  let [h, m] = ora.split(':').map(Number);
  m += min; h += Math.floor(m / 60); m %= 60;
  let d = data;
  if (h >= 24) { h -= 24; d = piuGiorni(d, 1); }
  return dt(d, pad(h) + ':' + pad(m));
}

/**
 * @param bacheca  bacheca normalizzata
 * @param opz.da, opz.a  intervallo (AAAA-MM-GG)
 * @param opz.adesso     Date per DTSTAMP
 * @param opz.link       indirizzo dell'app da mettere nella descrizione
 */
export function generaICS(bacheca, { da, a, adesso = new Date(), link = '' } = {}) {
  const stamp = adesso.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const fuso = bacheca.fusoOrario || 'Europe/Rome';
  const righe = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nomesmentego//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + escapeICS(bacheca.nome), 'X-WR-TIMEZONE:' + fuso,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  const evento = (uid, campi) => righe.push('BEGIN:VEVENT', 'UID:' + uid + '@nomesmentego', 'DTSTAMP:' + stamp, ...campi, 'END:VEVENT');
  const descrizione = (p, extra) => escapeICS([...extra, p.nota, descriviQuando(p) + '.', link].filter(Boolean).join('\n'));

  let n = 0;
  for (const av of tuttiGliAvvisi(bacheca, da, a)) {
    const p = bacheca.promemoria.find((x) => x.id === av.promemoria);
    const icona = p.icona || bacheca.gruppi.find((g) => g.id === p.gruppo)?.icona || '';
    const titolo = (icona ? icona + ' ' : '') + av.testo;
    evento(av.id, [
      'DTSTART:' + dt(av.data, av.ora), 'DTEND:' + piuMinuti(av.data, av.ora, 15),
      'SUMMARY:' + escapeICS(titolo),
      'DESCRIPTION:' + descrizione(p, av.occorrenza.note),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapeICS(titolo), 'TRIGGER:PT0M', 'END:VALARM',
    ]);
    n++;
  }
  // promemoria senza avvisi: solo un evento di giornata intera, senza allarme, per vederli nel calendario
  const senza = { ...bacheca, promemoria: bacheca.promemoria.filter((p) => !p.avvisi.length) };
  for (const g of agenda(senza, da, a)) {
    for (const { p, o } of g.voci) {
      if (o.voci === null) continue;
      const voci = o.voci.map((id) => p.voci.find((v) => v.id === id)?.nome).filter(Boolean).join(', ');
      evento(p.id + '-' + o.data + '-giorno', [
        'DTSTART;VALUE=DATE:' + o.data.replaceAll('-', ''), 'DTEND;VALUE=DATE:' + piuGiorni(o.data, 1).replaceAll('-', ''),
        'SUMMARY:' + escapeICS((p.icona ? p.icona + ' ' : '') + p.titolo + (voci ? ': ' + voci : '')),
        'DESCRIPTION:' + descrizione(p, o.note),
        'TRANSP:TRANSPARENT',
      ]);
      n++;
    }
  }
  righe.push('END:VCALENDAR');
  return { testo: righe.map(piega).join('\r\n') + '\r\n', eventi: n };
}
