# Asset prompts — Avorio botanico

Prompt pronti per generare in ChatGPT gli asset coordinati al filmato di apertura, la busta-video del tema (`themes/avorio-botanico/assets/apertura.mp4`, dichiarata in `envelope` nel `theme.json`). Per il filmato stesso, le regole sono in `docs/TEMI.md`, sezione «Busta-video».

## Riferimenti da allegare

Apri una sola conversazione ChatGPT per tutto il set e allega questi due fotogrammi prima di iniziare:

- `emerald-noir-reference-start.png`: busta chiusa, carta botanica e sigillo;
- `emerald-noir-reference-end.png`: busta aperta, luce dorata e farfalle.

I file sono in:

`C:\Users\kisho\.codex\visualizations\2026\10\22\01a1648e-f7c5-7412-9a99-ddfa38a6d3e4\video-reference\`

Genera **un solo asset per richiesta**. Scaricalo con il nome indicato. Non chiedere mai testo dentro le immagini: nomi, data e contenuti verranno sovrapposti dal motore Bespoke Invite.

## Direzione artistica fissa

- Carta artigianale avorio caldo `#F6F0E4`.
- Cipria pesca `#E8C4B5`, rosa polvere `#D99B9E`.
- Verde salvia grigiato `#9DA69A`, lavanda tenue `#8F89A8`.
- Oro antico chiaro `#C5A15A`, seppia per i dettagli `#6E563B`.
- Botanica: cosmos cipria, rose da giardino avorio, piccoli fiori rosa, lavanda, foglie sottili di salvia ed eucalipto.
- Tecnica: acquerello botanico molto dettagliato, incisione fine, texture di carta naturale, piccoli accenti a foglia d'oro.
- Atmosfera: romantica, luminosa, raffinata, eterea, senza effetto plastica o CGI.
- Sempre: nessuna persona, nessun volto, nessun testo, nessuna lettera, nessun numero, nessun monogramma, nessun logo, nessuna firma, nessun watermark.

---

## 01 — Sfondo generale della pagina

**File:** `paper-bg.jpg`
**Output:** JPEG, verticale 3:4, consigliato 1536 × 2048 px
**Uso:** sfondo del body e raccordo tra le sezioni

```text
Usa le due immagini allegate esclusivamente come riferimento di direzione artistica e palette.

Crea uno sfondo verticale in carta artigianale avorio caldo, con trama di fibre sottilissima e realistica. Il centro deve restare quasi completamente pulito, uniforme e luminoso per garantire la leggibilità di testi scuri. Inserisci soltanto lungo i margini estremi tracce botaniche molto leggere e discontinue: piccoli steli dorati, minuscoli boccioli cipria, qualche foglia salvia grigiata e rarissimi tocchi lavanda. Le decorazioni devono dissolversi gradualmente verso il centro e non formare una cornice chiusa. Luce naturale morbida, nessuna vignettatura scura, nessuna piega, nessuna ombra forte.

Stile: carta da partecipazione matrimoniale di lusso, acquerello botanico delicato e micro-incisioni oro antico, coerente con i riferimenti allegati.

Composizione: verticale 3:4, texture continua adatta a essere ripetuta o ritagliata; almeno il 75% centrale visivamente vuoto.

Nessuna persona, nessun oggetto, nessun sigillo, nessuna busta, nessun testo, nessuna lettera, nessun numero, nessun logo, nessuna firma, nessun watermark.
```

## 02 — Scena principale del frontespizio

**File:** `hero-garden.jpg`
**Output:** JPEG, verticale 2:3, 1024 × 1536 px
**Uso:** hero, subito dopo la dissolvenza del video

