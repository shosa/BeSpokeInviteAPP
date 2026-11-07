# Stato del lavoro — InviteMe

Aggiornato a ogni checkpoint. Leggerlo prima di toccare il codice.

## Fatto e verificato

- **Modello a blocchi** (`shared/src/blocks.ts`): 14 tipi di blocco con proprietà, funzioni richieste e valori di partenza.
- **Configurazione dell'invito** (`shared/src/invitation.ts`): dati dell'evento, lista di blocchi, domande di conferma. Validazione: tipi noti, funzioni acquistate, blocchi unici, massimo 30.
- **Manifest degli stili** (`shared/src/engine/manifest.ts`): nome, colore, font, esempi per blocco; validazione di URL e percorsi.
- **Template dei blocchi** (`engine/blocks/*.html`): un file per tipo, con il markup del riferimento.
- **Renderer** (`api/src/engine/page.ts`, `api/src/engine/themes.ts`): compone la pagina dai blocchi visibili, applica lo stile, valida gli stili con una demo di prova.
- **Stile di riferimento** `themes/invitereference`: CSS, asset originali, esempi per blocco. Validatore OK.
- **Test**: `shared` 18/18, `api` 10/10, typecheck di shared e API OK.
- **Documentazione per agenti**: `docs/MOTORE.md` e `docs/TEMI.md`.

## Planner premium: cartella, stampa e tavoli (fatto nel giro attuale)

- **Cartella:** 34 sezioni in 9 gruppi (catalogo in `shared/src/folder.ts`), con righe tipizzate: programmi con orari, contatti, checklist con spunte, testo libero. Ricerca, «Utile adesso», conteggi per sezione. Fornitori letti dalla scheda Fornitori.
- **Stampa:** documento vero (copertina, indice, una pagina per sezione, piano dei tavoli), non la sola pagina a schermo. Si attiva con «Crea PDF».
- **Organizza tavoli:** tabella `planner_tables`, invitati con `table_id`. La capienza è controllata dal server (non si supera, né si riduce un tavolo sotto i posti occupati).
- **Dati primari:** il modale obbligatorio chiede nomi, data e luogo alla prima apertura di builder o planner.
- **Verificato nel browser:** cartella (salvataggio e contatore), tavoli (creazione e assegnazione), setup.
- **Ancora da fare rispetto al riferimento:** esempi già scritti nelle sezioni, schede Riepilogo e Attività con categorie e dettagli del riferimento, checklist con i loro gruppi (valigie, decorazioni), ringraziamenti con conteggio, dettaglio di ogni fornitore nella stampa. Il testo e la grafica restano nostri.

## Planner premium (completato con limiti)

- **Livelli:** `save_the_date`, `rsvp`, `premium` (colonna `tier`). Il planner si apre solo con `premium` (API risponde 403 altrove).
- **Dati:** tabelle `planner_guests`, `planner_budget_items`, `planner_tasks`, `planner_vendors`; budget totale, quota di persone e cartella (19 sezioni) in `invitations.planner`.
- **Interfaccia:** `/planner/[id]` mostra il planner premium (Riepilogo, Budget, Invitati, Attività, Fornitori, Cartella) o il pannello base. Crea PDF con la stampa del browser.
- **Meteo:** Open-Meteo per il giorno dell'evento, solo entro circa 16 giorni; la sede si cerca dall'indirizzo.
- **Acquisto:** il checkout accetta il livello; il premium usa `SHOPIFY_VARIANT_PREMIUM_ID` se configurata.
- **Verificato:** test di validazione 6/6, pacchetto condiviso 61/61, flusso nel browser (invitati, attività standard, budget, riepilogo).
- **Limiti da chiudere:** la quota è unica per l'invito (non per gruppo); gli invitati del planner non sono collegati alle risposte RSVP (che non identificano l'ospite); il prezzo premium va confermato sulla variante Shopify; 14 test di tema di `engine.test.ts` falliscono dal pull che ha rimosso quei temi.
## Conversione in Bespoke Invites (in corso)

