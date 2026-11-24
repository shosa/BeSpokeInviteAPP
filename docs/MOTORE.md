# Motore di Bespoke Invites

Un invito è una **lista ordinata di blocchi**. Ogni blocco ha un tipo, delle proprietà e può essere nascosto. Uno **stile** (tema) decide l'aspetto: colori, font, CSS, asset, ed I blocchi decidono cosa c'è nella pagina. Il motore compone la pagina ogni volta, dalla configurazione salvata: non ci sono pagine statiche da aggiornare.

Questo documento descrive il motore così com'è oggi. Per scrivere uno stile (anche con un agente), leggi `docs/TEMI.md`.

## Flusso

```
config (jsonb)  →  sanitizeConfig              tutti i dati ripuliti: nessun campo arriva al renderer non validato
                →  pageGlobals                 dati comuni: evento, data, funzioni, domande, tema, etichette
                →  per ogni blocco visibile:
                     renderTemplate(template, dati globali + proprietà del blocco, { fonts })
                     template = themes/<stile>/blocks/<tipo>.html se esiste, altrimenti engine/blocks/<tipo>.html
                →  pagina HTML                 testata (font, CSS dello stile + CSS dei blocchi), busta, blocchi,
                                               runtime.js
```

## Dove sta il codice

| File | Ruolo |
|---|---|
| `shared/src/blocks.ts` | Registro dei tipi di blocco: nome, proprietà, funzione richiesta, valori di partenza, etichette dei testi del template |
| `shared/src/invitation.ts` | Configurazione dell'invito, `sanitizeConfig`, `sanitizeBlocks`, `defaultConfig` |
| `shared/src/engine/template.ts` | Motore di template: segnaposto, sezioni, filtri `lines` e `url`, font per campo |
| `shared/src/engine/manifest.ts` | Manifest dello stile (`theme.json`): validazione e demo |
| `shared/src/engine/values.ts` | Validazione dei valori (testi, date, colori, liste, URL dei media) |
| `shared/src/fonts.ts` | Libreria dei font per i testi (solo id ammessi) |
| `shared/src/background.ts` | Validazione della chiave `background` dei temi (ignorata: sfondo animato rimosso) |
| `api/src/engine/page.ts` | Compone la pagina: blocchi, CSS, runtime, sfondo, font, builder, busta-video del tema |
| `api/src/engine/themes.ts` | Carica e valida gli stili da `themes/`, sostituzioni di blocco, esempi della demo |
| `engine/runtime.js` | Comportamenti nel browser: busta (anche busta-video), audio, gratta, countdown, video, popup RSVP |
| `engine/blocks/*.html` | Un template per tipo di blocco (il default, usato da tutti gli stili) |
| `themes/<id>/` | Uno stile: `theme.json`, `theme.css`, `assets/`, eventualmente `blocks/` |

## Configurazione di un invito

```ts
type InviteConfig = {
  themeId: string;                  // stile (cartella in themes/)
  model: string;                    // modello del catalogo (prezzo)
  addons: AddonKey[];               // funzioni acquistate
  eventType: EventType;
  locale: "it" | "en";
  event: Record<string, unknown>;   // title, hosts, eventDate, eventTime, address
  blocks: BlockInstance[];          // { id, type, hidden, props }
  rsvpQuestions: RsvpQuestion[];
};
```

Limiti: al massimo 30 blocchi. I blocchi unici compaiono al più una volta. Un blocco legato a una funzione (`countdown`, `gallery`, `program`, `map`, `rsvp`, `music`) è accettato solo se l'invito la ha.

## Blocchi

Il registro è in `shared/src/blocks.ts`. Ogni tipo ha un template di default in `engine/blocks/<tipo>.html`. Qui sotto le proprietà che il cliente può compilare. Le proprietà `look*` e `photo*` si aggiungono da sole ai blocchi che le usano.