```text
Usa le due immagini allegate come riferimento vincolante per palette, botanica, luce e finitura della carta.

Crea un frontespizio matrimoniale verticale, concepito come la continuazione naturale della luce che esce dalla busta aperta. Una grande nicchia ad arco color avorio, elegante e simmetrica, si apre su un giardino etereo illuminato da luce dorata del mattino. L'arco è decorato con rose da giardino avorio, cosmos cipria, piccoli fiori rosa pallido, rametti di lavanda tenue, foglie salvia grigiata e sottilissimi dettagli a foglia d'oro. Alcune piccole farfalle dorate attraversano la luce, senza dominare la scena.

Lascia un'ampia area centrale calma, chiara e con contrasto uniforme, dal 22% al 68% dell'altezza, destinata a nomi e data sovrapposti in HTML. Concentra i fiori soprattutto negli angoli superiori, lungo i piedritti dell'arco e alla base. La scena deve avere profondità, ma conservare l'aspetto di un'illustrazione editoriale su carta, non di un ambiente 3D.

Stile: acquerello botanico realistico, incisione fine, carta avorio materica, oro antico, atmosfera romantica luminosa e raffinata. Nessuna dominante arancione, nessun bianco bruciato.

Composizione verticale 2:3, perfettamente centrata, nessuna persona, nessuna sedia, nessun tavolo, nessun testo, nessuna lettera, nessun numero, nessun monogramma, nessun logo, nessun watermark.
```

## 03 — Cornice botanica verticale

**File:** `floral-frame.png`
**Output:** PNG con vera trasparenza, verticale 2:3, 1024 × 1536 px
**Uso:** hero, messaggio, RSVP, footer

```text
Usa le immagini allegate come riferimento vincolante di stile e colori.

Crea una sola cornice botanica matrimoniale verticale su sfondo completamente trasparente. Componi rose da giardino avorio, cosmos cipria, piccoli boccioli rosa, sottili rametti lavanda, foglie salvia grigiata e filamenti oro antico. La decorazione deve essere più ricca negli angoli in alto a sinistra e in basso a destra, più sottile negli altri due angoli, collegata da rami finissimi lungo i margini.

Il 66% centrale deve restare totalmente vuoto e trasparente, con bordi interni morbidi e senza elementi che invadano la zona del testo. Tutti i fiori e le foglie devono essere interamente contenuti nella tela, con almeno 45 px di margine trasparente esterno. Dettaglio botanico ad acquerello e incisione fine, piccoli accenti a foglia d'oro, luce delicata coerente.

Output: un unico asset isolato, PNG con autentico canale alfa. Non disegnare uno sfondo bianco, beige, a scacchi o di carta. Nessun rettangolo pieno, nessuna ombra rettangolare, nessun testo, nessun monogramma, nessun logo, nessun watermark.
```

## 04 — Bouquet d'angolo

**File:** `floral-corner.png`
**Output:** PNG trasparente, quadrato, 1024 × 1024 px
**Uso:** map, venue, gallery, dress code; il CSS può specchiarlo

```text
Usa le immagini allegate come riferimento vincolante di palette e tecnica.

Crea un unico bouquet botanico ad angolo, orientato dal basso a sinistra verso l'alto a destra. Alla base: una grande rosa avorio e due cosmos cipria. Intorno: piccoli fiori rosa pallido, rametti lavanda, foglie salvia grigiata ed eucalipto sottile, con pochi dettagli lineari in oro antico. La massa floreale deve occupare soprattutto il triangolo inferiore sinistro; le estremità dei rami devono diventare leggere e ariose.

Il bouquet deve essere elegante, asimmetrico, dettagliato e leggibile anche ridotto. Tutti gli elementi devono rimanere dentro la tela, con margine trasparente su ogni lato. Acquerello botanico realistico con incisione fine, niente effetto adesivo, niente bordi bianchi.

Output quadrato: un solo bouquet isolato su sfondo completamente trasparente, PNG con autentico canale alfa. Nessun vaso, nessun nastro con scritte, nessuna persona, nessun testo, nessuna lettera, nessun logo, nessun watermark.
```

## 05 — Rametto verticale leggero

**File:** `floral-sprig.png`
**Output:** PNG trasparente, quadrato, 768 × 768 px
**Uso:** programma, countdown, separatori laterali

