// Disegni nello stile della creaturina dell'app (ispirata a Joan Miró): contorno nero spesso,
// colori pieni rosso, blu, giallo e verde, forme divise a metà tra due colori, occhi bianchi
// con pupilla e riflesso, stelle a raggi e pallini bicolori.
// I colori vengono dalle variabili CSS, così funzionano anche col tema scuro.

const R = 'var(--m-rosso)', B = 'var(--m-blu)', G = 'var(--m-giallo)', V = 'var(--m-verde)', N = 'var(--tratto)', P = 'var(--pupilla)', W = '#ffffff';

/** occhio: bianco, pupilla nera spostata in alto a destra, riflesso bianco */
const occhio = (x, y, r = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${W}"/><circle cx="${x + r * 0.22}" cy="${y - r * 0.15}" r="${r * 0.48}" fill="${P}" stroke="none"/><circle cx="${x + r * 0.42}" cy="${y - r * 0.35}" r="${r * 0.16}" fill="${W}" stroke="none"/>`;
/** pallino diviso in due colori (sinistra/destra) */
const pallino = (x, y, r, sx, dx) =>
  `<path d="M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}Z" fill="${sx}" stroke="none"/><path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${dx}" stroke="none"/><circle cx="${x}" cy="${y}" r="${r}"/>`;
/** stella di Miró: raggi neri e centro colorato */
const stella = (x, y, s = 4, c = R) =>
  `<path d="M${x} ${y - s}V${y + s}M${x - s} ${y}H${x + s}M${x - s * 0.7} ${y - s * 0.7}L${x + s * 0.7} ${y + s * 0.7}M${x + s * 0.7} ${y - s * 0.7}L${x - s * 0.7} ${y + s * 0.7}"/><circle cx="${x}" cy="${y}" r="${s * 0.32}" fill="${c}" stroke="none"/>`;
/** archi dello "squillo" */
const squillo = (x, y, h = 5) => `<path d="M${x} ${y - h}Q${x + h * 0.55} ${y} ${x} ${y + h}" stroke-width="2.2"/><path d="M${x + 3} ${y - h * 1.5}Q${x + 3 + h * 0.85} ${y} ${x + 3} ${y + h * 1.5}" stroke-width="2.2"/>`;

/** Icone dei promemoria: chiave -> { nome, svg (contenuto 48x48) } */
export const ICONE = {
  campanella: { nome: 'Campanella', svg:
    `<path d="M24 12Q13 14 13.5 33H24Z" fill="${R}" stroke="none"/><path d="M24 12Q35 14 34.5 33H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M13.5 33Q13 14 24 12Q35 14 34.5 33Z"/><path d="M10 33.5H38"/><path d="M24 12V8"/>` +
    `${pallino(24, 38.5, 3.2, G, R)}${occhio(20, 23, 3.4)}${occhio(28.5, 22.5, 2.8)}${squillo(39, 15, 4)}` },
  spazzatura: { nome: 'Spazzatura', svg:
    `<path d="M13 17H24V41.5H15.5Z" fill="${V}" stroke="none"/><path d="M24 17H35L32.5 41.5H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M13 17H35L32.5 41.5H15.5Z"/><path d="M9.5 15.5H38.5" stroke-width="3.6"/><path d="M20 12.5Q24 8.5 28 12.5"/>` +
    `${occhio(20, 26, 3.6)}${occhio(28.5, 25.5, 3)}<path d="M21 34.5Q24.5 37 28 34"/>` },
  mercato: { nome: 'Mercato', svg:
    `<path d="M15 21Q24 4 33 21"/>` +
    `<path d="M8.5 21.5H24V40.5H13Z" fill="${G}" stroke="none"/><path d="M24 21.5H39.5L35 40.5H24Z" fill="${R}" stroke="none"/>` +
    `<path d="M8.5 21.5H39.5L35 40.5H13Z"/><path d="M11 29H37" stroke-width="2"/>${pallino(41, 9, 3, P, V)}` },
  auto: { nome: 'Auto', svg:
    `<path d="M6.5 32Q7 22.5 15.5 21.5L20 15Q24 13 24 13V32Z" fill="${R}" stroke="none"/><path d="M24 13Q28 13 30.5 15L34.5 21.5Q41.5 22.5 41.5 32H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M6.5 32Q7 22.5 15.5 21.5L20 15Q24 12.5 30.5 15L34.5 21.5Q41.5 22.5 41.5 32Z"/>` +
    `<path d="M21 21.5L23 17.5H29L31 21.5Z" fill="${W}"/>` +
    `${pallino(15, 33, 4.4, P, P)}<circle cx="15" cy="33" r="1.5" fill="${G}" stroke="none"/>${pallino(33, 33, 4.4, P, P)}<circle cx="33" cy="33" r="1.5" fill="${G}" stroke="none"/>` +
    `${occhio(37.5, 26, 2.6)}` },
  documento: { nome: 'Documento', svg:
    `<path d="M12.5 7.5H30L35.5 13.5V41H12.5Z" fill="${W}"/><path d="M30 7.5V13.5H35.5"/>` +
    `${occhio(20, 20, 3.6)}<g stroke="${P}"><path d="M17.5 30H30.5M17.5 35H26"/></g>${pallino(31, 35.5, 4, G, R)}` },
  medicina: { nome: 'Medicina', svg:
    `<g transform="rotate(-35 24 24)"><path d="M24 17H15A7 7 0 0 0 15 31H24Z" fill="${R}"/><path d="M24 17H33A7 7 0 0 1 33 31H24Z" fill="${G}"/></g>` +
    `${stella(38.5, 9.5, 4, B)}${pallino(9, 39, 3, B, P)}` },
  compleanno: { nome: 'Festa', svg:
    `<path d="M10.5 26H24V41H10.5Z" fill="${B}" stroke="none"/><path d="M24 26H37.5V41H24Z" fill="${R}" stroke="none"/><path d="M10.5 26H37.5V41H10.5Z"/>` +
    `<path d="M10.5 31q3.4 3 6.75 0t6.75 0t6.75 0t6.75 0" stroke="${W}" stroke-width="2.4"/>` +
    `<path d="M24 25.5V18" stroke-width="3.2"/><path d="M24 8c3.2 3.2 2.4 6.6 0 7.4c-2.4-.8-3.2-4.2 0-7.4Z" fill="${G}"/>${stella(9, 12, 3.4, R)}${pallino(40, 13, 2.8, G, V)}` },
  calendario: { nome: 'Calendario', svg:
    `<path d="M9 13H39V40H9Z" fill="${W}"/><path d="M9 13H24V20.5H9Z" fill="${R}" stroke="none"/><path d="M24 13H39V20.5H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M9 13H39V40H9Z"/><path d="M9 20.5H39"/><path d="M17 9V16M31 9V16"/>${pallino(19, 30.5, 5, G, P)}` +
    `<circle cx="30" cy="27.5" r="1.5" fill="${P}" stroke="${P}"/><circle cx="34.5" cy="27.5" r="1.5" fill="${P}" stroke="${P}"/><circle cx="30" cy="33.5" r="1.5" fill="${P}" stroke="${P}"/>` },
  casa: { nome: 'Casa', svg:
    `<path d="M9.5 22.5L24 10V40H9.5Z" fill="${R}" stroke="none"/><path d="M24 10L38.5 22.5V40H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M9.5 22.5L24 10L38.5 22.5V40H9.5Z"/><path d="M20 40V31H28V40Z" fill="${G}"/>${occhio(18, 22, 3.2)}${occhio(30, 22, 3.2)}${stella(40, 8, 3.4, G)}` },
  fuoco: { nome: 'Caldaia', svg:
    `<path d="M24 42C14 41 12 30.5 18 23.5C19 28.5 22.5 28.5 22 24C21.5 18 25 12.5 29.5 8.5C28.5 17 37.5 22 34.5 32.5C33 38.5 29 42 24 42Z" fill="${R}"/>` +
    `<path d="M24 40.5C20 38.5 20.5 33.5 24 29.5C27.5 33.5 28 38 24 40.5Z" fill="${G}"/>${occhio(22, 23.5, 2.6)}` },
  acqua: { nome: 'Acqua', svg:
    `<path d="M24 6.5C18 16.5 11.5 22.5 11.5 30A12.5 12.5 0 0 0 24 42.5Z" fill="${B}" stroke="none"/><path d="M24 6.5C30 16.5 36.5 22.5 36.5 30A12.5 12.5 0 0 1 24 42.5Z" fill="${V}" stroke="none"/>` +
    `<path d="M24 6.5C30 16.5 36.5 22.5 36.5 30A12.5 12.5 0 0 1 11.5 30C11.5 22.5 18 16.5 24 6.5Z"/>${occhio(20, 29, 3.4)}${occhio(28.5, 28.5, 2.8)}` },
  animale: { nome: 'Creaturina', svg:
    `<path d="M10 30Q10 17.5 23 17.5V35.5Q15 36 12 33Z" fill="${R}" stroke="none"/><path d="M23 17.5Q37 17.5 38 28.5Q38 35 30 35H23Z" fill="${B}" stroke="none"/>` +
    `<path d="M10 30Q10 17.5 23 17.5Q37 17.5 38 28.5Q38 35 30 35H23Q15 36 12 33Q10.5 31.5 10 30Z"/>` +
    `${occhio(19, 25, 3.4)}${occhio(28.5, 24.5, 3)}<path d="M26 30.5Q29.5 33 33 29.5"/>` +
    `<path d="M16 35.5L14 42" stroke-width="3"/><circle cx="13.8" cy="42.5" r="2" fill="${P}" stroke="none"/><path d="M28 35.5q1 5 4.5 4.5q2.5-1 1-3"/>` +
    `<path d="M16 18.5Q14 13 11 11"/>${stella(10, 9.5, 3.2)}<path d="M29 18Q31 13 31 11"/>${pallino(31, 8.5, 2.6, G, R)}` },
  pianta: { nome: 'Pianta', svg:
    `<path d="M24 42V20"/><path d="M24 30Q14 30.5 12.5 20.5Q22.5 19.5 24 30Z" fill="${V}"/><path d="M24 25.5Q31.5 14.5 38.5 17.5Q35.5 27.5 24 25.5Z" fill="${G}"/>` +
    `${pallino(24, 13, 5, R, B)}<path d="M15 42H33" stroke-width="3.4"/>` },
  salute: { nome: 'Salute', svg:
    `<path d="M19 9H24V39H19V29H9V19H19Z" fill="${R}" stroke="none"/><path d="M24 9H29V19H39V29H29V39H24Z" fill="${B}" stroke="none"/>` +
    `<path d="M19 9H29V19H39V29H29V39H19V29H9V19H19Z"/>${stella(40.5, 40.5, 3.4, G)}${pallino(8, 8, 2.8, G, P)}` },
  scuola: { nome: 'Scuola', svg:
    `<path d="M12.5 35.5L31.5 10L38 15L19 40.5Z" fill="${G}"/><path d="M12.5 35.5L19 40.5L10.5 43Z" fill="${W}"/><path d="M10.5 43L12 40.5" stroke-width="3.4"/>` +
    `<path d="M31.5 10L35 5.5L41.5 10.5L38 15Z" fill="${R}"/>${pallino(10, 12, 3.4, B, R)}` },
  sport: { nome: 'Sport', svg:
    `${pallino(24, 24, 15, R, B)}<path d="M9.5 21Q24 27 38.5 21" stroke="${W}" stroke-width="2.4"/><circle cx="24" cy="24" r="15"/>${stella(41, 8, 3.2, G)}` },
  soldi: { nome: 'Soldi', svg:
    `<circle cx="30" cy="20" r="12" fill="${R}"/><circle cx="21" cy="28" r="14" fill="${G}"/>` +
    `<path d="M27 21.5Q23.5 18 19.5 20.5Q15.5 23.5 16.5 28.5Q17.5 34 22.5 34.5Q25.5 34.5 27.5 32.5M12.5 26.5H23M12.5 30.5H22" stroke="${P}"/>` },
  telefono: { nome: 'Telefono', svg:
    `<path d="M14 9H20L22 17L18 20Q21 27 28 30L31 26L39 28V34Q38 40.5 32 39.5Q14 36.5 9 16Q9 10 14 9Z" fill="${B}"/>` +
    `${squillo(34, 13, 4)}${pallino(14, 9.5, 2.6, G, R)}` },
  stella: { nome: 'Stella', svg:
    `<path d="M24 5.5V42.5M5.5 24H42.5M11 11L37 37M37 11L11 37" stroke-width="3.2"/><circle cx="24" cy="24" r="5.5" fill="${R}"/>${pallino(39.5, 39.5, 3.2, G, B)}` },
  luna: { nome: 'Luna', svg:
    `<path d="M29.5 7.5A16.5 16.5 0 1 0 29.5 40.5A22 22 0 0 1 29.5 7.5Z" fill="${G}"/>${pallino(39, 13, 3.4, P, V)}${stella(40, 33, 3, R)}` },
  uccello: { nome: 'Uccello', svg:
    `<path d="M7.5 28Q17 14 34 19.5L34 30Q28 34 16 32Z" fill="${B}" stroke="none"/><path d="M34 19.5L42.5 15.5L38.5 24Q37 27.5 34 30Z" fill="${G}" stroke="none"/>` +
    `<path d="M7.5 28Q17 14 34 19.5L42.5 15.5L38.5 24Q30 34 16 32Z"/><path d="M15 25Q20 16 27 20Q22 27 15 25Z" fill="${R}"/>` +
    `${occhio(31, 23, 2.8)}<path d="M20 32.5l-2 7M25 32l1 7"/>${pallino(9, 10, 3, R, B)}` },
  occhio: { nome: 'Occhio', svg:
    `<path d="M5.5 24Q24 6.5 42.5 24Q24 41.5 5.5 24Z" fill="${W}"/>${pallino(24, 24, 7, R, B)}<circle cx="25" cy="23" r="3.2" fill="${P}" stroke="none"/><circle cx="26.5" cy="21.5" r="1.1" fill="${W}" stroke="none"/>` +
    `<path d="M24 10V5.5M15 12.5L12.5 8.5M33 12.5L35.5 8.5"/>` },
};

/** Marchi dei calendari, ridisegnati nello stesso stile (non compaiono tra i disegni dei promemoria). */
const MARCHI = {
  apple: `<path d="M24.5 15.5C24 11 27 7.8 31 7.2C31.5 11.6 28.6 14.8 24.5 15.5Z" fill="${V}"/>` +
    `<path d="M24 17.5C21 15 12.5 14 12 25.5C11.5 34 17 41.5 20.8 41.5C22.6 41.5 23 40.6 24 40.6C25 40.6 25.4 41.5 27.2 41.5C30.4 41.5 34.2 36.8 35.8 32.6C31.2 30.6 30.6 23.2 35 20.6C32.6 16.6 27.2 15 24 17.5Z" fill="${N}"/>` +
    occhio(19.8, 26.5, 4.6),
  google: `<g stroke-width="6.5" stroke-linecap="butt"><path d="M32.49 15.51A12 12 0 0 0 13.61 18" stroke="#e8231c"/>` +
    `<path d="M13.61 18A12 12 0 0 0 13.61 30" stroke="#f6c700"/><path d="M13.61 30A12 12 0 0 0 32.49 32.49" stroke="#2db04b"/>` +
    `<path d="M32.49 32.49A12 12 0 0 0 36 24H24.5" stroke="#2e5fa8"/></g>`,
};
export const marchioCalendario = (k) =>
  `<span class="logo-servizio" aria-hidden="true"><svg class="disegno" viewBox="0 0 48 48" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${MARCHI[k]}</g></svg></span>`;

/** SVG inline di un'icona. */
export function icona(chiave, cls = '') {
  const i = ICONE[chiave] || ICONE.campanella;
  return `<svg class="disegno ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${i.svg}</g></svg>`;
}

/** Scene: la creaturina dell'app e qualche decorazione. */
export const SCENE = {
  // pagina iniziale: l'illustrazione completa dell'icona
  home: '<img class="scena-home" src="/icone/creatura.svg" alt="" width="220" height="220">',
  // stato vuoto: la creaturina da sola
  vuoto: '<img class="scena-vuoto" src="/icone/logo.svg" alt="" width="110" height="148">',
  // decorazione del riquadro "Oggi" (su fondo blu)
  oggi: `<svg class="disegno deco-oggi" viewBox="0 0 120 70" aria-hidden="true" focusable="false"><g fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M70 8A17 17 0 0 0 70 42Z" fill="${G}" stroke="none"/><path d="M70 8A17 17 0 0 1 70 42Z" fill="${R}" stroke="none"/><circle cx="70" cy="25" r="17"/>
    <path d="M94 12Q102 25 94 38" stroke="#fbf6ea"/><path d="M101 5Q113 25 101 45" stroke="#fbf6ea"/>
    <path d="M30 46V66M20 56H40M23 49L37 63M37 49L23 63" stroke="#fbf6ea"/><circle cx="30" cy="56" r="3" fill="${R}" stroke="none"/>
  </g></svg>`,
};
