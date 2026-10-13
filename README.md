# Nomesmentego

I promemoria periodici di famiglia e amici in una web app semplice: spazzatura porta a porta, mercato del martedì,
scadenze dell'auto, medicine, compleanni. Si configura dal browser e gli avvisi arrivano **sul calendario del telefono**
(iPhone e Android), senza installare niente e senza account.

- Ogni **bacheca** (es. "Casa di mamma") ha un **link segreto**: chi lo apre la vede e la modifica dal browser.
  C'è anche un link di **sola lettura**.
- Promemoria **una volta**, **ogni giorno**, **ogni settimana**, **a settimane alterne / a rotazione** (con le voci,
  es. i tipi di rifiuto), **ogni mese**, **ogni anno**, **scadenze** con preavvisi e pulsante **Fatto ✔**.
- **Giorni speciali**: festività, recuperi, un giorno in più o in meno.
- **Calendario in abbonamento**: un tocco per aggiungerlo a Calendario di iPhone o Google Calendar; le modifiche
  si aggiornano da sole.
- **Schema stampabile** delle prossime settimane, **copie di sicurezza** automatiche, import della vecchia app
  "Raccolta rifiuti" e del foglio dell'auto (vedi [`docs/esempi/auto-famiglia.yaml`](docs/esempi/auto-famiglia.yaml)).

La proposta di partenza e le scelte fatte sono in [`docs/PROPOSTA.md`](docs/PROPOSTA.md).

## Come funziona Cloudflare (in breve)

Cloudflare offre un piano **gratuito** per far girare piccoli programmi "in cloud" senza gestire un server:

- un **Worker** è il programma che risponde quando qualcuno apre l'indirizzo dell'app
  (qui: serve le pagine, salva le bacheche e genera il calendario);
- **D1** è il database dove stanno le bacheche;
- l'app riceve un indirizzo del tipo `https://nomesmentego.<tuo-nome>.workers.dev`.

Non c'è niente da accendere, aggiornare o tenere acceso: Cloudflare lo fa partire solo quando serve.
Per una famiglia i limiti gratuiti (oggi circa 100.000 richieste al giorno per i Worker e alcuni GB per D1)
sono ampiamente sufficienti; i valori aggiornati sono su
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) e
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
Il codice è pubblicato in automatico da GitHub a ogni modifica del branch `main`.

## Messa in linea (una volta sola, ~15 minuti)

1. **Account Cloudflare** gratuito su <https://dash.cloudflare.com/sign-up>. Apri una volta
   *Workers & Pages* e scegli il sottodominio `workers.dev` che ti propone.
2. **Token per GitHub**: *My Profile › API Tokens › Create Token*, modello **Edit Cloudflare Workers**,
   poi aggiungi il permesso *Account › D1 › Edit*. Copia il token.
3. **ID dell'account**: in *Workers & Pages* è nella colonna di destra (*Account ID*).
4. **Segreti su GitHub**: nel repository *Settings › Secrets and variables › Actions › New repository secret*:
   - `CLOUDFLARE_API_TOKEN` = il token del punto 2
   - `CLOUDFLARE_ACCOUNT_ID` = l'ID del punto 3
   - `CODICE_INVITO` (facoltativo ma consigliato) = una parola da chiedere a chi crea una nuova bacheca,
     così solo chi la conosce può usare il tuo spazio.
5. Fai il merge su `main` (o lancia a mano *Actions › Test e pubblicazione › Run workflow*).
   La prima volta il workflow crea anche il database. L'indirizzo dell'app compare nella pagina
   dell'esecuzione (*Actions* › l'ultima esecuzione: riquadro **App pubblicata** e link sul job *deploy*)
   e nella colonna di destra della pagina del repository, sotto **Deployments › produzione**.

Poi apri l'indirizzo, crea la bacheca, aggiungi i promemoria e, nella scheda **Telefono e condivisione**:
aggiungi il calendario al telefono e manda il link a chi serve.

## Sviluppo in locale

Serve Node.js 20 o successivo.

```bash
npm install
npm test        # test del motore delle date, del calendario e del server
npm run dev     # crea il database locale e apre l'app su http://localhost:8787
```

Per provare il codice di invito in locale crea un file `.dev.vars` con `CODICE_INVITO=prova`.

## Struttura

```
web/                 l'app, servita così com'è (niente build)
  core/              motore condiviso tra app e server: niente DOM, niente rete
    date.js            date "AAAA-MM-GG" calcolate in UTC
    modello.js         formato della bacheca, normalizzazione, import della vecchia app
    motore.js          regole di ripetizione → occorrenze → avvisi; "Fatto"; frasi in italiano
    ics.js             calendario iCalendar per il feed e il file .ics
    modelli.js         modelli pronti (spazzatura, auto, scadenze, …)
  js/                interfaccia (moduli ES, senza framework)
    app.js             avvio, navigazione (#oggi, #promemoria, …), eventi
    stato.js           stato, salvataggio automatico e conflitti
    viste.js           schermate
    editor.js          editor guidato di un promemoria
  css/app.css        stile chiaro/scuro + stampa
worker/              Cloudflare Worker: API, feed /feed/<token>.ics, manifest per la schermata Home
migrations/          tabelle del database D1
test/                node --test
docs/                proposta ed esempi
prototipo/           la vecchia app "Raccolta rifiuti" da cui siamo partiti
```

### API

| Metodo | Percorso | Cosa fa |
|---|---|---|
| `POST` | `/api/bacheche` | crea una bacheca (`{nome, codice?, dati?}`) → link di modifica e di lettura |
| `GET` | `/api/b/<token>` | legge la bacheca; `permesso` è `modifica` o `lettura` |
| `PUT` | `/api/b/<token>` | salva `{versione, dati}`; `409` se nel frattempo qualcuno l'ha cambiata |
| `GET` | `/api/b/<token>/storico[/<versione>]` | copie di sicurezza |
| `POST` | `/api/b/<token>/rigenera` | cambia il link di `modifica` o di `lettura` |
| `GET` | `/feed/<token-lettura>.ics` | calendario in abbonamento (da 7 giorni fa a 13 mesi avanti) |

Il link di modifica è salvato nel database solo come impronta SHA-256. Il server normalizza ogni bacheca
con lo stesso codice dell'app (`web/core/modello.js`), quindi non accetta dati malformati.

## Prossimi passi

Fase 3 della proposta: **email** e **Telegram**. Il modello ha già `persone` e `destinatari`; servirà un
*Cron Trigger* del Worker che ogni pochi minuti calcola gli avvisi in scadenza con `tuttiGliAvvisi()` e li manda.
