# INTERFACCIA — Bespoke Invites

Le regole di base per far sembrare ogni pagina, sezione e grafica del sito parte dello stesso progetto.
Prima di aggiungere qualcosa di nuovo, controlla qui: se un elemento esiste già, usalo; se serve qualcosa di nuovo, costruiscilo con questi stessi ingredienti.

---

## 1. Personalità

**Quiet luxury.** Elegante, luminoso, calmo. Niente di urlato.

- **Chiaro e arioso:** la base è quasi bianca, l'oro è un accento e non uno sfondo.
- **Prezioso ma moderno:** oro metallico, vetro, porcellana; linee pulite, niente ornamenti barocchi.
- **Caldo e umano:** si parla alla coppia ("voi"), con frasi brevi e gentili.
- **Onesto:** niente timer finti, numeri inventati o recensioni non reali.

Se un elemento sembra "carico", "scuro" o "rumoroso", probabilmente è fuori stile.

---

## 2. Colori

Tutti i colori sono variabili CSS definite in `snippets/inviti-styles.liquid`. **Non scrivere colori a mano nelle sezioni:** usa sempre le variabili.

### Base

| Ruolo | Variabile | Valore | Uso |
|---|---|---|---|
| Sfondo pagina | `--iv-cream` | `#fdfbf7` | Quasi bianco caldo, sfondo generale |
| Bianco | `--iv-ivory` | `#ffffff` | Card, sezioni alternate, footer |
| Sabbia | `--iv-sand` | `#f7f1e7` | Aree leggermente più calde (media prodotto) |
| Testo | `--iv-ink` | `#2a2119` | Titoli e testo principale |
| Testo secondario | `--iv-muted` | `#7b6a57` | Descrizioni, note, etichette |
| Linee | `--iv-line` | `rgba(160,115,45,.18)` | Bordi e separatori |

### Accenti

| Ruolo | Variabile | Valore |
|---|---|---|
| Oro | `--iv-gold` | `#b8893f` |
| Oro scuro | `--iv-gold-dark` | `#8a6427` |
| Ocra | `--iv-ochre` | `#c4893a` |

### Gradienti

| Variabile | Uso |
|---|---|
| `--iv-grad-gold` | Testo in corsivo oro, numeri, bordi metallici: **il "metallo" del brand** |
| `--iv-grad-ochre` | Piccole superfici piene: pallini, badge, cerchi con icona |
| `--iv-grad-deep` | Solo per la card VIP: **l'unico elemento scuro della pagina** |

### Proporzioni

- **~85% chiaro** (cream, bianco, sabbia), **~12% testo**, **~3% oro**.
- Le sezioni si alternano tra `#fff` e `--iv-cream` per dare ritmo senza usare colori forti.
- **Un solo blocco scuro** per pagina (la card VIP). Se ne serve un altro, chiediti prima se è davvero necessario.
- Il bordeaux non fa parte della palette. La variabile `--iv-wine` esiste ancora per compatibilità, ma ora vale oro scuro.

---

## 3. Tipografia

| Ruolo | Font | Peso | Note |
|---|---|---|---|
| Titoli | **Fraunces** (alternativa gratuita a Canela) | 300 | `letter-spacing:-.02em`, `line-height:1.04` |
| Parole in evidenza | Fraunces *corsivo* + gradiente oro | 300 | Classe `.iv-gold-text` o `<em>` dentro i titoli `.iv-head h2` |
| Testo | **Jost** | 300 (testo), 500 (etichette e pulsanti) | `line-height:1.6` |
| Calligrafia | **Pinyon Script** | 400 | **Solo** per i nomi degli sposi dentro gli inviti di esempio |

### Scala (computer → tablet → telefono)

| Elemento | Computer | Tablet | Telefono |
|---|---|---|---|
| Titolo hero (`h1`) | 96px | 48px | 34px |
| Titolo sezione (`.iv-head h2`) | 58px | 38px | 29px |
| Titolo card (`h3`) | 25–34px | 22–28px | 20–25px |
| Testo introduttivo | 18–19px | 16px | 14.5px |
| Testo normale | 15–16px | 15px | 14px |
| Occhiello (`.iv-eyebrow`) | 11.5px MAIUSCOLO | — | 10px |

### Regole

- **Un solo corsivo oro per titolo**, sempre alla fine o sulla parola chiave: *"Tre passi. **Al resto pensiamo noi**"*.
- Le **etichette** (occhielli, badge, pulsanti) sono in maiuscolo, Jost 500, con spaziatura larga (`.14–.3em`).
- Mai più di **due font nella stessa card** (Fraunces + Jost). Pinyon solo dentro gli inviti mostrati.

---

## 4. Spazi, griglia, forme

