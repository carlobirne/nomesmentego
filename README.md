# Nomesmentego

I promemoria periodici di famiglia e amici in una web app semplice: spazzatura porta a porta, mercato del martedì,
scadenze dell'auto, medicine, compleanni. Si configura dal browser e gli avvisi arrivano **sul calendario del telefono**
(iPhone e Android), senza installare niente e senza account.

- Ogni **bacheca** (es. "Casa di mamma") ha un **link segreto**: chi lo apre la vede e la modifica dal browser.
  C'è anche un link di **sola lettura**.
- Promemoria **una volta**, **ogni giorno**, **ogni settimana**, **a settimane alterne / a rotazione** (con le voci,
  es. i tipi di rifiuto), **ogni mese**, **ogni anno**, **scadenze** con preavvisi e pulsante **Fatto**.
- **Giorni speciali**: festività, recuperi, un giorno in più o in meno.
- **Calendario in abbonamento**: un tocco per aggiungerlo a Calendario di iPhone o Google Calendar; le modifiche
  si aggiornano da sole.
- **Notifiche dell'app**: gli avvisi arrivano come notifiche sul telefono, senza installare niente
  (Android con Chrome; su iPhone dall'icona sulla schermata Home, iOS 16.4 o successivo).
- **Email**: un elenco di indirizzi per bacheca, con oggetto e testo personalizzabili; ogni indirizzo conferma
  con un clic prima di ricevere e può disiscriversi da ogni email.
- **Avvisi su Telegram**: un bot manda i promemoria in chat (anche in un gruppo di famiglia), all'ora di ogni avviso,
  con il tasto **Fatto** per le scadenze; per ogni chat si scelgono i gruppi da ricevere (es. la Passat a tre persone,
  la Puma a una sola).
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

## Notifiche dell'app (niente da configurare)

Nella scheda **Telefono e condivisione › Notifiche dell'app** tocca **Attiva le notifiche su questo telefono** e
rispondi **Consenti**. Funziona anche con il link di sola lettura, quindi chiunque abbia la bacheca può attivarle
sul proprio telefono.
- **Android**: con Chrome (o Edge, Samsung Internet, Firefox) direttamente dal browser.
- **iPhone/iPad**: solo dall'icona sulla schermata Home (Safari › Condividi › Aggiungi alla schermata Home),
  con iOS 16.4 o successivo. L'app lo spiega da sola quando serve.

Le chiavi di sicurezza (VAPID) le crea il server al primo uso e le salva nel database. Se un telefono revoca il
permesso, viene tolto da solo.

## Email (facoltativo, ~10 minuti)

Per mandare email serve un servizio di invio. Consiglio **[Brevo](https://www.brevo.com)**: è gratuito fino a
300 email al giorno e non richiede un dominio.
1. Crea un account Brevo. In *Senders, Domains & Dedicated IPs › Senders* aggiungi l'indirizzo da cui partono le
   email (anche il tuo Gmail) e confermalo dal link che ricevi.
2. In *SMTP & API › API Keys* crea una chiave API.
3. Su GitHub aggiungi i segreti `BREVO_API_KEY` (la chiave) ed `EMAIL_MITTENTE` (l'indirizzo verificato).
   È facoltativo `EMAIL_NOME`, il nome che compare come mittente (es. "Promemoria di famiglia").
4. Rilancia il workflow. Il passo **Email** carica i segreti su Cloudflare.

In alternativa a Brevo puoi usare [Resend](https://resend.com) con `RESEND_API_KEY`: in quel caso serve un
dominio verificato per scrivere a indirizzi diversi dal tuo.

Nell'app, in **Telefono e condivisione › Avvisi via email**:
- aggiungi gli indirizzi: ognuno riceve un'email di conferma e solo dopo il clic riceve i promemoria;
- scegli per ognuno quali gruppi riceve;
- in *Oggetto e testo dell'email* personalizzi i messaggi con parole che si riempiono da sole: `{testo}`,
  `{promemoria}`, `{voci}`, `{gruppo}`, `{data}`, `{quando}`, `{ripetizione}`, `{nota}`, `{bacheca}`.

In fondo a ogni email c'è sempre il link alla bacheca e quello per non riceverle più. Se usi un indirizzo Gmail
come mittente, le prime email possono finire nello spam: segnale come "non spam".

## Avvisi su Telegram (facoltativo, ~5 minuti)

1. Su Telegram apri **@BotFather**, scrivi `/newbot`, scegli un nome (es. "Promemoria di famiglia") e un nome
   utente che finisca in `bot` (es. `nomesmentego_carlo_bot`). BotFather ti risponde con un **token**
   del tipo `123456:ABC-...`: è la chiave del bot, non condividerla.
2. Su GitHub aggiungi il segreto `TELEGRAM_BOT_TOKEN` con quel token (come al punto 4 sopra).
3. Rilancia il workflow (*Actions › Test e pubblicazione › Run workflow*). Il passo **Bot Telegram** carica il token
   su Cloudflare, registra il webhook e i comandi del bot; nel riepilogo compare il nome del bot.
4. Nell'app, scheda **Telefono e condivisione › Avvisi su Telegram**: **Collega la mia chat Telegram** apre il bot,
   tocca **Avvia** e torna nell'app. Per un gruppo: **Collega un gruppo Telegram** e scegli il gruppo.

Come funziona: ogni 5 minuti un *Cron Trigger* del Worker calcola gli avvisi scattati dall'ultimo giro (nell'ora
locale della bacheca) e li manda alle chat collegate. Lo stesso giro manda le notifiche dell'app e le email. Il tasto **Fatto** compare solo nelle chat collegate da chi
ha il link di modifica. Se una chat blocca il bot o lo toglie dal gruppo, viene scollegata da sola.
Comandi del bot: `/oggi` (cosa c'è oggi) e `/stop` (smetti di ricevere).

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
  giro.js              parti comuni dei canali: quali avvisi mandare a chi dall'ultimo giro
  telegram.js          bot Telegram: collegamento delle chat, comandi, tasto "Fatto", invio periodico
  push.js              notifiche dell'app: cifratura RFC 8291, firma VAPID, abbonamenti
  email.js             email: Brevo/Resend, conferma e disiscrizione, modello del messaggio
web/sw.js            service worker: riceve le notifiche e apre la bacheca
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
| `GET` | `/api/b/<token>/telegram` | stato del bot e chat collegate (solo chi può modificare) |
| `POST` | `/api/b/<token>/telegram/collega` | codice usa-e-getta (vale un'ora) → link `t.me/<bot>?start=…` |
| `PUT`/`DELETE` | `/api/b/<token>/telegram/<chat>` | gruppi ricevuti dalla chat (`{filtro}`), oppure scollega |
| `POST` | `/api/b/<token>/telegram/prova` | messaggio di prova a tutte le chat |
| `GET` | `/api/b/<token>/push/chiave` | chiave pubblica VAPID (creata al primo uso) |
| `POST` | `/api/b/<token>/push[/mio\|/via\|/prova]` | abbona questo telefono (`{abbonamento, nome}`), controlla, toglie, prova |
| `GET`/`PUT`/`DELETE` | `/api/b/<token>/push[/<id>]` | telefoni abbonati e loro filtro (solo chi può modificare) |
| `GET`/`POST` | `/api/b/<token>/email` | destinatari e modello; aggiungi un indirizzo (manda la conferma) |
| `PUT` | `/api/b/<token>/email/modello` | oggetto e testo (`{oggetto, corpo}` con i segnaposto) |
| `POST` | `/api/b/<token>/email/anteprima\|prova` | anteprima con dati d'esempio; email di prova agli indirizzi confermati |
| `GET`/`POST` | `/email/conferma/<token>`, `/email/stop/<token>` | pagine per confermare o disiscriversi (serve il pulsante) |
| `POST` | `/telegram/webhook` | aggiornamenti da Telegram (verificati con il segreto derivato dal token) |

Il link di modifica è salvato nel database solo come impronta SHA-256. Il server normalizza ogni bacheca
con lo stesso codice dell'app (`web/core/modello.js`), quindi non accetta dati malformati.

## Prossimi passi

Idee: tasto "Fatto" anche nelle notifiche dell'app e nelle email, riepilogo settimanale via email,
calendari comunali della raccolta rifiuti già pronti.
