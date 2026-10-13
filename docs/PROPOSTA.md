# Nomesmentego — proposta di struttura

> "No me se desmentego": un posto unico per **tutti i promemoria periodici** di famiglia e amici,
> dalla spazzatura porta a porta al bollo dell'auto, configurabile da chiunque senza toccare file.

> **Stato (ottobre 2026)** — Fase 1 e Fase 2 realizzate (vedi il [README](../README.md)), con queste scelte:
> bacheche con **link segreto** su **Cloudflare Workers + D1**; app solo **da browser**, uguale su Android e iPhone
> (si aggiunge alla schermata Home); avvisi tramite **calendario in abbonamento**. Rispetto alla bozza sotto,
> "categorie" e "oggetti" sono diventati un unico concetto, i **gruppi** (es. "Passat", "Casa"), e la regola di
> ripetizione delle scadenze ha `da: fatto | scadenza`. Prossimo passo: **email e Telegram** (fase 3).

Punto di partenza: il prototipo [`prototipo/raccolta-rifiuti`](../prototipo/raccolta-rifiuti) (single-file HTML,
offline, `localStorage`, rotazione su N settimane, eccezioni, foglio A4, export `.ics`, backup YAML).
Il foglio *Promemoria Documenti Familiari* aggiunge l'idea di **scadenza + preavviso**.

---

## 1. L'idea in una riga

Ogni promemoria è fatto di tre pezzi indipendenti:

```
  COSA                  QUANDO                       COME / QUANTO PRIMA
  ───────────────       ─────────────────────        ──────────────────────────
  🗑️ Umido              ogni lun e ven, sett. A/B    la sera prima alle 20:30
  🛒 Mercato in piazza   ogni martedì                 "non parcheggiare in piazza" lun 19:00
  🚗 Revisione auto      scadenza 15/03, ogni 2 anni   30 gg prima, 7 gg prima, il giorno
  💊 Pastiglia nonna     ogni giorno                  08:00
```

Il prototipo ha già tutti e tre i pezzi, ma fusi insieme e specifici per i rifiuti
(`rifiuti` = cosa, `settimane` = quando, `esponiSeraPrima` + `promemoria.ora` = avviso).
Separandoli si ottiene la flessibilità che cerchi senza complicare l'interfaccia.

## 2. Modello dati generale

```yaml
versione: 2
bacheca:                       # una "bacheca" = l'insieme di promemoria di una persona o famiglia
  nome: Casa di mamma
  fusoOrario: Europe/Rome

categorie:                     # solo per colori, icone e filtri
  - { id: rifiuti, nome: Rifiuti, icona: "🗑️", colore: "#3e7d3a" }
  - { id: auto,    nome: Auto,    icona: "🚗", colore: "#22579a" }
  - { id: paese,   nome: Paese,   icona: "🛒", colore: "#f2c230" }

promemoria:
  # 1) Schema a rotazione su N settimane (il caso rifiuti, generalizzato)
  - id: raccolta
    titolo: Raccolta porta a porta
    categoria: rifiuti
    quando:
      tipo: rotazione
      inizio: "2026-01-12"          # lunedì della settimana 1
      settimane:
        - { nome: A, giorni: { lun: [umido], mer: [secco], ven: [umido, plastica] } }
        - { nome: B, giorni: { lun: [umido], ven: [umido], sab: [carta] } }
    voci:                            # sotto-voci opzionali (i tipi di rifiuto)
      - { id: umido, nome: Umido, colore: "#6b3f1f" }
      - { id: secco, nome: Secco, colore: "#4d5257" }
    avvisi:
      - { quando: giorno-prima, ora: "20:30", testo: "Metti fuori: {voci}" }
    eccezioni:
      - { data: "2027-01-01", azione: sposta, nuovaData: "2026-12-31" }

  # 2) Settimanale semplice con avviso "spostato"
  - id: mercato
    titolo: Mercato in piazza
    categoria: paese
    quando: { tipo: settimanale, giorni: [mar] }
    avvisi:
      - { quando: giorno-prima, ora: "19:00", testo: "Non parcheggiare in piazza stasera" }

  # 3) Scadenza ricorrente con preavvisi (il caso del foglio Google)
  - id: revisione-panda
    titolo: Revisione Panda (AB123CD)
    categoria: auto
    quando: { tipo: scadenza, data: "2027-03-15", ripeti: { ogni: 2, unita: anni } }
    avvisi:
      - { prima: 30, unita: giorni, ora: "09:00" }
      - { prima: 7,  unita: giorni, ora: "09:00" }
      - { prima: 0,  unita: giorni, ora: "08:00" }
    fatto: []                        # "Fatto ✔" sposta la scadenza al ciclo successivo
```