| Tipo | Nome | Proprietà (tipo) | Vincoli |
|---|---|---|---|
| `cover` | Busta | `topText` (testo sopra), `envelopeColor`, `sealColor` (colore), `sealText` (testo nel sigillo), `coverVideo` (video), `tapLabel` (testo per aprire), `tapBounce` (rimbalzo), `tapBackground` (sfondo dietro la scritta). Con `envelope` nel manifest del tema: colori, sigillo e filmato sono dello stile; restano testo sopra, scritta per aprire, rimbalzo, sfondo | unica, sempre prima, non spostabile |
| `hero` | Intestazione | `kicker`, `occasion` (testo), `couplePhoto` (foto), `scrollLabel` (testo) + nomi, data, ora, sottotitolo dell'evento | unica, bloccata (non eliminabile) |
| `scratchdate` | Data da grattare | `dateTitle`, `dayLabel`, `monthLabel`, `yearLabel`, `revealLabel` (testi), `lookShape` (square/round/pill), `lookCover` (colore) | unica |
| `date` | Data | `dateTitle` (testo), `cellShape` (box/round/pill/plain), `showLabels` (sì/no) | unica |
| `countdown` | Conto alla rovescia | — | unica, funzione `countdown` |
| `message` | Messaggio | `heading` (testo), `body` (testo lungo, 1200) | — |
| `gallery` | Galleria | `heading` (testo), `photos` (fino a 6 foto), `galleryStyle` (slider/mosaic/grid) | funzione `gallery` |
| `image` | Immagine | `photo` (foto), `caption` (testo) | — |
| `program` | Programma | `heading` (testo), `items` (lista fino a 8: `time`, `label`) | funzione `program` |
| `venue` | Location | `heading`, `venue` (testo), `kind` (villa, chiesa, ristorante, giardino, hotel, sala, spiaggia, altro), `photo` (foto) | unica |
| `map` | Mappa | `mapShape` (forma: `theme`, `square`, `arch`, `circle`, `rounded`), `mapMode` (`map`/`button`), `buttonLabel` (testo); l'indirizzo è nei dati dell'evento | unica, funzione `map` |
| `transfer` | Come arrivare | `heading`, `body` (testo lungo, 800) | — |
| `dresscode` | Dress code | `heading`, `dress` (testo), `colors` (lista fino a 6: `hex` colore, `name` testo) | — |
| `video` | Video | `heading` (testo), `video` (video) | — |
| `music` | Musica | `music` (audio) | unica, funzione `music` |
| `rsvp` | Conferma di presenza | `heading`, `intro` (testo lungo, 300), `openLabel`, `submitLabel`, `thanksLabel` (testi), `rsvpMode` (`popup`/`inline`) | unica, funzione `rsvp` |
| `gifts` | Lista regali | `heading`, `body` (testo lungo, 800), `buttonLabel` (testo), `url` (solo https) | — |
| `faq` | Domande frequenti | `heading`, `intro` (testo lungo, 300), `items` (lista fino a 12: `q` testo, `a` testo lungo) | unica |
| `footer` | Firma | `signature` (testo) | unica |

**Varianti** (`BLOCK_VARIANTS`, `blockVariant()`): `mapMode = "button"` usa `engine/blocks/map-button.html`, `rsvpMode = "inline"` usa `engine/blocks/rsvp-inline.html`. Uno stile può avere le sue in `blocks/map-button.html` e `blocks/rsvp-inline.html`; la sostituzione di `map.html`/`rsvp.html` vale solo per la versione normale.

**Proprietà di aspetto** (aggiunte da sole, con il loro significato):
- `lookBg`, `lookInk`, `lookCover` (colori): sfondo del blocco, colore del testo, colore della copertura del gratta. Il motore li scrive nello stile del blocco come `--bk-bg`, `--bk-ink`, `--bk-cover`. Non esistono per la Busta, e ogni colore può essere `transparent`.
- `photoShape` (arch, circle, oval, rounded, diamond, hexagon), `photoFit` (contain/cover), `photoFocus` (center/top/bottom/left/right): aspetto delle foto del blocco. Sono applicati dal motore al tag `<img>` (`fitPhoto`), qualunque sia il template.
- `lookShape`, `cellShape`, `galleryStyle`: forma dei campi della data o della galleria. Il motore li scrive come attributi `data-shape`, `data-cell-shape`, `data-gallery` sul contenitore `.bk` del blocco.