- **Larghezza massima** del contenuto: `1180px` (`.iv-wrap`), con margini laterali di 24px (16px su telefono).
- **Spazio verticale tra le sezioni** (`.iv-section`): 120px → 72px tablet → 52px telefono.
- **Intestazione delle sezioni** (`.iv-head`): centrata, max 760px, occhiello + titolo + testo, 64px di distanza dal contenuto.
- **Arrotondamenti:**
  - pulsanti, pillole, badge: `999px` (completamente tondi);
  - card: `18–26px`;
  - finestre e box grandi: `28–32px`;
  - telefoni disegnati: `40–46px`.
- **Ombre:** sempre morbide, lunghe e calde, mai nere. Esempio standard:
  `0 30px 60px -44px rgba(110,78,28,.4)`.
  Sulle immagini PNG (icone, sigillo) **niente ombre aggiunte**.

---

## 5. Componenti

### Pulsanti — `.iv-btn`

Vetro trasparente con bordo in **metallo liquido oro** che ruota (più veloce al passaggio del mouse), riflesso in alto e onda di luce al clic.

| Variante | Classe | Quando |
|---|---|---|
| Principale | `.iv-btn` | L'azione più importante della sezione (una sola per sezione) |
| Secondario | `.iv-btn .iv-btn--ghost` | Azione alternativa ("Guarda gli stili", "Scrivici") |
| Su fondo scuro | automatico dentro `.iv-plan--vip` | Card VIP |

Regole:
- testo **sempre in maiuscolo**, breve, con un verbo: *Crea il tuo invito*, *Scegli VIP*, *Prova Bespoke AI gratis*;
- una freccia `→` solo sul pulsante principale della hero o delle sezioni chiave;
- su telefono i pulsanti importanti occupano tutta la larghezza.

### Vetro — `.iv-glass`

Per pillole e card fluttuanti (prezzo nella hero, card attorno al telefono, badge AI): bianco traslucido, sfocatura, bordo bianco luminoso. Va usato **sopra sfondi con un po' di colore** (sfumature oro): sul bianco piatto non si vede.

### Card

- Sfondo **bianco**, bordo `rgba(160,115,45,.12)`, ombra morbida, arrotondamento 18–26px.
- Al passaggio del mouse: leggero sollevamento (`translateY(-4px)`), mai cambi di colore forti.

### Sigillo — `.iv-seal`

- Immagine PNG di ceralacca oro (`sigillo-oro-lucatelli.png`, generata con Higgsfield) con le **iniziali incise** come testo sopra.
- Iniziali in Fraunces corsivo, max 3 caratteri (`G&M`, `B`).
- Dimensioni: 44–110px. Sotto i 50px usa al massimo 2 caratteri.

### Icone

- **Oggetti 3D in porcellana avorio e oro satinato**, su base tonda, generati con Higgsfield, PNG con sfondo trasparente (file `icona-*.png`).
- Per nuove icone usa **lo stesso prompt di stile** (vedi sezione 9) e approvale una alla volta.
- Dimensioni: 104px computer, 88px tablet, 76px telefono.
- Icone piccole d'interfaccia (frecce, carrello, menu): SVG a linea sottile, 1.4–1.6px, `currentColor`.

### Telefono di esempio — snippet `inviti-phone`

```liquid
{% render 'inviti-phone', look: 'classic', size: 'lg', names: 'Giulia & Marco', initials: 'G&M', date: '12 · 06 · 2027', place: 'Villa Aurelia, Roma' %}
```

- `look`: `classic` (avorio e oro), `botanic` (salvia), `noir` (nero e oro).
- `size`: `lg` (hero) o `sm` (galleria stili).
- Nomi di esempio sempre **di fantasia**, date future e luoghi italiani plausibili.

### Numeri e indici

- Numeri di passaggio e d'ordine (01, 02…) in **Fraunces corsivo con gradiente oro**.
- Prezzi in Fraunces, prezzo barrato più piccolo e in `--iv-muted`.

---

## 6. Movimento

Le animazioni devono essere **lente, morbide e rare**. Servono a dare vita, non a distrarre.

| Effetto | Durata | Dove |
|---|---|---|
| Bordo metallico dei pulsanti | 6s (2.2s al passaggio) | Pulsanti |
| Bordo icone/chat | 7–14s | Cerchi, finestra chat |
| Luccichio oro nei corsivi | 7s | Testo oro |
| Galleggiamento card e sigillo | 5–7s | Hero |
| Comparsa elementi | 0.4–0.7s, `cubic-bezier(.2,.8,.2,1)` | Cambi di scena |
| Rimbalzo leggero | `cubic-bezier(.34,1.56,.64,1)` | Hover icone, pressione pulsanti |

Regole:
- le animazioni automatiche (demo, chat AI) partono **solo quando la sezione è visibile** e si fermano al passaggio del mouse;
- rispettare **sempre** `prefers-reduced-motion`: chi ha le animazioni disattivate vede tutto fermo;
- mai lampeggi, scosse o rotazioni veloci.

---

## 7. Responsive