- **Perimetro:** planner (`/planner/[id]`), profilo con gli inviti (`/account`), builder (`/editor/[id]`), link pubblici (`/i/[slug]`). Niente home, landing, legal, checkout interno, registrazione o login con password. `/` rimanda al profilo.
- **Accesso:** con il link personale `/accesso/[token]`: l'API verifica il token (salvato solo come hash in `access_tokens`, scadenza 365 giorni, revocabile) e apre la sessione. Il link lo crea `npm run access-token -w @inviteme/api -- <email> <nome>`. In seguito lo crea il webhook Shopify (fase 2 del piano).
- **Google:** rimosso (route, modulo e variabili).
- **Modalità demo:** con `DEMO_MODE=true` e senza Shopify il profilo mostra «Crea un invito di prova»: `POST /api/demo/invitations` crea (se manca) un utente demo e un invito pagato di prova. Con Shopify configurato la demo è sempre spenta.
- **Da decidere:** la console admin e i checkout API (`/api/checkout*`) restano finché la fase 1 del piano Shopify non li sostituisce.
- **Verifica:** test API 65/65, typecheck di API e web. Nessun deploy: il cambio di accesso è da confermare prima, perché gli account con password non entrano più.
## Builder con il sistema «Bespoke Invites» (in corso)

- **Stile**: le regole del builder stanno in `web/components/builder/builder.css`, tutte sotto `.bl-app`. Le regole di builder erano in `web/app/globals.css` e sono state spostate; restano lì solo `.bl-icon` (usata dalla console admin) e gli stili condivisi.
- **Palette e font**: crema, avorio e sabbia; oro metallico per i pulsanti principali; Fraunces per i titoli (caricato in `web/app/editor/layout.tsx`) e Jost per il testo.
- **Verificato**: typecheck del web e parsing del CSS. **Non ancora verificato nel browser**: serve un deploy o un'anteprima con un account.
- **Non toccato**: la home e le pagine pubbliche (da rimuovere, decisione da prendere); la logica del builder.

## Aggiornamenti dell'ultimo ciclo

- **Renderer a blocchi** verificato: 19/19 controlli di smoke test contro un Postgres reale (ephemeral), test API e shared verdi, validatore OK su 4 stili.
- **Builder nuovo** (web): palette dei blocchi, lista trascinabile con tastiera, pannello proprietà, annulla/ripristina con Ctrl+Z, anteprima desktop e telefono, interruttore «Mostra la busta». Verificato nel browser: nessun errore JavaScript, riordino corretto, footer sul telefono a tutta larghezza.
- **Dashboard cliente** (`/account`): panoramica (inviti, visite, risposte, ospiti) e cartelle per ogni invito con azioni rapide. Compila; non ancora verificata con dati reali nel browser.
- **Modalità demo**: `DEMO_MODE=true` attiva l'acquisto di prova solo senza Shopify. Con Shopify configurato la demo è sempre spenta.
- **Stili**: `invitereference`, `notte`, `salvia`, `carta`. Notte ha le sovrascritture per il fondo scuro. Gli ultimi tre condividono gli asset di invitereference tramite link: vedi `docs/PROMPT-ILLUSTRAZIONI.md`.
- **Documentazione**: `docs/MOTORE.md`, `docs/TEMI.md` (per agenti), `docs/PROMPT-ILLUSTRAZIONI.md`.
- **Blocco musica** (funzione `music`): aggiunto, con template e pulsante di controllo.
- **Test finali**: `shared` 18/18, `api` 10/10, validatore su 4 stili, typecheck di API e web, build di produzione del web.

## Da fare, in ordine

3. **Blocco musica** (funzione `music`): oggi non esiste come blocco; va aggiunto come tipo con proprietà audio.
4. **Dashboard del cliente**: inviti, ospiti, risposte, statistiche, pagamenti.
5. **Demo Shopify** (`DEMO_MODE`): acquisto che va a buon fine solo se la variabile è attiva e Shopify non è configurato.
6. **Layout originali** e relativi prompt per generare le illustrazioni in ChatGPT.
7. **Admin**: attivazione degli stili, catalogo, ordini, utenti.
8. **Pulizia**: cartella `themes/invitereference/assets` senza file inutilizzati; scratchpad e `/tmp/claude-0` della sessione a fine lavoro.

