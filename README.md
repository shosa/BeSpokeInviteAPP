# InviteMe

Inviti digitali per matrimoni ed eventi: copertina sigillata, musica, programma, mappa e conferma di presenza in un solo link.

## Struttura

- `web/`: frontend Next.js (pagine, builder, console admin). La pagina invito è servita dall'API.
- `api/`: API Fastify con PostgreSQL (account, inviti, pagamenti, email, console, conversione media con ffmpeg).
- `shared/`: catalogo, prezzi, validazione e motore di template, condivisi da API e frontend.
- `engine/`: runtime del browser per le pagine invito (busta, audio, gratta, RSVP).
- `themes/`: i temi, una cartella per tema. Per crearne uno: `docs/TEMI.md`. Come funziona il motore: `docs/MOTORE.md`.
- `docker-compose.yml`: tre servizi: `db` (PostgreSQL), `api`, `web`.

## Avvio con Docker

1. Copia `.env.example` in `.env` e compila almeno `POSTGRES_PASSWORD`, `ADMIN_TOKEN` e `ADMIN_EMAIL`.
2. Avvia i servizi:

```bash
docker compose up --build -d
```

3. Apri http://localhost:3000.

L'API crea da sola lo schema del database al primo avvio. I dati restano nei volumi `pgdata` (database) e `media` (brani caricati).

Per fermare: `docker compose down`. Per cancellare anche i dati: `docker compose down -v`.

## Sviluppo locale (senza Docker)

Serve Node 24. Dalla cartella del progetto:

```bash
npm install
npm run devdb -w @inviteme/api      # PostgreSQL locale sulla porta 5433
```

In un secondo terminale, l'API (porta 4000):

```bash
DATABASE_URL=postgres://inviteme:inviteme@localhost:5433/inviteme ADMIN_TOKEN=test npm run dev -w @inviteme/api
```

In un terzo terminale, il frontend (porta 3000):

```bash
npm run dev:web
```

## Test

Con l'API in esecuzione:

```bash
BASE_URL=http://localhost:4000 ADMIN_TOKEN=test npm run smoke -w @inviteme/api
```

Il test copre account, creazione e modifica degli inviti, caricamento e conversione dei file, anteprima, pagamento di prova, pagina pubblica, conferme e console admin.

Per i temi:

```bash
npm run test -w @inviteme/shared
npm run test -w @inviteme/api
npm run validate-theme -w @inviteme/api      # tutti i temi in themes/
```

## Console admin

Si apre su `/admin` con un account amministratore. Da lì si gestiscono modelli, funzioni e prezzi, attivazione dei temi, libreria musicale, ordini e utenti. I temi sono cartelle in `themes/`: si aggiungono con un rilascio oppure dalla console (Template → Carica un template) con uno ZIP nel formato di `docs/TEMI.md`, «Esportare lo stile per la console». La console li installa nella stessa cartella `themes/`, che il container dell'API usa direttamente (deve essere scrivibile dall'uid 1000). Un account diventa amministratore se la sua email coincide con `ADMIN_EMAIL`.

## Pagamenti (Shopify)

- Compila `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN` e `SHOPIFY_VARIANT_ID` per il checkout reale.
- Crea nel pannello Shopify un webhook `Ordini pagati` verso `https://<tuo-dominio>/api/webhooks/shopify` e imposta `SHOPIFY_WEBHOOK_SECRET`.
- Senza Shopify il pagamento non è possibile in produzione. Per le prove o una demo imposta `DEMO_MODE=true`: ogni acquisto va a buon fine, senza pagamento reale. Con Shopify configurato la demo è sempre spenta.

## Email

Con `RESEND_API_KEY` le email partono davvero. Senza, restano nella tabella `outbox` del database e non vengono inviate.

## Note di produzione

- I cookie di sessione sono `secure` in produzione: serve HTTPS. In locale con `http://localhost` i browser li accettano.
- Il servizio `web` è l'unico esposto. L'API e il database restano nella rete interna dei container.
- I brani caricati sono nel volume `media`: fai backup di quel volume insieme a `pgdata`.
