import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizza, daRaccoltaRifiuti } from '../web/core/modello.js';
import { occorrenze, avvisi, scadenzaAttuale, segnaFatto, eScadenza, giaFatta, ogniGiorni, riassunto, settimanaDi, prossime, agenda } from '../web/core/motore.js';
import { piuMesi, giornoSettimana, oggi, lunediDi } from '../web/core/date.js';
import { creaAuto, primaRevisione, MODELLI } from '../web/core/modelli.js';
import { generaICS } from '../web/core/ics.js';

const OGGI = '2026-10-13'; // martedì
const bacheca = (promemoria, extra = {}) => normalizza({ versione: 2, nome: 'Test', promemoria, ...extra }, OGGI);
const date = (occ) => occ.map((o) => o.data);

test('date: mesi con fine mese e giorno della settimana', () => {
  assert.equal(piuMesi('2026-01-31', 1), '2026-02-28');
  assert.equal(piuMesi('2024-01-31', 1), '2024-02-29');
  assert.equal(piuMesi('2026-11-15', 3), '2027-02-15');
  assert.equal(piuMesi('2026-03-15', -3), '2025-12-15');
  assert.equal(giornoSettimana('2026-10-13'), 1);
  assert.equal(lunediDi('2026-10-18'), '2026-10-12');
  assert.equal(oggi('Europe/Rome', new Date('2026-10-13T22:30:00Z')), '2026-10-14');
});

test('settimanale: il mercato del martedì e l\'avviso la sera prima', () => {
  const b = bacheca([{ id: 'mercato', titolo: 'Mercato in piazza', quando: { tipo: 'settimanale', giorni: ['mar'] },
    avvisi: [{ prima: 1, unita: 'giorni', ora: '19:00', testo: 'Non parcheggiare in piazza stasera' }] }]);
  const p = b.promemoria[0];
  assert.deepEqual(date(occorrenze(p, '2026-10-12', '2026-10-31')), ['2026-10-13', '2026-10-20', '2026-10-27']);
  const av = avvisi(p, '2026-10-14', '2026-10-27');
  assert.deepEqual(av.map((a) => a.data + ' ' + a.ora), ['2026-10-19 19:00', '2026-10-26 19:00']);
  assert.equal(av[0].testo, 'Non parcheggiare in piazza stasera');
  assert.match(riassunto(p), /^Ogni martedì\. Ti avviso la sera prima alle 19:00\.$/);
});

test('settimanale ogni 2 settimane parte dalla settimana di inizio', () => {
  const p = bacheca([{ quando: { tipo: 'settimanale', giorni: ['lun', 'gio'], ogni: 2, inizio: '2026-10-14' } }]).promemoria[0];
  assert.deepEqual(date(occorrenze(p, '2026-10-01', '2026-10-31')), ['2026-10-12', '2026-10-15', '2026-10-26', '2026-10-29']);
});

test('rotazione A/B con voci ed eccezioni (dal prototipo raccolta rifiuti)', () => {
  const v1 = {
    titolo: 'Cosa metto fuori stasera?', sottotitolo: 'Pescantina', esponiSeraPrima: true, inizioCiclo: '2026-01-12',
    promemoria: { ora: '20:30' },
    rifiuti: [{ id: 'umido', nome: 'Umido', colore: '#6b3f1f' }, { id: 'secco', nome: 'Secco', colore: '#4d5257' },
      { id: 'plastica', nome: 'Plastica', colore: '#f2c230' }, { id: 'carta', nome: 'Carta', colore: '#22579a' }],
    settimane: [
      { nome: 'A', giorni: { lun: ['umido'], mer: ['secco'], ven: ['umido', 'plastica'] } },
      { nome: 'B', giorni: { lun: ['umido'], ven: ['umido'], sab: ['carta'] } },
    ],
    eccezioni: [
      { data: '2027-01-01', azione: 'sposta', nuovaData: '2026-12-31', nota: 'Capodanno' },
      { data: '2026-10-19', azione: 'annulla', rifiuti: ['umido'] },
    ],
  };
  const b = normalizza(v1, OGGI);
  assert.equal(b.versione, 2);
  const p = b.promemoria[0];
  assert.equal(p.quando.tipo, 'rotazione');
  // 12/01/2026 è A; 12/10/2026 è 39 settimane dopo -> B
  assert.equal(p.quando.settimane[settimanaDi(p.quando, '2026-10-13')].nome, 'B');
  const occ = occorrenze(p, '2026-10-12', '2026-10-25');
  assert.deepEqual(occ.map((o) => o.data + ':' + o.voci.join('+')),
    ['2026-10-12:umido', '2026-10-16:umido', '2026-10-17:carta', '2026-10-21:secco', '2026-10-23:umido+plastica']);
  // 1/1/2027 è venerdì di settimana A (umido+plastica) spostato al 31/12
  const cap = occorrenze(p, '2026-12-31', '2027-01-02');
  assert.deepEqual(cap.map((o) => o.data + ':' + o.voci.join('+')), ['2026-12-31:umido+plastica']);
  assert.deepEqual(cap[0].note, ['Capodanno']);
  const av = avvisi(p, '2026-12-30', '2026-12-30');
  assert.equal(av[0].testo, 'Metti fuori stasera: Umido, Plastica');
  assert.equal(av[0].ora, '20:30');
});

