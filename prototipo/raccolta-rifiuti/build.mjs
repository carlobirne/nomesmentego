// Build senza dipendenze: unisce src/ e vendor/ in un unico file HTML autonomo.
// Uso: node build.mjs   ->   dist/index.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const put = (text, token, value) => {
  if (!text.includes(token)) throw new Error(`Segnaposto mancante: ${token}`);
  return text.split(token).join(value); // niente regex: il codice incluso può contenere "$"
};

const sheetCss = read('./src/sheet.css');
const styles = put(read('./src/styles.css'), '/*@SHEET_CSS@*/', sheetCss);
const app = put(read('./src/app.js'), '/*@SHEET_CSS_JSON@*/""', JSON.stringify(sheetCss));

let html = read('./src/index.html');
html = put(html, '/*@JSYAML@*/', read('./vendor/js-yaml.min.js'));
html = put(html, '/*@STYLES@*/', styles);
html = put(html, '/*@APPJS@*/', app);

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/index.html', import.meta.url), html);
console.log(`dist/index.html creato (${(html.length / 1024).toFixed(1)} kB)`);
