// Disegni a tratto, ispirati alle creaturine di Joan Miró: segni neri, colori primari pieni,
// stelle, lune e occhi. Sono SVG in linea; il filtro #schizzo (in index.html) rende il tratto irregolare.
// I colori vengono dalle variabili CSS, così funzionano anche col tema scuro.

const P = 'var(--pupilla)';
const R = 'var(--m-rosso)', B = 'var(--m-blu)', G = 'var(--m-giallo)', V = 'var(--m-verde)', N = 'var(--tratto)', C = 'var(--carta)';
const occhio = (x, y, r = 4, iride = "var(--pupilla)") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C}"/><circle cx="${x + r * 0.2}" cy="${y + r * 0.15}" r="${r * 0.45}" fill="${iride}" stroke="none"/>`;
const stellina = (x, y, s = 4) => `<path d="M${x} ${y - s}V${y + s}M${x - s} ${y}H${x + s}M${x - s * 0.7} ${y - s * 0.7}L${x + s * 0.7} ${y + s * 0.7}M${x + s * 0.7} ${y - s * 0.7}L${x - s * 0.7} ${y + s * 0.7}"/>`;

/** Icone dei promemoria: chiave -> { nome, svg (contenuto 48x48) } */
export const ICONE = {
  campanella: { nome: 'Campanella', svg: `<path d="M24 14v-4"/><path d="M14 33Q13 17 24 14Q35 17 34 33Z" fill="${G}"/><path d="M10 33.5Q24 31 38 33.5"/><circle cx="24" cy="38" r="2.6" fill="${R}"/>${occhio(24, 24, 3.6)}` },
  spazzatura: { nome: 'Spazzatura', svg: `<path d="M13 17L35 16L32.5 40Q24 42.5 15.5 40.5Z" fill="${V}"/><path d="M9.5 15.5Q24 10 38.5 14.5"/><path d="M20.5 12Q24 7.5 27.5 11.5"/>${occhio(24, 27, 5)}<path d="M18 41l-2.5 4.5M30 41l2.5 4.5"/>` },
  mercato: { nome: 'Mercato', svg: `<path d="M15 22Q24 5 33 22"/><path d="M8.5 22.5Q24 20.5 39.5 22L35 40Q24 41.5 13 40Z" fill="${G}"/><g stroke="${P}">${stellina(24, 31, 5)}</g>` },
  auto: { nome: 'Auto', svg: `<path d="M6.5 32Q7 22.5 15.5 21.5L20 15Q24.5 12.5 30.5 15L34.5 21.5Q41.5 22.5 41.5 32Z" fill="${R}"/><path d="M21.5 21L23.5 17.2H29.2L31 21Z" fill="${C}"/><circle cx="15" cy="33" r="4.2" fill="${N}"/><circle cx="33" cy="33" r="4.2" fill="${N}"/>${occhio(37.5, 26, 2.6, B)}` },
  documento: { nome: 'Documento', svg: `<path d="M13 7.5H30L35.5 13.5V41H12.5Z" fill="${C}"/><path d="M30 7.5V13.5H35.5"/><g stroke="${P}"><path d="M17.5 24Q24.5 17 31 24Q24.5 31 17.5 24Z"/><circle cx="24.5" cy="24" r="2.6" fill="${B}" stroke="none"/><path d="M18 33.5H31M18 37.5H27"/></g>` },
  medicina: { nome: 'Medicina', svg: `<g transform="rotate(-35 24 24)"><path d="M24 17.5H15A6.5 6.5 0 0 0 15 30.5H24Z" fill="${R}"/><path d="M24 17.5H33A6.5 6.5 0 0 1 33 30.5H24Z" fill="${G}"/></g>${stellina(38, 9, 3)}<circle cx="9" cy="38" r="1.6" fill="${N}"/>` },
  compleanno: { nome: 'Festa', svg: `<path d="M11 26.5H37V40.5H11Z" fill="${G}"/><path d="M11 30.5q3 3 6.5 0t6.5 0t6.5 0t6.5 0" stroke="${P}"/><path d="M24 26V18" stroke-width="3"/><path d="M24 9.5c3 3 2 6-0 6.5c-2-.5-3-3.5 0-6.5Z" fill="${R}"/>${stellina(9, 14, 3)}` },
  calendario: { nome: 'Calendario', svg: `<path d="M9 13H39V40H9Z" fill="${C}"/><path d="M9 13H39V20H9Z" fill="${R}"/><path d="M17 9V16M31 9V16"/><path d="M21 24A6.5 6.5 0 1 0 21 37A9 9 0 0 1 21 24Z" fill="${B}" stroke="${P}"/><circle cx="29" cy="27.5" r="1.3" fill="${P}" stroke="${P}"/><circle cx="34" cy="27.5" r="1.3" fill="${P}" stroke="${P}"/><circle cx="29" cy="33.5" r="1.3" fill="${P}" stroke="${P}"/>` },
  casa: { nome: 'Casa', svg: `<path d="M9.5 22.5L24 10L38.5 22V40H10Z" fill="${G}"/><path d="M20 40V30.5H28V40" fill="${B}"/>${occhio(24, 21, 3.4)}` },
  fuoco: { nome: 'Caldaia', svg: `<path d="M24 41.5C14 40.5 12 30 18 23C19 28 22.5 28 22 23.5C21.5 17.5 25 12.5 29.5 8.5C28.5 17 37.5 22 34.5 32.5C33 38.5 29 41.5 24 41.5Z" fill="${R}"/><path d="M24 40C20 38 20.5 33 24 29C27.5 33 28 37.5 24 40Z" fill="${G}"/>` },
  acqua: { nome: 'Acqua', svg: `<path d="M24 6.5C30 16.5 36.5 22.5 36.5 30A12.5 12.5 0 0 1 11.5 30C11.5 22.5 18 16.5 24 6.5Z" fill="${B}"/>${occhio(24, 30, 4.4)}` },
  animale: { nome: 'Animale', svg: `<path d="M10 30Q11.5 19.5 24 19.5Q36.5 19.5 38 29.5Q31 35 18 35Q12 35 10 30Z" fill="${N}"/><path d="M15 34l-1.5 7M33 33l1.5 7M22 35l-.5 6"/><path d="M38 28q5-3 3-8t-6-2"/><path d="M14 21l-3-6M19 19.5l-1-6"/>${occhio(17, 26, 3.6, R)}` },
  pianta: { nome: 'Pianta', svg: `<path d="M24 41.5V21"/><path d="M24 29Q14 29.5 12.5 19.5Q22.5 18.5 24 29Z" fill="${V}"/><path d="M24 24.5Q31.5 13.5 38.5 16.5Q35.5 26.5 24 24.5Z" fill="${V}"/><circle cx="37" cy="8.5" r="3.2" fill="${R}"/><path d="M15 41.5H33"/>` },
  salute: { nome: 'Salute', svg: `<path d="M19 9H29V19H39V29H29V39H19V29H9V19H19Z" fill="${R}"/>${stellina(40, 40, 3)}<circle cx="8" cy="8" r="1.6" fill="${N}"/>` },
  scuola: { nome: 'Scuola', svg: `<path d="M12.5 35.5L31.5 10L38 15L19 40.5L11 42Z" fill="${G}"/><path d="M12.5 35.5L19 40.5"/><path d="M28.5 14L35 19"/><circle cx="9" cy="12" r="2.5" fill="${B}"/>` },
  sport: { nome: 'Sport', svg: `<circle cx="24" cy="24" r="15" fill="${C}"/><path d="M24 24a2.5 2.5 0 1 1 2.5 2.5a5.5 5.5 0 1 1-5.5-5.5a8.5 8.5 0 1 1 8.5 8.5" stroke="${P}"/><circle cx="40" cy="9" r="2" fill="${R}"/>` },
  soldi: { nome: 'Soldi', svg: `<circle cx="24" cy="24" r="15" fill="${G}"/><path d="M30.5 17.5Q26 13.5 21 16.5Q16.5 20 17.5 26Q18.5 33 25 33.5Q28.5 33.5 30.5 31M13.5 22H26M13.5 27H25" stroke="${P}"/>` },
  telefono: { nome: 'Telefono', svg: `<path d="M14 9H20L22 17L18 20Q21 27 28 30L31 26L39 28V34Q38 40.5 32 39.5Q14 36.5 9 16Q9 10 14 9Z" fill="${B}"/>${stellina(37, 11, 3.5)}` },
  stella: { nome: 'Stella', svg: `<path d="M24 5.5V42.5M5.5 24H42.5M11 11L37 37M37 11L11 37"/><circle cx="24" cy="24" r="4.5" fill="${R}"/>` },
  luna: { nome: 'Luna', svg: `<path d="M29.5 7.5A16.5 16.5 0 1 0 29.5 40.5A22 22 0 0 1 29.5 7.5Z" fill="${G}"/><circle cx="39" cy="12" r="1.8" fill="${N}"/><circle cx="41" cy="21" r="1.2" fill="${N}"/>` },
  uccello: { nome: 'Uccello', svg: `<path d="M7.5 28Q17 14 34 19.5L42.5 15.5L38.5 24Q30 34 16 32Z" fill="${B}"/>${occhio(30, 23, 2.8)}<path d="M20 32.5l-2 7M25 32l1 7"/>` },
  occhio: { nome: 'Occhio', svg: `<path d="M5.5 24Q24 6.5 42.5 24Q24 41.5 5.5 24Z" fill="${C}"/><circle cx="24" cy="24" r="6.5" fill="${B}"/><circle cx="24.5" cy="24.5" r="2.6" fill="var(--pupilla)" stroke="none"/><path d="M24 10V5.5M15 12.5L12.5 8.5M33 12.5L35.5 8.5"/>` },
};