## Decisioni prese

- Il prodotto non riparte dai modelli e temi precedenti: un invito è una lista di blocchi, lo stile è solo aspetto.
- Il riferimento di design è la struttura delle funzioni di DigitalYes e webgencyinvitations; design, testi, immagini e marchi sono originali.
- Stili vecchi (`carta`) rimossi: non compatibili con il nuovo modello.
- Dati di prova svuotati; nessun invito reale da conservare.

## Verifiche del giro

- Domande predefinite della conferma in inglese per gli inviti con lingua inglese (`DEFAULT_RSVP_EN`, `defaultRsvp(locale)`). Test shared 18/18, api 12/12, typecheck api e web.

- Prestazioni home mobile (live): prima 691 richieste e 55 MB con 60 iframe caricati subito; ora 129 richieste e 325 KB all'apertura. Le anteprime si caricano per la scelta, le vicine e quelle che entrano nel carosello.
- Anteprime del carosello: il grigio è lo stato di caricamento. Dopo qualche secondo la pagina demo si dipinge (verificato con screenshot sul carosello; risposta del server ~25 ms). Resta da confermare su un telefono reale.

- Suite: shared 18/18, api 12/12, smoke 21/21 su stack locale con Postgres di prova.
- Builder nel browser con account di prova: nessun errore JS in IT e EN; etichette di blocchi, campi evento e nomi dei template tradotte in inglese.
- Da fare: i testi d'esempio dell'invito restano nella lingua con cui è stato creato (sono contenuto dell'utente).

## Ultimo rilascio (ultimo giro)

- Rilascio sui container live del giro corrente: API, web e database risposti 200, demo e versione inglese verificate.

## Ultimo rilascio

- Container `inviteme-web-1` e `inviteme-api-1` aggiornati dalla cartella del progetto; database invariato (vuoto), colonna `planner` aggiunta.
- Verificati dopo il rilascio: salute API, pagine demo di quattro stili (Arco, Rivista, Minimo, Giardino), `demo.shosa.me` 200.
- Test: smoke 21/21, shared 18/18, api 10/10, validatore su 4 stili, typecheck API e web.

## Pannello di gestione (planner)

- `/planner/<id>`: indicatori (invitati, risposte, presenti, persone), conto alla rovescia con nota dell'organizzatore, note organizzative, tabella delle risposte con esportazione CSV, lista ospiti.
- Accessibile dal proprio spazio per gli inviti pagati.

## Template (ultimo ciclo)

- **Venti template** in `themes/`, ciascuno con evento, testi, foto, palette e font propri. Eventi: matrimoni (Arco, Velo, Rivista, Giardino, Lavanda, lago, città), battesimi (battesimo celeste, prima comunione), anniversari (oro, argento), compleanni (festa), cene e gala aziendali, lauree, pensionamento, baby shower, festa in spiaggia, cena d'autunno.
- Composizioni: sei famiglie strutturali (Arco, Rivista, Minimo, Giardino, Velo, Notturno) con palette e font diversi per ogni template. Le composizioni nuove vanno ancora aggiunte.
- Foto da Pixabay, senza persone riconoscibili; crediti in `docs/CREDITI-IMMAGINI.md`.

## Non ancora fatto

- **Rilascio sui container live**: il sito di produzione gira ancora la versione precedente. Va rilasciato solo con il tuo ok.
- **Admin**: la console è quella precedente, da adattare ai nuovi stili e blocchi.
- **Pagamento reale Shopify**: serve la configurazione con le chiavi del tuo store.
- **Localizzazione inglese** (parziale): le etichette di sistema dei blocchi (busta, data, conto alla rovescia, conferma, firma) sono in `api/src/engine/i18n.ts` e seguono la lingua dell'invito. Test dedicato in `api/test/engine.test.ts`.
- Fatto anche: testi di partenza dei blocchi, messaggi del modulo RSVP, etichette nei template degli stili.
- **Sito (parziale)**: selettore IT/EN nella barra (cookie `lang`), navigazione, primo schermo e piè di pagina della home, `lang` del documento. Verificato con curl su entrambe le lingue.
- Dashboard cliente tradotta e verificata nelle due lingue con i servizi veri.
- Pannello di gestione tradotto (IT/EN).
- Builder tradotto interamente (barra, palette, proprietà, domande, pannello ospiti): IT/EN dal dizionario `lib/ui.ts`, verificato con typecheck e build; da verificare nel browser con un account.
- Accesso, reset, checkout di prova, home (sezioni, FAQ, modelli con testi inglesi in `lib/catalogCopy.ts`) tradotti IT/EN e verificati sul server live con cookie lang.
- Console admin: scheda «Template» (prima «Temi») con anteprima per ciascun template e attivazione. La console resta in italiano, ad uso interno.
- Pagine legali bilingui: IT e EN sono bozze marcate DRAFT, da far rivedere a un professionista.
- Composizioni nuove (testata e sezione data proprie, verificate sul server live con screenshot mobile): «Cornice» (lavanda-nozze), «Cartolina» (prima-comunione), «Menu» (argento-anniversario). Aggiunte quattro: «Finestra» (matrimonio-lago), «Pagina» (matrimonio-citta), «Medaglione» (battesimo-celeste), «Fiocchi» (baby-shower), tutte verificate sul server live. Aggiunte anche «Sipario» (notturno) e «Diploma» (laurea-giulia), verificate sul server live. Aggiunte anche «Confetti» (compleanno-festa), «Lettera» (gala-aziendale), «Diario» (pensionamento), «Onda» (festa-spiaggia), verificate sul server live. Aggiunte anche «Medaglia» (anniversario-oro), «Serra» (giardino), «Velo» (velo), «Tovaglia» (autunno-cena), «Riga» (minimo), «Copertina» (rivista), verificate sul server live. invitereference resta sulla composizione «Arco» originale. Da rifinire: la data di «Velo» su telefono reale.
- Da fare, senza domande: admin adeguata a template e blocchi, testi legali come bozza marcata DRAFT, composizioni nuove.
- Riservato a Stefano: Shopify (pagamento reale) e email vere (Resend).
- **Composizioni**: solo sei famiglie strutturali; le altre varianti cambiano palette, font, testi e foto.
- **Prestazioni**: la scheda modelli e il builder caricano venti anteprime complete: va verificata la velocità su telefono.
- **Dashboard**: panoramica e schede verificate in layout, ma non con dati reali di ospiti e risposte.

## Aperto, serve una tua decisione

- **Shopify e Resend**: le chiavi vanno in `.env` in produzione. Finché mancano, valgono solo la demo e l'invio email disattivato.
- **Materiale personale negli asset**: `invitereference` usa foto e audio della coppia di InviteReference. Va sostituito prima di vendere lo stile a clienti reali.
- **Rilascio sui container live**: non fatto. Richiede il tuo ok esplicito.

## Ultime modifiche (builder, motore, stili)

- **Sfondi animati**: confetti, bolle, petali, scintille, onde, neve. Il cliente li sceglie nel pannello generale (con colore facoltativo); lo stile può proporne uno nel `theme.json` (chiave `background`). Canvas dietro i contenuti, fermo fuori schermo e con «riduci movimento». Adattati cinque stili: compleanno-festa, festa-spiaggia, lavanda-nozze, battesimo-celeste, notturno. Verificati nel browser: tutti e sei i tipi si muovono senza errori.
- **Font per campo** con il pulsante «Aa» dentro il campo; libreria di 15 font Google (OFL).
- **Pixabay**: ricerca con i filtri dell'API (tipo, orientamento, colore incluso «sfondo trasparente», categoria, ordine, dimensione minima, scelta della redazione). Chiave dall'ambiente (`PIXABAY_API_KEY`).
- **Dress code**: lista di colori con pallino e nome visibile, nel template di default.
- **Selettori di colore** a pallino, senza padding.
- **Layout libero tolto**: i blocchi tornano in colonna.
- **Documentazione per la generazione di stili**: `docs/MOTORE.md` (motore, registro dei blocchi, sfondi, font) e `docs/TEMI.md` (contratto per chi scrive uno stile, classi, validazione, richiesta modello).
- Da verificare: deploy (non fatto, serve il tuo ok), sfondi animati su telefono reale, ricerca Pixabay con la chiave nel container.

## Assistente del builder — Fase 1 (motore e validatore, senza interfaccia)

Stato: **fase 1 e fase 2 complete, deployate il 2026-10-23 dal working tree di `ui-atelier` (non committate).**

- **Validatore** (`shared/src/assistant/actions.ts`): sei strumenti (`setEvent`, `setBlockProp`, `addBlock`, `removeBlock`, `moveBlock`, `setTheme`), validati in sequenza su una copia della configurazione. Testi oltre il massimo si tagliano; file ed elenchi non si cambiano dall'assistente; funzioni non attive, blocchi unici, limite di blocchi, blocchi obbligatori e fissi, tema a invito pagato: rifiutati con il motivo. 17 test.
- **Regole dell'invito pagato** estratte in `editRules` (`shared/src/invitation.ts`), usate da `PUT /api/invitations/:id` e dall'assistente.
- **Rotta** `POST /api/invitations/:id/assistant` (`api/src/app.ts`, logica in `api/src/assistant.ts`): 404 a inviti altrui, 503 senza `ANTHROPIC_KEY`, 409 oltre 40 richieste per invito, 400 su messaggio non valido, 502 se il modello non risponde (senza dettagli). Modello `claude-opus-5-5` da `ASSISTANT_MODEL`. Strumenti in schema stretto, prompt di sistema in cache, configurazione nell'ultimo messaggio. Al modello vanno solo testi e impostazioni dell'invito, mai ospiti, risposte, email o ordini. 11 test con modello simulato.
- **Migrazione**: `invitations.assistant_calls` e tabella `assistant_usage` (token e cache per richiesta), in `api/src/db.ts`.
- **SDK**: `@anthropic-ai/sdk` 1.2.0 installato nel solo pacchetto `api`.
- **Verifiche locali**: `shared` 43/43, `api` 55/55, typecheck di api e web puliti.

Cose aperte della fase 1:
- **Prova con chiave reale non fatta**: `ANTHROPIC_KEY` è letta dall'ambiente e passata al container API dal compose; la prova reale resta da fare dopo il deploy.
- **Cache del prompt**: non verificata. Se il prefisso (sistema + strumenti) è sotto la soglia minima del modello, la cache non si attiva in silenzio. Da controllare con `usage.cache_read_input_tokens` alla prima chiamata reale.
- **Schema stretto**: l'SDK lo accetta, ma non è stato provato contro il servizio reale.
- **Elenchi non modificabili**: programma e colori dei blocchi restano fuori dall'assistente. Da decidere prima della fase 2.
- **Contatore di richieste**: si incrementa a risposta riuscita; due richieste simultanee possono superare il tetto di 40 di poco.
- **Nessun commit**: le modifiche sono nel working tree del branch `ui-atelier`.

### Fase 2 — pannello nel builder

- Pannello «Assistente» nella colonna destra, dopo l'anteprima (desktop, 20%), visibile solo se il server ha `ANTHROPIC_KEY` (`manage.assistant`). Chat in `web/components/builder/AssistantPanel.tsx`. Su telefono la colonna è nascosta: l'assistente non c'è.
- Le azioni arrivate dall'API si riconvalidano nel builder (`validateActions`, stessi dati di `manage`) e si applicano con un solo `history.set(..., group)`: Ctrl+Z ritira tutta la risposta.
- Allineati builder e validatore: cambio stile (colori dei blocchi tornano al template), rimozione dell'ultimo blocco di una funzione (la funzione esce dall'invito). Funzioni «già attive» = `purchased_addons`, o `config.addons` per le bozze, come in `manage`.
- Verificato nel browser con il proprio account, risposta simulata lato browser (nessuna chiamata al modello): la scheda c'è, l'azione compare e viene salvata, Ctrl+Z la ritira.

