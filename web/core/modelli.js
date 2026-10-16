// "Ricette" pronte per creare promemoria in un tocco. Restituiscono dati grezzi:
// passano comunque da normalizza() prima di essere salvati.
import { lunediDi, piu, piuGiorni, fineMese, valida } from './date.js';
import { nuovoId, quandoDaScadenza } from './modello.js';

const sera = (ora = '20:00', testo = '') => ({ prima: 1, unita: 'giorni', ora, testo });
const mattina = (ora = '08:00', testo = '') => ({ prima: 0, unita: 'giorni', ora, testo });
const giorniPrima = (n, ora = '09:00') => ({ prima: n, unita: 'giorni', ora, testo: '' });

export const MODELLI = [
  {
    id: 'rifiuti', icona: 'spazzatura', nome: 'Spazzatura',
    descrizione: 'Raccolta porta a porta, anche a settimane alterne',
    crea: (oggi) => ({
      titolo: 'Raccolta rifiuti', icona: 'spazzatura',
      quando: { tipo: 'rotazione', inizio: lunediDi(oggi), settimane: [{ nome: 'Settimana A', giorni: {} }, { nome: 'Settimana B', giorni: {} }] },
      voci: [
        { id: 'umido', nome: 'Umido', colore: '#6b3f1f' },
        { id: 'secco', nome: 'Secco', colore: '#4d5257' },
        { id: 'plastica', nome: 'Plastica e lattine', colore: '#f2c230' },
        { id: 'carta', nome: 'Carta e cartone', colore: '#22579a' },
        { id: 'vetro', nome: 'Vetro', colore: '#2f7d4f' },
      ],
      avvisi: [sera('20:30', 'Metti fuori stasera: {voci}')],
    }),
  },
  {
    id: 'auto', icona: 'auto', nome: 'Auto',
    descrizione: 'Revisione, bollo, assicurazione, tagliando, gomme',
    speciale: true,
  },
  {
    id: 'compleanno', icona: 'compleanno', nome: 'Compleanno o anniversario',
    descrizione: 'Ogni anno nello stesso giorno',
    crea: (oggi) => ({
      titolo: 'Compleanno di ', icona: 'compleanno',
      quando: { tipo: 'annuale', mese: +oggi.slice(5, 7), giorno: +oggi.slice(8, 10) },
      avvisi: [giorniPrima(7), mattina('08:30', 'Oggi: {titolo}!')],
    }),
  },
  {
    id: 'medicina', icona: 'medicina', nome: 'Medicina',
    descrizione: 'Ogni giorno o ogni tot giorni',
    crea: (oggi) => ({
      titolo: '', icona: 'medicina',
      quando: { tipo: 'giornaliero', ogni: 1, inizio: oggi },
      avvisi: [mattina('08:00')],
    }),
  },
  {
    id: 'personalizzato', icona: 'campanella', nome: 'Personalizzato',
    descrizione: 'Scegli tu cosa, quando e ogni quanto: una volta, ogni settimana, ogni mese, ogni anno…',
    crea: (oggi) => ({
      titolo: '', icona: 'campanella',
      quando: { tipo: 'una-volta', data: piuGiorni(oggi, 1) },
      avvisi: [sera('20:00')],
    }),
  },
];

export const VOCI_AUTO = [
  { id: 'revisione', nome: 'Revisione', aiuto: 'La prima a 4 anni dall\'immatricolazione, poi ogni 2 anni entro fine mese',
    ripeti: { ogni: 2, unita: 'anni', fineMese: true } },
  { id: 'bollo', nome: 'Bollo', aiuto: 'Ogni anno',
    ripeti: { ogni: 1, unita: 'anni' } },
  { id: 'assicurazione', nome: 'Assicurazione', aiuto: 'Ogni anno',
    ripeti: { ogni: 1, unita: 'anni' } },
  { id: 'tagliando', nome: 'Tagliando', aiuto: 'Di solito ogni 2 anni o 25.000 km', nota: 'Entro 25.000 km o 2 anni: dipende dall\'auto.',
    ripeti: { ogni: 2, unita: 'anni' } },
  { id: 'gomme', nome: 'Cambio gomme', aiuto: 'Estive/invernali: ogni 6 mesi',
    nota: 'Gomme invernali obbligatorie dal 15 novembre al 15 aprile (dove previsto). Controlla lo stato delle gomme.',
    ripeti: { ogni: 6, unita: 'mesi' } },
];

/** Prima revisione: fine del mese di immatricolazione + 4 anni. */
export const primaRevisione = (immatricolazione) => fineMese(piu(immatricolazione, 4, 'anni'));

/**
 * Crea gruppo e promemoria per un'auto.
 * @param nome      es. "Passat"
 * @param scadenze  { revisione: 'AAAA-MM-GG', bollo: ..., ... } (le vuote si saltano)
 * @param preavviso giorni del primo avviso (default 20, come nel foglio Google)
 */
export function creaAuto({ nome, icona = 'auto', colore = '#e8231c', scadenze = {}, preavviso = 20 }) {
  const gruppo = { id: nuovoId('g'), nome: nome || 'Auto', icona, colore };
  const promemoria = VOCI_AUTO.filter((v) => valida(scadenze[v.id])).map((v) => ({
    id: nuovoId('p'),
    titolo: v.nome + ' ' + gruppo.nome,
    gruppo: gruppo.id,
    icona: '',
    nota: v.nota || '',
    quando: quandoDaScadenza(scadenze[v.id], v.ripeti),
    avvisi: [giorniPrima(preavviso), giorniPrima(7), mattina('09:00')],
    // è una scadenza: se passa senza "Fatto" la ricordo ogni 3 giorni; le date precedenti contano come fatte
    scadenza: { attiva: true, ogni: 3, fattoFino: piuGiorni(scadenze[v.id], -1) },
  }));
  return { gruppo, promemoria };
}