/** SVG inline di un'icona. */
export function icona(chiave, cls = '') {
  const i = ICONE[chiave] || ICONE.campanella;
  return `<svg class="disegno ${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${i.svg}</g></svg>`;
}

/** Piccole scene decorative. */
export const SCENE = {
  // pagina iniziale: sole rosso, stella, luna, una creaturina con l'occhio grande, la scala di Miró
  home: `<svg class="disegno scena" viewBox="0 0 340 130" aria-hidden="true" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="42" cy="40" r="20" fill="${R}"/>
    <path d="M100 18V62M78 40H122M84.5 24.5L115.5 55.5M115.5 24.5L84.5 55.5"/><circle cx="100" cy="40" r="5" fill="${N}"/>
    <path d="M282 14A24 24 0 1 0 282 62A32 32 0 0 1 282 14Z" fill="${G}"/>
    <path d="M150 112Q148 74 186 70Q226 68 230 104Q232 116 214 116H166Q150 116 150 112Z" fill="${B}"/>
    <circle cx="190" cy="92" r="12" fill="${C}"/><circle cx="192" cy="93" r="5.5" fill="var(--pupilla)" stroke="none"/>
    <path d="M172 72Q164 50 176 40"/><circle cx="177" cy="38" r="4" fill="${R}"/>
    <path d="M206 71Q214 52 230 50"/><path d="M226 44L234 56M234 44L226 56"/>
    <path d="M166 116l-6 10M212 116l6 10"/>
    <path d="M318 126V70M334 126V70M318 80H334M318 92H334M318 104H334M318 116H334"/>
    <path d="M20 112q14-14 28 0t28 0t28 0"/>
    <circle cx="252" cy="104" r="3" fill="${N}"/><circle cx="264" cy="96" r="2" fill="${N}"/><circle cx="130" cy="90" r="2.5" fill="${N}"/>
  </g></svg>`,
  // stato vuoto: creaturina che aspetta
  vuoto: `<svg class="disegno scena piccola" viewBox="0 0 140 90" aria-hidden="true" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 78Q26 44 62 40Q100 40 102 74Q103 82 92 82H40Q30 82 30 78Z" fill="${G}"/>
    <circle cx="66" cy="60" r="10" fill="${C}"/><circle cx="68" cy="61" r="4.5" fill="var(--pupilla)" stroke="none"/>
    <path d="M54 41Q50 22 60 14"/><circle cx="61" cy="12" r="4" fill="${R}"/>
    <path d="M44 82l-4 6M88 82l4 6"/>
    <path d="M118 14V40M105 27H131M109 18L127 36M127 18L109 36"/>
  </g></svg>`,
  // decorazione del riquadro "Oggi"
  oggi: `<svg class="disegno deco-oggi" viewBox="0 0 120 70" aria-hidden="true" focusable="false"><g fill="none" stroke="var(--su-blu)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M70 6A18 18 0 1 0 70 42A24 24 0 0 1 70 6Z" fill="${G}" stroke="${N}"/>
    <path d="M102 10V40M87 25H117M91 14L113 36M113 14L91 36"/>
    <circle cx="30" cy="54" r="6" fill="${R}" stroke="${N}"/>
  </g></svg>`,
  // piccolo segno accanto al nome dell'app
  marchio: `<svg class="disegno marchio" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 24Q24 8 42 24Q24 40 6 24Z" fill="${C}"/><circle cx="24" cy="24" r="6" fill="${R}"/><circle cx="25" cy="25" r="2.4" fill="var(--pupilla)" stroke="none"/>
    <path d="M24 10V4M14 12.5L11 8M34 12.5L37 8"/>
  </g></svg>`,
};