### Console admin — parametri dell'assistente

- Scheda «Assistente» (gruppo Gestione): modello, sforzo (bassa/media/alta), richieste per invito (1–500).
- L'elenco dei modelli è letto dall'API ufficiale di Anthropic (`client.models.list`, solo modelli attivi, in memoria 10 minuti). Il server accetta solo un modello presente in quell'elenco.
- Salvataggio in `settings` (chiave `assistant`). Senza valore salvato: `ASSISTANT_MODEL`, poi il valore di base.
- Verificato: elenco di 13 modelli, rifiuto di un modello inventato (400), menu caricato nel browser.

### Deploy del 2026-10-23

- `api` e `web` ricostruiti e riavviati dal working tree. Migrazione applicata all'avvio (`assistant_calls`, `assistant_usage`). `ANTHROPIC_KEY` presente nel container (solo presenza verificata).
- L'IP del container API è cambiato a `10.0.9.3`: il dev server (`API_INTERNAL_URL`) è stato riavviato su quell'indirizzo. Ad ogni ricreazione del container l'IP può cambiare.

### Cose aperte

- Prova reale con il modello: non fatta (nessuna chiamata a Claude durante i test).
- La riga `assistant` nel database è stata scritta alle 17:48:33 (modello `claude-haiku-5-5`, limite 10): non da questa sessione. Da confermare con Stefano.
- Il pannello e la console non sono stati controllati su telefono.
- File di backup non tracciati nella radice: `docker-compose.yml.bak-2026-10-23`, `.env.example.bak-2026-10-23`.
- Nessun commit: le modifiche sono solo nel working tree di `ui-atelier`.