```text
Usa le immagini allegate come riferimento vincolante di stile.

Crea un singolo rametto botanico slanciato, leggermente curvo, composto da un piccolo cosmos cipria, due minuscoli fiori avorio, quattro foglie salvia grigiata, tre gemme rosa pallido e una breve spiga lavanda. Aggiungi una sottilissima nervatura oro antico, discreta e non metallica in eccesso. La silhouette deve essere elegante e ariosa, con molto spazio negativo, adatta a essere ruotata o specchiata nel CSS.

Stile: acquerello botanico fine più incisione delicata, coerente con la carta e i fiori dei riferimenti. Tutto il rametto deve stare nella tela con margine trasparente ampio.

Output: un solo rametto isolato, PNG con autentico sfondo trasparente. Nessun fondale bianco o a scacchi, nessun vaso, nessun testo, nessun logo, nessun watermark.
```

## 06 — Ghirlanda orizzontale

**File:** `floral-divider.png`
**Output:** PNG trasparente, orizzontale 3:1, 1536 × 512 px
**Uso:** divisione tra sezioni, footer, messaggi

```text
Usa le immagini allegate come riferimento vincolante di stile e palette.

Crea una ghirlanda botanica orizzontale bassa e raffinata. Al centro inserisci un piccolo gruppo di tre fiori: rosa da giardino avorio, cosmos cipria e fiore rosa pallido. Da entrambi i lati si estendono rami sottili quasi simmetrici con foglie salvia grigiata, minuscoli boccioli, tocchi lavanda e filamenti oro antico. La composizione deve essere lunga, sottile e ariosa, con altezza visiva contenuta e estremità che sfumano naturalmente.

Stile: acquerello botanico dettagliato e incisione fine su invito di lusso. Tutti gli elementi devono essere interamente contenuti, con ampio margine trasparente sopra, sotto e ai lati.

Output: un'unica ghirlanda isolata, PNG con autentico canale alfa. Nessun nastro, nessuna targhetta, nessun testo, nessuna lettera, nessun logo, nessun watermark, nessuno sfondo disegnato.
```

## 07 — Fregio dorato lineare

**File:** `gold-divider.png`
**Output:** PNG trasparente, orizzontale 4:1, 1536 × 384 px
**Uso:** titoli, date, countdown e programma

```text
Usa i riferimenti allegati per riprendere esclusivamente il tono dell'oro antico e la delicatezza botanica.

Crea un fregio orizzontale estremamente sottile in oro antico opaco. Al centro: un minuscolo fiore stilizzato a sei petali racchiuso in una piccola losanga aperta. Ai lati: due linee sottili simmetriche che diventano brevi volute botaniche con una sola foglia ciascuna. Disegno lineare, elegante, equilibrato, simile a un'incisione di alta cartoleria; nessuna massa piena e nessun effetto 3D.

Il fregio deve occupare soltanto la fascia centrale orizzontale, con abbondante spazio trasparente attorno. Colore principale oro antico chiaro #C5A15A con lievissime variazioni naturali, contorno nitido anche a dimensioni piccole.

Output: un solo fregio isolato su autentico sfondo trasparente, PNG. Nessun testo, nessuna lettera, nessun monogramma, nessun logo, nessun watermark, nessuna ombra.
```

## 08 — Farfalle dorate isolate

**File:** `butterflies.png`
**Output:** PNG trasparente, quadrato, 1024 × 1024 px
**Uso:** hero e piccoli accenti animati via CSS

```text
Usa soprattutto il fotogramma finale allegato come riferimento per la forma, il colore e la luce delle farfalle.

Crea un set di cinque piccole farfalle dorate, tutte separate tra loro e completamente visibili, disposte con molto spazio trasparente fra una e l'altra. Mostra cinque pose diverse ma naturali: vista frontale con ali aperte, tre quarti, profilo, ali semiaperte e una farfalla più piccola in lontananza. Ali sottili e traslucide, venature finissime color oro antico, bagliore caldo molto controllato e bordi nitidi.

Le farfalle devono sembrare elementi poetici di una partecipazione matrimoniale, non insetti fotografici e non gioielli metallici pesanti. Nessuna scia luminosa lunga, nessun glitter diffuso.

Output: cinque farfalle isolate in un unico PNG con autentico canale alfa. Nessuno sfondo, nessuna scena, nessun fiore, nessun testo, nessun logo, nessun watermark.
```

