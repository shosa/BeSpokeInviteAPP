# Piano: vendita su Shopify, builder su Bespoke Invite

Stato: **proposta, in attesa di approvazione** (fase 1 non ancora avviata).

## Idea

Shopify è il negozio e il registratore del pagamento: incassa, gestisce fatture, IVA, rimborsi ed email di conferma.
Bespoke Invite è il builder: il cliente lo apre dopo l'acquisto con un link personale legato all'ordine.

## Fasi

Una fase alla volta. Ogni fase va approvata prima di partire (CLAUDE.md).

### Fase 1: prezzi coerenti con Shopify

Problema oggi: Shopify addebita il prezzo fisso della variante (`SHOPIFY_VARIANT_ID`), non quello scelto in Bespoke Invite.

- Una variante Shopify per modello: Invito Base, Invito Smart, Su misura.
- Ogni funzione a pagamento è una riga separata nel carrello, con la sua variante.
- Mappa `modello/addon → id variante` ricavata dal catalogo. `SHOPIFY_VARIANT_ID` resta solo come fallback.
- Prima del redirect il server legge il totale del carrello (Storefront API) e lo confronta con `totalCents`. Se non coincide, blocca il pagamento.
- Verifica: test unitari sulla mappa e sul confronto dei totali; carrello di prova via Storefront API, senza ordini reali.
- Deploy solo dopo approvazione.

Da decidere: chi crea le varianti in Shopify (Stefano dal pannello, oppure token Admin API in `.env`, mai in chat). Preferenza: pannello.

### Fase 2: token opaco legato all'ordine

- Il webhook `orders/paid` crea un token casuale e lo salva in DB solo come hash, legato all'ordine Shopify, con scadenza.
- Nessun id d'ordine nel link.
- Alla prima apertura il cliente fa login (Google o email). L'invito si lega a quell'account.
- Il link inoltrato a terzi non dà accesso senza login.

### Fase 3: consegna del link

- Email con il link (via Resend, già configurato).
- Link nella pagina dell'ordine Shopify (metafield o note dell'ordine, da valutare).
- Il link non dipende dal browser del cliente dopo il pagamento.

### Fase 4: revoca su rimborso

- Webhook `refunds/create` (o `orders/updated`).
- Il rimborso revoca il token e blocca la modifica dell'invito.

### Fase 5: test end-to-end

- Flusso completo con `ALLOW_LOCAL_CHECKOUT` prima di qualsiasi ordine reale.
- Solo dopo: attivazione sul negozio di produzione, con conferma esplicita di Stefano.

## Rischi

- Disallineamento prezzi: coperto dal confronto della fase 1.
- Link condiviso: coperto dal login della fase 2.
- Rimborso senza revoca: coperto dalla fase 4. Fino ad allora il builder resta aperto a chi ha pagato.
- Webhook non ricevuto: il token va rigenerabile da una richiesta autenticata dell'ordine (da definire in fase 2).

## Decisioni aperte

1. Varianti: create da Stefano nel pannello (proposta) oppure via Admin API.
2. Email del link: sì (proposta).
3. Sincronizzazione catalogo da Shopify: non in questo piano, rimandata.