### Assistente — copertura del builder (2026-10-23, decisioni prese in autonomia)

- **Strumenti**: testi ed eventi (`setEvent`, `setBlockProp`), liste (`setBlockList`: colori dress code, voci programma), domande del modulo (`setRsvpQuestions`, tipi number/text/yes-no/choice), sfondo animato come decorazione (`setBackground`), tipo di evento (`setEventType`), blocchi (`addBlock` con id assegnato dal server, `removeBlock`, `moveBlock`, `setBlockHidden`), colori del blocco (`setBlockLook`), tema (`setTheme`), file (`setBlockMedia`, `searchPhotos` + `usePhoto` per Pixabay, musica dalla libreria).
- **File**: l'assistente usa solo file importati in questa richiesta, tracce della libreria e file già nell'invito. Non può inserire URL liberi.
- **Un solo passo di cronologia** per risposta: Ctrl+Z ritira tutto. Verificato con risposta simulata: quattro modifiche insieme, annullamento allo stato iniziale.
- **Fuori dall'assistente, di proposito**: pagamenti, funzioni a pagamento, lista ospiti e risposte RSVP (dati personali e denaro). Il builder manuale resta come riserva: non è stato rimosso.
- **Massimo giri di strumenti**: 8 per messaggio. Limite di richieste per invito dalla console (`callLimit`).

## Console admin e collegamento Shopify (2026-11-07)
- Console riorganizzata in gruppi: Vendita (Panoramica, Ordini, Clienti), Contenuti (Inviti, Template, Musica, File), Sistema (Shopify, Assistente).
- Panoramica: «Da fare», numeri, percorso del cliente, ultimi ordini.
- Ordini: filtri per stato e fonte, ricerca ed esportazione CSV.
- Scheda Shopify: dominio del negozio e ID delle varianti (base e premium) si salvano dalla console (tabella settings, chiave `shopify`). Token Storefront e segreto del webhook restano nel `.env`: la console ne mostra solo la presenza.
- «Verifica collegamento» interroga Shopify (negozio e varianti) e mostra il risultato. Webhook: `/api/webhooks/shopify`, evento orders/paid.
- Test: `api/test/shopifySettings.test.ts`. Suite API: 62 pass, 14 fail nei test di `engine.test.ts` già noti (temi rimossi).
- PDF del planner: l'accento del tema viene scurito finché il contrasto sul foglio è almeno 4,5:1 (`readableAccent`).
- Non ancora deployato: console e PDF vanno pubblicati con `docker compose build api web` e `up -d --force-recreate api web`.
