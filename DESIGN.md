# DESIGN.md — Bespoke Invite, mondo visivo "atelier di stampa"

Questo documento fissa le decisioni visive durature. Il contenuto di prodotto sta in PRODUCT.md.

## Idea

Bespoke Invite è un laboratorio di stampa digitale. Il riferimento è il lavoro di uno stampatore a rilievo: carta spessa, inchiostro che affonda nella fibra, lacca e foglia d'oro. L'interfaccia si comporta come un banco di lavoro di quello studio: superfici di carta, inchiostro scuro, un solo colore di metallo per le azioni importanti.

Non è una versione "elegante" dei template di mercato. Il mondo non usa card identiche, eyebrow sopra i titoli, glow, gradiente sul testo o icone Unicode.

## Colore

| Ruolo | Nome | Valore | Uso |
|---|---|---|---|
| Carta | Carta grezza | `#ECEEE8` | fondo di pagina |
| Carta chiara | Carta patinata | `#F8F9F5` | superfici di lettura, moduli |
| Inchiostro | Petrolio profondo | `#17242A` | testo, azioni primarie |
| Inchiostro attenuato | Petrolio fumo | `#56656B` | testo secondario (contrasto ≥ 4.5:1 su carta) |
| Metallo | Ottone | `#9A7433` | accento unico: prezzi, stato attivo, focus |
| Linee | Grafite tenue | `#C9CFC7` | filetti e bordi |

Regole:
- Il colore di accento è uno solo. Non si aggiungono altri accenti sulle pagine di prodotto.
- Gli stili degli inviti (Carta, Notte, Rosa) sono dati configurabili dall'admin. Non influenzano l'interfaccia di Bespoke Invite.

## Tipografia

- **Display**: Bodoni Moda (contrasto alto, didone). Titoli, prezzi, nomi degli sposi. Tracking non oltre −0.02em.
- **Testo**: Familjen Grotesk. Interfaccia, corpo, etichette, tabelle.
- Scala: 16 px di base, rapporti circa 1.25. Titoli display fino a 5.5 rem.
- Il corpo ha una misura di 65–75 caratteri.
- Nessuna etichetta maiuscola tracciata sopra i titoli.

Font caricati con `next/font/google` e serviti dal proprio dominio.

## Forma

- Angoli netti: 2 px sulle superfici di lavoro, nessun arrotondamento sulle card (non ci sono card).
- Gli inviti hanno la forma dell'arco come motivo, non come decorazione: l'arco contiene la foto o il monogramma.
- Filetti da 1 px. Nessun filetto colorato a sinistra.
- Ombre con offset e sfumatura morbida, usate solo per la busta e per l'anteprima dell'invito.

## Composizione

- **Home** (Persuade): titolo a sinistra in un corpo grande; a destra un invito reale su un foglio di carta con il bordo tagliato. I modelli sono due righe di specifica (nome in display, prezzo, funzioni incluse), non card.
- **Funzioni**: listino tipografico, con prezzo allineato a destra e filetto tratteggiato. Niente griglia di card.
- **Passi**: sequenza numerata, perché il processo è davvero ordinato.
- **Builder** (Operate): colonna di controllo a sinistra, anteprima a destra su una superficie di lavoro. Densità alta, rumore basso.
- **Console admin** (Operate): tabelle leggibili, moduli a una colonna, nessuna decorazione.
- **Invito pubblico** (Experience): la busta è la prima cosa. Al tocco si apre, poi l'invito occupa la pagina.

## Movimento

Un solo momento coreografato per invito: la busta si apre (lembo che ruota, carta che sale), poi il contenuto compare in sequenza breve. Nessun movimento di scroll sulle sezioni, nessun petalo, nessun effetto decorativo sparso. Il movimento è disattivato con `prefers-reduced-motion`.

## Icone

Icone disegnate in SVG con un solo tratto (2 px su griglia 24), mai caratteri Unicode.

## Immagini

Nessuna immagine stock. Le foto sono quelle caricate dal cliente. Dove manca una foto, l'invito mostra un monogramma e un segno grafico originale.

## Da evitare (anti-riferimento)

- Il mondo precedente: sfondo crema con accento teal, pillole piene, eyebrow in maiuscolo, card con bordo, aurora scura, petali, gradiente sul testo.
- I template dei concorrenti: stessa cornice, stessi caratteri di sistema, stesse card.