**Testi del template** (`BLOCK_LABELS`): alcune etichette del template sono proprietà modificabili (per esempio `tapLabel` nella busta, `dayLabel` nella data da grattare, `openLabel` nel popup RSVP). Se il cliente le lascia vuote, il motore usa il testo predefinito in lingua (`t.*`).

### Dati disponibili nei template

**Dati dell'evento** (come variabili di primo livello, per tutti i blocchi): `title`, `hosts`, `eventDate`, `eventTime`, `address`. Il luogo non è un dato dell'evento: è la proprietà `venue` del blocco Location.

**Data**: `date.day`, `date.month`, `date.year`, `date.weekday`, `date.long` ("14 febbraio 2027"), `date.iso`.

**Altri**: `monogram` (iniziali del titolo, "S·L"), `slug`, `locale`, `preview` (true in anteprima e demo), `rsvp` (true se c'è il modulo), `rsvpQuestions`, `features.<funzione>` (booleano), `theme.id`, `theme.name`, `theme.description`, `theme.themeColor`, `t.<etichetta>` (testi del motore nella lingua dell'invito).

**Proprietà del blocco**: quelle della tabella sopra, con il loro nome (`heading`, `body`, `photos`, `items`…).

Ogni percorso può essere annidato (`date.day`, `items` con `{{time}}` e `{{label}}` dentro una sezione).

## Sintassi dei template

Un sottoinsieme di Mustache, sicuro per costruzione. Ogni valore viene escapato: dai dati non può arrivare HTML grezzo. Il template invece è del tema, ed è considerato fidato.

| Sintassi | Effetto |
|---|---|
| `{{percorso}}` | testo escapato; `.` indica l'elemento corrente |
| `{{percorso \| lines}}` | come sopra, con gli a capo trasformati in `<br>` |
| `{{percorso \| url}}` | come sopra, codificato per un URL |
| `{{#nome}}…{{/nome}}` | sezione: con un array ripete per ogni elemento; con un valore vero rende una volta; con un valore falso non rende nulla |
| `{{^nome}}…{{/nome}}` | sezione invertita: rende solo se il valore è falso o vuoto |
| `{{! commento }}` | non rende nulla |

Un segnaposto senza dato viene segnalato dalla validazione (`segnaposto senza dato`): nel template usa sempre una sezione `{{#…}}` per i dati che possono mancare.

**Font per campo**: se il cliente ha scelto un font per un campo di testo, il renderer avvolge il valore di quel campo (solo il `{{campo}}` del template) in uno `<span style="font-family:…">`. Il template non deve fare nulla: basta usare `{{campo}}`.

## Sfondi animati (rimossi)

Lo sfondo animato è stato tolto dal prodotto: niente canvas nella pagina, niente scelta nel builder né in BeSpoke AI, niente azione `setBackground`. `sanitizeConfig` non salva più `background`, quindi un vecchio valore sparisce al primo salvataggio dell'invito, e il motore lo ignora comunque. `shared/src/background.ts` resta solo perché il validatore dei temi accetta ancora la chiave `background` (ignorata).

## Sicurezza

- Ogni valore passa da `escapeHtml`. Il filtro `lines` mantiene gli a capo come `<br>`; `url` codifica per un URL.
- I dati del cliente non possono chiudere lo script della pagina: il JSON incorporato usa `<`.
- Font: solo gli id della libreria (`shared/src/fonts.ts`) finiscono nel CSS. Colori: solo `#RRGGBB`. Sfondi: solo i tipi della lista.
- I file (foto, video, audio) sono solo URL `/api/media/<nome>` prodotti dalla conversione; il nome è generato dal server, non scelto dal cliente.
- Le foto da Pixabay non passano dal browser: il server cerca e scarica dalla chiave del server, e accetta solo `https` verso `pixabay.com` (`api/src/pixabay.ts`).
- Gli stili non possono contenere `@import`, `expression(`, `<script>`, `<style>`; le risorse esterne ammesse sono solo Google Fonts e Google Maps.