Le regole per tablet e telefono stanno tutte in **`snippets/inviti-responsive.liquid`**.

| Formato | Larghezza | Cosa cambia |
|---|---|---|
| Computer | oltre 990px | Layout completo, colonne affiancate |
| Tablet | 750–989px | Colonne impilate, misure ridotte di circa il 15–20% |
| Telefono | fino a 749px | Una colonna, testo centrato nelle card, pulsanti a tutta larghezza, barra prezzo in basso |

Regole:
- **nessuno scorrimento orizzontale**, mai. Le gallerie larghe (stili, schede demo) scorrono dentro il loro contenitore;
- su telefono **icone, titoli e testi delle card sono centrati**;
- se aggiungi una sezione nuova, aggiungi le sue misure ridotte in `inviti-responsive.liquid` (con il prefisso `html body` per avere la precedenza).

---

## 8. Testi e tono

- Si parla alla coppia con il **"voi"**: *"il vostro invito"*, *"raccontateci"*.
- Frasi **brevi**, una idea per frase. Niente gergo tecnico (non "RSVP tracking", ma "conferma presenze").
- Titoli in due tempi: una parte normale + una parte in corsivo oro.
- **Mai inventare**: numeri di clienti, recensioni, scadenze o sconti a tempo devono essere veri.
- Promesse di servizio (tempi di consegna, rimborso, lingue, funzioni della dashboard) devono corrispondere a ciò che offriamo davvero.
- Il nome si scrive sempre **Bespoke Invites**; l'assistente è **Bespoke AI**.

---

## 9. Immagini generate (Higgsfield)

Per mantenere coerenti icone ed elementi grafici, parti da questo stile:

> *Minimalist luxury 3D icon object, smooth glossy ivory porcelain with polished champagne-gold details, standing on a small round flat ivory porcelain base with a thin gold rim. Modern wedding stationery aesthetic, quiet luxury, satin brushed gold and warm ivory, subtle ochre reflections, soft diffused studio light from top-left, clean simple geometry, no text. Three-quarter front view, centered, fills 70% of the frame, pure white background, square.*

Poi:
1. genera **2 varianti** e scegli;
2. **togli lo sfondo** (PNG trasparente);
3. carica su Shopify in **Contenuti → File** con un nome chiaro (`icona-…`, `sigillo-…`);
4. nel tema usala con `{{ 'nome.png' | file_img_url: '240x' }}`.

---

## 10. Regole tecniche del tema

- **Prefisso `.iv-`** per tutte le classi, nome in stile BEM: `.iv-sezione__elemento--variante`.
- **Una sezione = un file** in `sections/inviti-*.liquid`, con i suoi stili in testa e lo schema in fondo. I testi si modificano dall'editor del tema.
- **Stili condivisi** (colori, font, pulsanti, sigillo, telefono) solo in `snippets/inviti-styles.liquid`.
- Le sezioni **non ridefiniscono** colori, pulsanti o font: li ereditano.
- Ogni nuova sezione ha un `id` per i link interni (`#prezzi`, `#faq`, `#bespoke-ai`…).

### Mappa dei file

| File | Contenuto |
|---|---|
| `snippets/inviti-styles.liquid` | Colori, font, pulsanti, vetro, sigillo, telefono |
| `snippets/inviti-responsive.liquid` | Misure per tablet e telefono |
| `snippets/inviti-phone.liquid` | Telefono con invito di esempio |
| `sections/inviti-header.liquid` / `inviti-footer.liquid` | Intestazione e footer |
| `sections/inviti-hero.liquid` | Apertura della home |
| `sections/inviti-vip.liquid` | Card busta con sigillo |
| `sections/inviti-ai.liquid` | Bespoke AI |
| `sections/inviti-steps.liquid` | Come funziona |
| `sections/inviti-demo.liquid` | Demo in 3 passaggi (invito, conferma, dashboard) |
| `sections/inviti-features.liquid` | Cosa include, con le icone 3D |
| `sections/inviti-showcase.liquid` | Stili d'invito |
| `sections/inviti-pricing.liquid` | Prezzi Classic e VIP |
| `sections/inviti-faq.liquid` | Domande frequenti |
| `sections/inviti-cta.liquid` | Chiusura e barra prezzo su telefono |
| `sections/inviti-product.liquid` | Pagina prodotto |

---

## 11. Checklist prima di pubblicare una modifica

- [ ] Usa solo colori, font e componenti di questo documento?
- [ ] C'è **una sola** azione principale nella sezione?
- [ ] Il titolo ha al massimo **un** corsivo oro?
- [ ] Su telefono: niente scorrimento orizzontale, testi leggibili, card centrate?
- [ ] Le animazioni sono lente e si fermano con `prefers-reduced-motion`?
- [ ] I testi usano il "voi", sono brevi e dicono solo cose vere?
- [ ] Le immagini nuove sono nello stile porcellana + oro, con sfondo trasparente e senza ombre aggiunte?