## 09 — Sigillo coordinato per il fallback senza video

**File:** `wax-seal.png`
**Output:** PNG trasparente, quadrato, 1024 × 1024 px
**Uso:** cover statica e pulsante RSVP

```text
Usa il fotogramma iniziale allegato come riferimento vincolante.

Crea un singolo sigillo di ceralacca rotondo color cipria pesca, visto perfettamente dall'alto. Bordo organico leggermente irregolare, superficie satinata realistica e rilievo centrale molto fine. Il rilievo deve rappresentare esclusivamente un piccolo bouquet botanico: tre fiorellini, due foglie e sottili rametti dorati. Non inserire iniziali, lettere o monogrammi. Mantieni il sigillo elegante e sobrio, con il motivo ben leggibile anche ridotto.

Illuminazione morbida proveniente dall'alto a sinistra; piccola ombra naturale aderente all'oggetto, senza fondale. Colori e finitura devono coincidere con la ceralacca del riferimento.

Output: un solo sigillo centrato e isolato, PNG con autentico sfondo trasparente e margine libero su tutti i lati. Nessuna busta, nessun fiore esterno, nessun testo, nessuna lettera, nessun logo, nessun watermark.
```

## 10 — Cornice fotografica ad arco

**File:** `photo-frame.png`
**Output:** PNG trasparente, verticale 2:3, 1024 × 1536 px
**Uso:** hero photo, image e venue

```text
Usa le immagini allegate come riferimento di palette e raffinatezza.

Crea una singola cornice fotografica verticale ad arco, sottile ed elegante. Struttura in oro antico opaco con doppio filetto finissimo; piccoli rilievi botanici solo alla sommità e ai due angoli inferiori. Aggiungi pochissimi fiori dipinti: un piccolo cosmos cipria, due fiorellini avorio e foglie salvia grigiata, senza coprire l'apertura interna.

L'area interna dell'arco deve essere completamente vuota e trasparente per ricevere una fotografia via CSS. Anche l'area esterna alla cornice deve essere trasparente. Mantieni spessori regolari, simmetria precisa e bordi nitidi; niente vetro, riflessi o fotografia incorporata.

Output: una sola cornice isolata, PNG con autentico canale alfa sia dentro sia fuori. Nessuno sfondo bianco o a scacchi, nessuna persona, nessun testo, nessun monogramma, nessun logo, nessun watermark.
```

## 11 — Foto demo della location

**File:** `location.jpg`
**Output:** JPEG, orizzontale 3:2, 1536 × 1024 px
**Uso:** blocco venue

```text
Usa le due immagini allegate come riferimento per palette, atmosfera e scelta botanica, senza riprodurre la busta.

Crea una fotografia editoriale fine-art di una location matrimoniale vuota, senza persone. Una serra-giardino luminosa con alte finestre ad arco, tavoli apparecchiati con lino avorio, candele sottili, cristalli trasparenti e composizioni di rose avorio, cosmos cipria, piccoli fiori rosa, lavanda tenue e foglie salvia. Dettagli in ottone e oro antico molto sobri. Luce dorata del tardo pomeriggio, ombre morbide, aria eterea, composizione ordinata e realistica.

Inquadratura orizzontale 3:2, punto di vista ad altezza naturale, spazio visivo centrale, profondità di campo moderata. Nessun invitato, nessun cameriere, nessuna figura riflessa, nessun cartello, nessun menu leggibile, nessun testo, nessun logo, nessun watermark. Evita colori saturi, lampi arancioni e look CGI.
```

## 12 — Galleria: tavola e candele

**File:** `gallery-1.jpg`
**Output:** JPEG, verticale 4:5, 1024 × 1280 px