### Tipi di "quando" (moduli di ricorrenza)

| Tipo | Esempi | Note |
|---|---|---|
| `una-volta` | visita medica il 4/11 | |
| `giornaliero` | medicina ogni giorno / ogni 2 giorni | |
| `settimanale` | mercato ogni martedì | è una `rotazione` con 1 settimana |
| `rotazione` | rifiuti A/B, turni su 3 settimane | il motore del prototipo, già pronto |
| `mensile` | il 1° del mese, il primo lunedì del mese | |
| `annuale` | compleanni, bollo auto | |
| `scadenza` | revisione, assicurazione, carta d'identità | data + "ripeti ogni N mesi/anni" + pulsante **Fatto** |

Tutti condividono le stesse **eccezioni** (annulla / sposta / aggiungi) e gli stessi **avvisi**
(offset in giorni prima + ora, oppure "il giorno prima alla sera").

### Cosa insegna il foglio *Promemoria Documenti Familiari*

Il foglio gestisce **2 auto × 5 scadenze** (revisione, bollo, assicurazione, tagliando, gomme). Per ogni
scadenza ci sono data di esecuzione, data di scadenza e un preavviso unico di 20 giorni. Un secondo foglio
dice **chi** riceve la mail per ogni voce: tutte le voci dell'auto condivisa vanno a 3 persone, quelle
dell'altra auto a una sola. La mail parte una volta sola, alla data di preavviso.

| Nel foglio | Nella nuova app |
|---|---|
| colonne PUMA / PASSAT | **oggetti**: un'auto (ma anche una casa, una persona, un animale) con i suoi promemoria raggruppati |
| riga "Validità" (testo libero) | **regola di ripetizione** del modello: `ogni 1 anno`, `ogni 2 anni`, `prima volta dopo 4 anni, poi ogni 2` |
| Data Esecuzione / Data Scadenza | `ultimaVolta` + `scadenza`, la scadenza **proposta** dalla regola ma sempre modificabile (il bollo non segue la data di pagamento) |
| N° gg di primo preavviso = 20, uguale per tutto | preavvisi **multipli e per voce** (es. 20 gg, 7 gg, il giorno), con un valore predefinito per bacheca |
| foglio "Imposta mail automatiche" (righe mail × voce) | **destinatari** sull'oggetto ("Passat: Carlo + 2 persone") ereditati dalle sue voci, eccezioni per singola voce |
| istruzioni 2 e 3 (riscrivere le date, cancellare "Inviata il") | un pulsante **Fatto ✔**: segna l'esecuzione, calcola la nuova scadenza, riarma gli avvisi. Lo stato "inviato" lo gestisce l'app |
| note "chiedere stato gomme", "estive/invernali", "4 stagioni" | note per voce e **modelli** più furbi (sotto) |

Questo porta tre aggiunte al modello:

```yaml
oggetti:
  - id: passat
    nome: Passat
    icona: "🚙"
    destinatari: [carlo, persona2, persona3]   # chi riceve gli avvisi delle sue voci

promemoria:
  - id: revisione-passat
    oggetto: passat                            # eredita icona, colore e destinatari
    titolo: Revisione
    quando:
      tipo: scadenza
      scadenza: "2027-11-30"
      ultimaVolta: "2026-01-02"
      ripeti: { ogni: 2, unita: anni, arrotonda: fine-mese }
    avvisi: [{ prima: 20, unita: giorni }, { prima: 0, unita: giorni }]
    insisti: true                              # se scade e non è "Fatto", ricorda ogni 3 giorni
```

Idee per il **modello "Auto"** nate dal foglio (chiede solo targa, data di immatricolazione e chi avvisare):
- **Revisione**: prima a 4 anni dall'immatricolazione, poi ogni 2, entro la fine del mese → calcolata da sola.
- **Bollo** e **assicurazione**: ogni anno, ricordando che la data va confermata (si propone, non si impone).
- **Tagliando**: "2 anni **oppure** 25.000 km". L'app non conosce i km, quindi avvisa a tempo e, se vuoi,
  chiede una volta l'anno "quanti km ha la Passat?" per stimare la data in anticipo.
- **Gomme**: per le estive/invernali il modello conosce già le finestre di legge (invernali dal 15/11 al 15/04,
  cambio tollerato un mese prima/dopo) e crea da solo i due avvisi stagionali; per le 4 stagioni
  ricorda la rotazione ogni 10.000 km / 1 anno e il cambio a 40.000 km.