## Media

**Busta-video.** Se il manifest dello stile dichiara `envelope`, la busta è il filmato dello stile (`envelope.video`): `page.ts` imposta quel solo file come filmato della busta, e il builder nasconde colori, sigillo e filmato; restano testo sopra, scritta per aprire, rimbalzo e sfondo, scelti dal cliente. Il filmato parte al tocco, senza audio; a fine filmato il runtime sfuma l'invito (900 ms, sezione 2). Con «riduci movimento» il filmato è saltato. Regole per i filmati in `docs/TEMI.md`, sezione «Busta-video».

Foto, video e audio caricati dal cliente passano da ffmpeg (`api/src/media.ts`): video H.264 senza audio, massimo 90 secondi e 15 MB; audio MP3 128 kbps. Le foto hanno il lato lungo massimo 2200 px; le PNG e le WebP restano PNG per conservare la trasparenza (massimo 8 MB in uscita), le altre diventano JPEG. Le conversioni sono in coda, una alla volta.

## Testi in inglese del catalogo

I modelli hanno due set di testi: quelli in italiano (`name`, `tagline`, `description`) e quelli in inglese, facoltativi (`en`). La console admin («Modelli») li mostra entrambi e li salva. Il sito in inglese usa, nell'ordine: i testi `en` salvati, poi quelli predefiniti in `web/lib/catalogCopy.ts` (`MODEL_COPY_EN`), poi l'italiano. Per le funzioni (`addons`) e i blocchi vale la stessa logica nel codice (`ADDON_COPY_EN`, `BLOCK_COPY_EN`, `FIELD_COPY_EN`): per cambiarli serve una modifica al codice.

## Anteprima e demo

- **Anteprima del builder**: `POST /api/invitations/:id/preview` con la configurazione in corso. Mostra la busta come la vede l'ospite. Il builder aggiorna da solo i blocchi che cambiano (per singolo blocco, senza ricaricare la pagina); la busta, la musica, la struttura e lo sfondo ricaricano tutta la pagina.
- **Demo degli stili**: `GET /api/themes/:id/demo?lang=it|en`, con tutti i blocchi e gli esempi dello stile. La lingua sceglie i dati generati (nomi, luoghi, frasi) e la versione `demoEn` dello stile. Il selettore della lingua del sito (bandiere, `web/components/LangSelect.tsx`) cambia la lingua delle schede. Nessuna busta (`preview: true`), così le schede dei modelli si vedono subito. Gli esempi sono generati da `api/src/engine/samples.ts`. Di base cambiano a ogni caricamento; uno stile con `"fixedDemo": true` (busta o immagini con nomi o iniziali) mostra invece sempre i suoi dati di `demo.event` e i suoi testi, e genera ciò che manca con un seme fisso legato all'id dello stile (`sampleConfig` in `api/src/engine/themes.ts`). Vale per anteprime, caroselli e invito di prova. Dettagli in `docs/TEMI.md`, «Esempi fissi».

## Verifica

```bash
npm run test -w @inviteme/shared
npm run test -w @inviteme/api
npm run validate-theme -w @inviteme/api          # tutti gli stili in themes/
npm run validate-theme -w @inviteme/api -- themes/<id>   # uno stile solo
```

La validazione di uno stile controlla: il manifest, il CSS (niente `@import`, solo `url()` verso `assets/` o `data:image/`), gli host esterni ammessi, i file citati presenti, le sostituzioni di blocco (solo tipi noti, senza `<script>`, `<style>`, `<link>`, `<meta>`, `<base>`, `<html>`, `<head>`, `<body>`, senza gestori inline), e una prova di rendering della demo con tutti i blocchi, che non deve lasciare segnaposti né dati mancanti.

## Hosting

Il container `api` contiene `engine/`, `themes/` e ffmpeg. Gli stili si caricano all'avvio: un nuovo stile richiede un rilascio (rebuild e riavvio dell'API). I media stanno nel volume `media`.