test('mensile: giorno del mese, ultimo giorno, primo lunedì, ultimo venerdì', () => {
  const [a, b, c, d] = bacheca([
    { quando: { tipo: 'mensile', modo: 'giorno', giorno: 31, inizio: '2026-01-01' } },
    { quando: { tipo: 'mensile', modo: 'giorno', giorno: -1, ogni: 2, inizio: '2026-01-01' } },
    { quando: { tipo: 'mensile', modo: 'settimana', n: 1, giornoSett: 'lun', inizio: '2026-01-01' } },
    { quando: { tipo: 'mensile', modo: 'settimana', n: -1, giornoSett: 'ven', inizio: '2026-01-01' } },
  ]).promemoria;
  assert.deepEqual(date(occorrenze(a, '2026-01-01', '2026-04-30')), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(date(occorrenze(b, '2026-01-01', '2026-06-30')), ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(date(occorrenze(c, '2026-10-01', '2026-11-30')), ['2026-10-05', '2026-11-02']);
  assert.deepEqual(date(occorrenze(d, '2026-10-01', '2026-11-30')), ['2026-10-30', '2026-11-27']);
});

test('annuale con 29 febbraio e giornaliero ogni 3 giorni', () => {
  const [a, g] = bacheca([
    { quando: { tipo: 'annuale', mese: 2, giorno: 29 } },
    { quando: { tipo: 'giornaliero', ogni: 3, inizio: '2026-10-10' } },
  ]).promemoria;
  assert.deepEqual(date(occorrenze(a, '2027-01-01', '2028-12-31')), ['2027-02-28', '2028-02-29']);
  assert.deepEqual(date(occorrenze(g, '2026-10-01', '2026-10-20')), ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19']);
});

test('vecchie scadenze: diventano promemoria con il flag Scadenza', () => {
  const p = bacheca([{ id: 'rev', titolo: 'Revisione Passat', insisti: true,
    quando: { tipo: 'scadenza', scadenza: '2027-11-30', ripeti: { ogni: 2, unita: 'anni', da: 'fatto', fineMese: true } },
    avvisi: [{ prima: 20, unita: 'giorni', ora: '09:00' }, { prima: 1, unita: 'mesi', ora: '09:00' }] }]).promemoria[0];
  assert.equal(p.quando.tipo, 'annuale');
  assert.deepEqual(p.scadenza, { attiva: true, ogni: 3, fattoFino: '2027-11-29' });
  assert.deepEqual(date(occorrenze(p, '2026-01-01', '2032-12-31')), ['2027-11-30', '2029-11-30', '2031-11-30']);
  const av = avvisi(p, '2027-01-01', '2027-12-31');
  assert.deepEqual(av.map((a) => a.data).slice(0, 3), ['2027-10-30', '2027-11-10', '2027-12-03']);
  assert.match(av[1].testo, /^Revisione Passat \(tra 20 giorni, 30 nov\)$/);
  assert.equal(av.filter((a) => a.scaduto).length, 10);
  assert.match(av.find((a) => a.scaduto).testo, /^Scaduto da 3 giorni: Revisione Passat/);
  assert.equal(scadenzaAttuale(p, '2027-12-05').data, '2027-11-30');
  const fatto = segnaFatto(p, '2027-11-30');
  assert.equal(fatto.scadenza.fattoFino, '2027-11-30');
  assert.equal(avvisi(fatto, '2027-11-13', '2027-12-31').length, 0);
  assert.equal(scadenzaAttuale(fatto, '2027-12-05').data, '2029-11-30');
  // il bollo resta ancorato alla sua data anche se pagato in ritardo
  const [bollo] = bacheca([{ quando: { tipo: 'scadenza', scadenza: '2025-01-31', ripeti: { ogni: 1, unita: 'anni', da: 'scadenza' } } }]).promemoria;
  assert.equal(scadenzaAttuale(bollo, '2026-03-01').data, '2026-01-31');
  assert.equal(scadenzaAttuale(segnaFatto(bollo, '2026-01-31'), '2026-03-01').data, '2027-01-31');
});

test('qualunque promemoria può essere una scadenza: avvisi ogni n giorni finché non è fatto', () => {
  const [p, q] = bacheca([
    { id: 'tassa', titolo: 'Tassa rifiuti', quando: { tipo: 'mensile', giorno: 16 }, avvisi: [{ prima: 0, unita: 'giorni', ora: '10:00' }],
      scadenza: { attiva: true, ogni: 1 } },
    { id: 'mercato', titolo: 'Mercato', quando: { tipo: 'settimanale', giorni: ['mar'] } },
  ]).promemoria;
  assert.ok(eScadenza(p) && !eScadenza(q));
  assert.equal(q.scadenza.attiva, false);
  assert.equal(p.scadenza.fattoFino, '2026-10-12'); // le date passate prima di accenderla non contano
  const av = avvisi(p, '2026-10-16', '2026-10-19');
  assert.deepEqual(av.map((a) => a.data + ' ' + a.ora + (a.scaduto ? ' scaduto' : '')),
    ['2026-10-16 10:00', '2026-10-17 10:00 scaduto', '2026-10-18 10:00 scaduto', '2026-10-19 10:00 scaduto']);
  assert.match(av[1].testo, /^Scaduto da 1 giorno: Tassa rifiuti/);
  // gli avvisi si fermano alla scadenza successiva
  assert.equal(avvisi(p, '2026-11-15', '2026-11-17').filter((a) => a.scaduto && a.data >= '2026-11-16').length, 1);
  const fatto = segnaFatto(p, '2026-10-16');
  assert.ok(giaFatta(fatto, '2026-10-16') && !giaFatta(fatto, '2026-11-16'));
  assert.equal(avvisi(fatto, '2026-10-16', '2026-11-15').length, 0);
  assert.equal(scadenzaAttuale(fatto, '2026-10-20').data, '2026-11-16');
  assert.equal(scadenzaAttuale(p, '2026-10-20').data, '2026-10-16');
  assert.equal(ogniGiorni(1), 'ogni giorno');
  assert.equal(ogniGiorni(3), 'ogni 3 giorni');
  assert.match(riassunto(p), /È una scadenza: .*ogni giorno finché non lo premi/);
  assert.equal(segnaFatto(q, '2026-10-20'), q); // non è una scadenza: niente da segnare
});

test('ogni anno o ogni N anni', () => {
  const [p] = bacheca([{ quando: { tipo: 'annuale', mese: 3, giorno: 15, ogni: 3, inizio: '2026-03-15' } }]).promemoria;
  assert.deepEqual(date(occorrenze(p, '2025-01-01', '2033-12-31')), ['2026-03-15', '2029-03-15', '2032-03-15']);
  assert.match(riassunto(p), /^Ogni 3 anni, il 15 mar/);
});

test('pausa e una-volta', () => {
  const [u, z] = bacheca([
    { quando: { tipo: 'una-volta', data: '2026-11-04' }, avvisi: [{ prima: 1, unita: 'giorni', ora: '20:00' }] },
    { pausa: true, quando: { tipo: 'giornaliero' } },
  ]).promemoria;
  assert.deepEqual(avvisi(u, OGGI, '2026-12-31').map((a) => a.data), ['2026-11-03']);
  assert.equal(occorrenze(z, OGGI, '2026-12-31').length, 0);
  assert.equal(prossime(u, OGGI, 3).length, 1);
});

test('normalizza scarta riferimenti rotti e dati sporchi', () => {
  const b = normalizza({ versione: 2, gruppi: [{ id: 'g1', nome: 'Casa' }], promemoria: [
    { id: 'x', gruppo: 'inesistente', voci: [{ id: 'a', nome: 'A' }],
      quando: { tipo: 'rotazione', settimane: [{ giorni: { lun: ['a', 'zzz'], mar: ['zzz'], xyz: ['a'] } }] },
      avvisi: [{ prima: -4, ora: '25:00' }], eccezioni: [{ data: 'ieri' }, { data: '2026-10-20', azione: 'sposta' }] },
  ] }, OGGI);
  const p = b.promemoria[0];
  assert.equal(p.gruppo, '');
  assert.deepEqual(p.quando.settimane[0].giorni, { lun: ['a'] });
  assert.deepEqual(p.avvisi[0], { prima: 0, unita: 'giorni', ora: '09:00', testo: '' });
  assert.equal(p.eccezioni.length, 0);
  assert.throws(() => normalizza('ciao'));
});

test('modelli: auto dal foglio Google e tutti i modelli normalizzabili', () => {
  assert.equal(primaRevisione('2022-03-10'), '2026-03-31');
  const { gruppo, promemoria } = creaAuto({ nome: 'Passat', scadenze: { revisione: '2027-11-30', bollo: '2027-01-12', tagliando: '' } });
  const b = bacheca(promemoria, { gruppi: [gruppo] });
  assert.deepEqual(b.promemoria.map((p) => p.titolo), ['Revisione Passat', 'Bollo Passat']);
  assert.equal(b.promemoria[0].gruppo, gruppo.id);
  for (const m of MODELLI.filter((m) => !m.speciale)) {
    const p = bacheca([m.crea(OGGI)]).promemoria[0];
    assert.ok(riassunto(p).length > 10, m.id);
  }
});

test('ICS: eventi agli orari degli avvisi, allarmi e righe piegate', () => {
  const b = bacheca([
    { id: 'mercato', titolo: 'Mercato', icona: '🛒', quando: { tipo: 'settimanale', giorni: ['mar'] },
      avvisi: [{ prima: 1, unita: 'giorni', ora: '19:00', testo: 'Non parcheggiare in piazza stasera, mi raccomando, che poi arriva il carro attrezzi' }] },
    { id: 'compl', titolo: 'Compleanno', quando: { tipo: 'annuale', mese: 10, giorno: 20 } },
  ]);
  const { testo, eventi } = generaICS(b, { da: '2026-10-13', a: '2026-10-26', adesso: new Date('2026-10-13T10:00:00Z') });
  assert.equal(eventi, 3);
  assert.match(testo, /DTSTART:20261019T190000\r\n/);
  assert.match(testo, /DTEND:20261019T191500\r\n/);
  assert.match(testo, /DTSTART;VALUE=DATE:20261020\r\n/);
  assert.match(testo, /TRIGGER:PT0M/);
  assert.ok(testo.split('\r\n').every((r) => new TextEncoder().encode(r).length <= 75));
  assert.ok(testo.startsWith('BEGIN:VCALENDAR\r\n') && testo.endsWith('END:VCALENDAR\r\n'));
});

test('agenda include le note degli annullamenti', () => {
  const b = bacheca([{ id: 'm', titolo: 'M', quando: { tipo: 'settimanale', giorni: ['mar'] },
    eccezioni: [{ data: '2026-10-20', azione: 'annulla', nota: 'Festa' }] }]);
  const g = agenda(b, '2026-10-19', '2026-10-21');
  assert.equal(g.length, 1);
  assert.equal(g[0].voci[0].o.voci, null);
  assert.deepEqual(g[0].voci[0].o.note, ['Festa']);
});

test('gli esempi in docs/ e nel prototipo si importano', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../web/vendor/js-yaml.min.js', import.meta.url), 'utf8'), ctx);
  const leggi = (p) => normalizza(ctx.jsyaml.load(fs.readFileSync(new URL(p, import.meta.url), 'utf8')), OGGI);
  const auto = leggi('../docs/esempi/auto-famiglia.yaml');
  assert.equal(auto.promemoria.length, 10);
  assert.ok(auto.promemoria.every((p) => p.gruppo && p.avvisi.length === 3 && p.scadenza.attiva && p.scadenza.ogni === 3));
  const rifiuti = leggi('../prototipo/raccolta-rifiuti/examples/pescantina-zona-a1.yaml');
  assert.equal(rifiuti.promemoria[0].voci.length, 5);
});

test('le vecchie emoji diventano disegni e il calendario non ha emoji', () => {
  const b = bacheca([{ id: 'x', titolo: 'Bidone', icona: '🗑️', quando: { tipo: 'una-volta', data: '2026-10-20' }, avvisi: [{ prima: 0, unita: 'giorni', ora: '08:00' }] },
    { id: 'y', titolo: 'Y', icona: 'luna', quando: { tipo: 'una-volta', data: '2026-10-20' } },
    { id: 'z', titolo: 'Z', icona: '<b>', quando: { tipo: 'una-volta', data: '2026-10-20' } }],
  { gruppi: [{ id: 'g', nome: 'G', icona: '🚙' }] });
  assert.deepEqual(b.promemoria.map((p) => p.icona), ['spazzatura', 'luna', '']);
  assert.equal(b.gruppi[0].icona, 'auto');
  const { testo } = generaICS(b, { da: '2026-10-19', a: '2026-10-21' });
  assert.match(testo, /SUMMARY:Bidone\r\n/);
  assert.doesNotMatch(testo, /[\u{1F000}-\u{1FFFF}]/u);
});