Con l'app il foglio non serve più: il suo contenuto è già ricopiato in
[`esempi/auto-famiglia.yaml`](esempi/auto-famiglia.yaml) (con gli indirizzi email sostituiti da segnaposto),
e la fase 1 può includere un **import da Excel/Google Sheets** per chi ha fogli simili.

## 3. Architettura modulare

Sì, una struttura modulare è la scelta giusta: ogni tipo di ricorrenza e ogni canale di notifica è un
"plug-in" con la stessa interfaccia, così aggiungerne uno non tocca il resto.

```
src/
  core/
    date.js            utilità date (dal prototipo: iso, addDays, mondayOf, ...)
    motore.js          promemoria + intervallo → lista di occorrenze → lista di avvisi
    modello.js         normalize/migrate (v1 raccolta-rifiuti → v2)
  ricorrenze/          un file per tipo, stessa interfaccia:
    rotazione.js         { tipo, etichetta, icona, predefiniti(), occorrenze(r, da, a),
    settimanale.js         descrivi(r) → "ogni martedì", editor(r) → UI }
    mensile.js
    scadenza.js
    ...
  modelli/             "ricette" pronte: Raccolta rifiuti, Auto, Documenti, Medicine, Mercato
  canali/              come arrivano gli avvisi
    ics.js               file .ics (c'è già) e feed calendario in abbonamento
    push.js              notifiche Web Push (PWA)
    email.js, telegram.js
  archivio/            dove stanno i dati
    locale.js            localStorage (c'è già)
    link.js              configurazione dentro un link/QR
    cloud.js             sincronizzazione con il backend (fase 2)
  ui/
    oggi.js            "Oggi / Domani / Prossimi 7 giorni"
    procedura.js       creazione guidata in 3 passi
    schema.js          vista "schema su N settimane" + foglio A4 stampabile
test/
  motore.test.js       node --test: è la parte che non deve mai sbagliare
```

Il **motore** è puro (niente DOM, niente rete): lo stesso codice gira nel browser, nel backend che manda
le notifiche e nei test. Il prototipo ha già questa logica (`weekIndex`, `collectionsOn`, `upcoming`):
va solo estratta e generalizzata.

Tecnologia: resterei su **JavaScript senza framework + moduli ES + esbuild** (un'unica dipendenza di
sviluppo), così il risultato resta un sito statico leggero, pubblicabile gratis su GitHub Pages e
installabile come **PWA** (icona sulla schermata Home, funziona offline).

## 4. Interfaccia "a prova di mamma"

- **Home = "Oggi e domani"**: grandi card colorate, una frase sola ("Stasera metti fuori: Umido, Plastica").
  Sotto, i prossimi 7 giorni e le scadenze in arrivo ("Revisione Panda tra 23 giorni").
- **Aggiungi in 3 passi**, sempre con pulsanti grandi e mai campi tecnici:
  1. *Cosa vuoi ricordare?* → card: 🗑️ Spazzatura · 🚗 Auto · 🛒 Mercato · 💊 Medicine · 📄 Documenti · ✏️ Altro
  2. *Quando succede?* → "Ogni settimana il…" · "A settimane alterne" · "Ogni mese" · "Una scadenza" · "Una volta"
  3. *Quando vuoi l'avviso?* → "La sera prima alle 20" · "La mattina stessa" · "1 mese e 1 settimana prima"
  - In fondo una frase di conferma in italiano: **"Ti avviso ogni lunedì alle 19:00: Non parcheggiare in piazza stasera."**
- **Modelli pronti**: "Auto" crea in un colpo bollo, assicurazione, revisione e tagliando chiedendo solo le date;
  "Raccolta rifiuti" parte dal prototipo (e in futuro da calendari comunali già pronti da scegliere in un elenco).
- **Vista schema su N settimane** e **foglio A4** (dal prototipo) per chi vuole solo il promemoria sul frigo.
- **Fatto ✔** sulle scadenze: un tocco e la prossima scadenza si calcola da sola.
- Niente parole come YAML, import, export: al loro posto "Manda a…", "Copia di sicurezza", "Ripristina".

## 5. Come arrivano gli avvisi sul telefono

