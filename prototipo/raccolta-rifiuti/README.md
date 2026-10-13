# Raccolta rifiuti

Web app leggerissima per sapere **cosa mettere fuori stasera**: settimane a rotazione (A/B o quante vuoi), tipi di rifiuto personalizzabili, eccezioni per festivi e recuperi, foglio A4 da stampare, promemoria `.ics` per il calendario e backup della configurazione in YAML.

Nessun server, nessun account, nessuna dipendenza a runtime: il risultato della build è **un solo file HTML** che funziona anche offline. I dati restano nel browser (`localStorage`) e si esportano/importano in un file YAML che conservi dove vuoi.

## Struttura

```
src/
  index.html   scheletro della pagina (con segnaposto /*@...@*/ riempiti dalla build)
  styles.css   stile dell'app (chiaro/scuro) + regole di stampa
  sheet.css    stile del foglio A4 (usato in anteprima, stampa e foglio scaricabile)
  app.js       tutta la logica: modello dati, calcolo date, interfaccia, ICS, YAML
vendor/
  js-yaml.min.js   js-yaml 4.1.0 (licenza MIT, vedi js-yaml.LICENSE), incluso nel file finale
examples/
  pescantina-zona-a1.yaml   configurazione d'esempio (Comune di Pescantina, Zona A1, 2026)
  vuoto.yaml                configurazione di partenza vuota
build.mjs      build senza dipendenze: produce dist/index.html
```

## Build

Serve solo Node.js 18 o successivo.

```bash
node build.mjs          # oppure: npm run build
```

Poi apri `dist/index.html` nel browser. Per lavorarci basta modificare i file in `src/` e rifare la build.

## Pubblicare su GitHub Pages

1. Crea un repository e carica questi file sul branch `main`.
2. In **Settings › Pages › Build and deployment** scegli **Source: GitHub Actions**.
3. A ogni push il workflow `.github/workflows/pages.yml` fa la build e pubblica l'app su `https://<utente>.github.io/<repository>/`.

Dal telefono Android apri quell'indirizzo in Chrome e usa **Menu › Aggiungi a schermata Home**.

## Il modello dati

La configurazione è un oggetto con questi campi (è anche il formato del file YAML):

| Campo | Significato |
|---|---|
| `titolo`, `sottotitolo`, `orario` | Testi mostrati nell'app e sul foglio |
| `esponiSeraPrima` | `true`: i giorni indicati sono di **ritiro** e si espone la sera prima |
| `inizioCiclo` | Un lunedì (`AAAA-MM-GG`) in cui comincia la prima settimana della lista |
| `promemoria` | `ora` (HH:MM), `avvisoMinuti`, `mesi` coperti dal file `.ics` |
| `rifiuti` | Lista di `{id, nome, colore, nota}` |
| `settimane` | Lista di `{nome, descrizione, giorni}`; `giorni` ha le chiavi `lun mar mer gio ven sab dom` con la lista degli `id` dei rifiuti ritirati |
| `eccezioni` | `{data, azione, nuovaData?, rifiuti?, nota?}`; `azione` è `annulla`, `sposta` o `aggiungi`; senza `rifiuti` vale per tutti quelli del giorno |
| `note` | Lista di `{titolo, testo}` stampati in fondo al foglio |

La settimana di una data si calcola così: numero di settimane tra `inizioCiclo` e il lunedì di quella data, modulo il numero di settimane. Ogni import passa da `normalize()` in `app.js`, che completa i campi mancanti e scarta riferimenti non validi.

## Note sul codice

- **Download.** Dentro claude.ai la pagina gira in un visualizzatore che consente solo alcune estensioni: lì `.ics` e `.yaml` vengono salvati come `.txt`. La funzione `saveFile()` prova prima quel canale (`window.claude.use('downloads')`) e, se non c'è, usa il normale download del browser con l'estensione giusta. Fuori da Claude quel ramo non si attiva mai e può anche essere rimosso.
- **Stampa.** `window.print()` con regole `@media print` che mostrano solo il foglio; in alternativa "Scarica il foglio (.html)" genera una pagina a sé con il pulsante Stampa.
- **Font.** Atkinson Hyperlegible e Bricolage Grotesque da Google Fonts, con ripiego sui font di sistema se offline.
- **Promemoria.** Un evento per ogni sera di esposizione (orario locale "floating", senza fuso), con allarme `VALARM`. Gli `UID` dipendono dalla data, quindi reimportando in un calendario dedicato si evitano doppioni.

## Licenza

Il codice in `src/` e `build.mjs` è tuo: aggiungi la licenza che preferisci (per esempio MIT). `vendor/js-yaml.min.js` è distribuito con licenza MIT, il cui testo è in `vendor/js-yaml.LICENSE`.

I dati dell'esempio di Pescantina sono ricostruiti dal calendario 2026 del Comune: in caso di dubbio vale il calendario ufficiale.