```text
Crea una fotografia verticale fine-art di dettaglio, coordinata esattamente alla palette avorio, cipria, salvia, lavanda e oro antico dei riferimenti allegati. Primo piano di una tavola matrimoniale vuota: lino avorio materico, una candela sottile accesa, cristallo trasparente, posate oro antico, rosa da giardino avorio, cosmos cipria e un rametto di lavanda. Luce naturale dorata e morbida, profondità di campo ridotta, fotografia editoriale raffinata e realistica.

Nessuna persona, nessuna mano, nessun volto, nessun nome, nessun segnaposto leggibile, nessun testo, nessun marchio, nessun watermark. Composizione verticale 4:5, soggetto completamente dentro l'inquadratura, colori non saturi.
```

## 13 — Galleria: anelli e botanica

**File:** `gallery-2.jpg`
**Output:** JPEG, verticale 4:5, 1024 × 1280 px

```text
Crea una fotografia macro verticale fine-art coordinata ai riferimenti allegati. Due anelli nuziali semplici in oro antico poggiati su carta artigianale avorio, accanto a piccoli boccioli cipria, un rametto di lavanda e foglie salvia grigiata. Inserisci una tenue ombra di finestra e piccoli riflessi caldi, senza eccesso di brillantezza. Atmosfera romantica, editoriale, intima e realistica; trama della carta ben visibile.

Nessuna scatola con logo, nessuna incisione leggibile sugli anelli, nessuna persona, nessuna mano, nessun testo, nessuna lettera, nessun marchio, nessun watermark. Composizione verticale 4:5, messa a fuoco nitida sugli anelli.
```

## 14 — Galleria: arco floreale vuoto

**File:** `gallery-3.jpg`
**Output:** JPEG, verticale 4:5, 1024 × 1280 px

```text
Crea una fotografia verticale fine-art di un arco da cerimonia senza persone, coordinato ai riferimenti allegati. Arco slanciato color avorio con sottili dettagli oro antico, decorato in modo organico con rose avorio, cosmos cipria, piccoli fiori rosa pallido, lavanda tenue e foglie salvia grigiata. Sullo sfondo un giardino luminoso e morbido, luce dorata del mattino, atmosfera eterea ma realistica. Lascia visibile il passaggio centrale dell'arco e mantieni la composizione elegante, non sovraccarica.

Nessuna coppia, nessun ospite, nessuna sedia in primo piano, nessun cartello, nessun testo, nessun logo, nessun watermark. Composizione verticale 4:5, colori pastello naturali, niente look CGI.
```

## 15 — Galleria: calici e farfalla dorata

**File:** `gallery-4.jpg`
**Output:** JPEG, verticale 4:5, 1024 × 1280 px

```text
Crea una fotografia verticale fine-art coordinata ai riferimenti allegati. Due calici di cristallo senza marchio su un tavolo in carta o lino avorio, illuminati da luce dorata morbida. Accanto ai calici: piccoli fiori cipria, una rosa avorio, foglie salvia e un sottile dettaglio lavanda. Una sola piccola farfalla dorata è posata vicino ai fiori, con ali delicate e realistiche. Sfondo luminoso sfocato, atmosfera romantica e raffinata, fotografia editoriale naturale.

Nessuna persona, nessuna mano, nessun volto, nessuna bottiglia con etichetta, nessun testo, nessun logo, nessun watermark. Composizione verticale 4:5, niente colori saturi, niente bagliore artificiale eccessivo.
```

## Controllo di ogni output

Prima di passare all'asset successivo verifica:

- il file contiene un solo asset, non una griglia di varianti;
- non sono comparsi nomi, lettere, numeri, loghi o watermark;
- per i PNG lo sfondo è davvero trasparente, non bianco o a scacchi disegnati;
- nessun fiore o ramo importante è tagliato dai bordi;
- le aree riservate ai testi sono davvero libere;
- cipria, salvia, lavanda e oro hanno la stessa intensità dei fotogrammi allegati;
- la luce resta calda e delicata, senza sovraesposizione bianca;
- non compaiono persone o volti.

Se un output è quasi corretto, non rigenerarlo da zero: usa questo follow-up nella stessa conversazione:

```text
Mantieni identici composizione, palette, tecnica, proporzioni e soggetto dell'ultima immagine. Correggi soltanto questo punto: [descrivi una sola correzione]. Non aggiungere testo, persone, loghi o nuovi elementi. Conserva lo sfondo trasparente se presente.
```