| Soluzione | Per l'utente | Costo / complessità | Note |
|---|---|---|---|
| **A. Calendario in abbonamento** (feed `webcal://`) | un tocco "Aggiungi al mio calendario", poi notifiche native di Google/Apple Calendar | serve un URL sempre aggiornato (backend minimo) | ⭐ consigliata: funziona su Android e iPhone, nessuna app nuova, le modifiche arrivano da sole |
| B. File `.ics` da scaricare | va reimportato quando cambia qualcosa | zero (c'è già) | buona come fase 1 / ripiego |
| C. Notifiche push dell'app (PWA) | "Consenti notifiche" | backend con orologio (cron) + chiavi VAPID | su iPhone solo se l'app è aggiunta alla Home (iOS ≥ 16.4) |
| D. Email | nessuna azione | backend con cron (o Google Apps Script) | quello che usi oggi; ottima come riepilogo settimanale |
| E. Telegram (bot) o app *ntfy* | avvia il bot una volta | molto semplice lato server | utile per gruppi famiglia; WhatsApp è sconsigliato (API a pagamento e burocratiche) |
| F. Scrittura diretta su Google Calendar | login Google | OAuth, verifica app | potente ma più fragile; il feed (A) dà quasi lo stesso risultato |

Raccomandazione: **A come canale principale**, **D/E come extra** per chi li vuole, **C** quando l'app è matura.
Sono tutti "canali" dello stesso motore: si sceglie per ogni promemoria o per tutta la bacheca.

## 6. Dove tenere i dati senza Excel né file

| Opzione | Esperienza | Pro | Contro |
|---|---|---|---|
| 1. Solo nel telefono (`localStorage`) + **link/QR da condividere** | tu configuri, le mandi un link su WhatsApp, lei lo apre e ha tutto | zero server, zero costi, privacy totale | se cambi qualcosa devi rimandare il link; niente notifiche automatiche né feed |
| 2. **"Bacheca" con link segreto** su un backend minimo (es. Cloudflare Workers + D1/KV, piano gratuito) | come Google Docs "chiunque abbia il link": nessun account, nessuna password; il link si salva sulla Home | sincronizza tra telefoni (puoi modificare i promemoria di mamma da casa tua), fornisce il feed calendario e le notifiche | un piccolo servizio da mantenere; il link va trattato come una chiave |
| 3. **Google Sheets come database** via Google Apps Script | invisibile per l'utente; per te il foglio resta consultabile | gratis, sfrutta quello che hai già fatto, email e feed ICS da Apps Script | quote e lentezza di Apps Script, legato al tuo account Google |
| 4. Firebase / Supabase con login Google | "Accedi con Google" | utenti veri, permessi, push FCM | più complesso; il login è già un ostacolo per alcuni |

Raccomandazione: **1 subito, 2 come obiettivo**. La bacheca con link segreto è il miglior compromesso:
per tua mamma è "apri questa icona", per te è un unico servizio gratuito che regge sync, feed calendario,
email e push. Con l'opzione 2 aggiungerei anche:
- **più bacheche per persona** (la mia, quella di mamma, quella condivisa di famiglia);
- link **"solo lettura"** distinto dal link **"può modificare"**;
- copia di sicurezza automatica lato server (niente file da custodire).

L'opzione 3 ha senso se preferisci restare tutto nell'ecosistema Google: in quel caso il tuo foglio
*Promemoria Documenti Familiari* diventerebbe il backend e la web app l'interfaccia.

## 7. Piano a fasi

1. **Fase 1 — Generalizzare il prototipo (solo frontend, zero server)**
   - estrarre il motore in `core/` con test; modello v2 con migrazione automatica dal YAML v1;
   - tipi `settimanale`, `rotazione`, `mensile`, `scadenza`, `una-volta`; avvisi con preavviso;
   - procedura guidata in 3 passi, home "Oggi/Domani", modelli pronti (Rifiuti, Auto, Mercato);
   - PWA installabile, export `.ics`, condivisione via link/QR, foglio A4.
2. **Fase 2 — Bacheca condivisa e calendario in abbonamento**
   - backend minimo (Cloudflare Worker) con bacheche a link segreto;
   - feed `webcal://` per bacheca → notifiche native sul telefono.
3. **Fase 3 — Avvisi attivi**
   - cron sul backend: email/riepilogo settimanale, Telegram/ntfy, Web Push.
4. **Poi**: calendari comunali dei rifiuti già pronti, promemoria condivisi tra più persone
   ("chi porta fuori il secco questa settimana?"), storico dei "Fatto".

## 8. Decisioni da prendere

- Backend della fase 2: **Cloudflare (link segreto)** oppure **Google Apps Script + Sheets**?
- Telefoni in famiglia: più Android o iPhone? (cambia la priorità di push vs calendario)
- Canale preferito dopo il calendario: email, Telegram o notifiche dell'app?
