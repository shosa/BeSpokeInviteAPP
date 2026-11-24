# Bespoke Invites — Product context

## Cosa è
Bespoke Invites è un servizio di creazione di inviti digitali. L'utente sceglie un modello per tipologia di evento, lo personalizza con un builder visuale e un configuratore, paga online e ottiene un link condiviso (WhatsApp, email, social, QR code) con RSVP integrato.

Riferimento funzionale (non visivo): webgencyinvitations.com. Replichiamo tipologie di evento, flusso builder/configuratore e modello di consegna. Il design, il copy, i nomi dei template e gli asset sono originali di Bespoke Invites: non copiamo layout, immagini o marchi del sito di riferimento.

## Utenti
- **Sposi e fidanzati** che vogliono un invito elegante e condivisibile con molti ospiti, senza pagare carta e stampa.
- **Genitori e organizzatori di feste private** (compleanni, baby shower) con poco tempo e poca competenza di design.
- **Responsabili eventi aziendali e laureati** che devono mandare inviti rapidi e professionali.
- **Wedding planner** che gestiscono più clienti e vogliono una commissione di referral.

Bisogno principale: creare un invito bello in poche decine di minuti, senza design skill, e riceverlo in tempi brevi (consegna standard 4–7 giorni).

## Modalità
**Persuade** per landing, gallery template e pricing. **Operate** per builder e configuratore (scansione chiara, controlli prevedibili, anteprima sempre visibile). **Experience** per la pagina invito pubblica: l'invito è protagonista, l'interfaccia si ritira.

## Vincoli
- **Shopify headless**: prodotti, checkout, pagamenti e ordini passano da Shopify (Storefront API + webhook). Le metriche arrivano da Shopify (Admin API / webhook) e dagli eventi di Bespoke Invites.
- **Multi-paese, multi-valuta**: prezzi per mercato tramite i mercati di Shopify. Lingue iniziali: italiano e inglese.
- **Tipologie v1**: matrimoni (con anniversari e fidanzamenti come varianti), compleanni e baby shower, eventi aziendali e lauree.
- **Stack**: Next.js + TypeScript.
- **Invito live fino a data evento + 2 mesi**, come nel modello di riferimento.
- **Ospiti illimitati**: un solo link per tutti gli ospiti.
- **RSVP**: domande configurabili; le risposte sono consultabili e esportabili.

## Ipotesi dichiarate (da validare)
- Il prezzo base parte da 65 € (dato del riferimento; da confermare per il nostro listino).
- Il modello è pagamento unico, senza costi per ospite.
- Non usiamo stampa cartacea nella v1.
- Nessun dato di analytics di terzi senza consenso esplicito (privacy by default).
- Accessibilità WCAG 2.2 AA per builder e pagine invito.

## Stato etico
Massima protezione utente: niente urgenza falsa, niente recensioni inventate, niente pre-selezione di consensi marketing, cancellazione e modifica sempre possibili fino alla data evento, dati ospiti minimi e cancellabili.

## Successo
- Tempo medio dal primo accesso al link pronto: sotto 20 minuti.
- Completamento ordine dal builder: misurato su Shopify.
- Tasso di RSVP ricevuti per invito.
- Referral attivi tra wedding planner.
