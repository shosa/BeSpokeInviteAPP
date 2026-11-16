// Cartella del matrimonio: catalogo delle sezioni e forma dei dati. Condiviso tra API (validazione) e interfaccia.
// Ogni sezione ha un tipo: programma con orari, contatti, checklist con spunte, oppure testo libero.
export const FOLDER_KINDS = ["timeline", "contacts", "checklist", "text"] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

export type FolderSection = { key: string; title: string; titleEn: string; group: string; kind: FolderKind; hint: string; hintEn: string; priority?: boolean };

export const FOLDER_GROUPS = [
  "Programmi",
  "Cerimonia e festa",
  "Persone",
  "Luoghi e logistica",
  "Decorazioni",
  "Cibo e bevande",
  "Foto e video",
  "Valigie",
  "Checklist",
] as const;

// Nomi inglesi dei gruppi della cartella.
export const FOLDER_GROUPS_EN: Record<(typeof FOLDER_GROUPS)[number], string> = {
  Programmi: "Schedules",
  "Cerimonia e festa": "Ceremony and party",
  Persone: "People",
  "Luoghi e logistica": "Places and logistics",
  Decorazioni: "Decorations",
  "Cibo e bevande": "Food and drink",
  "Foto e video": "Photo and video",
  Valigie: "Bags",
  Checklist: "Checklists",
};

export const FOLDER: FolderSection[] = [
  { key: "programma-generale", title: "Programma generale", group: "Programmi", kind: "timeline", hint: "Un momento per riga: orario e cosa succede", priority: true, titleEn: "Overall schedule", hintEn: "One moment per line: time and what happens" },
  { key: "programma-cerimonia", title: "Cerimonia", group: "Programmi", kind: "timeline", hint: "Dall'ingresso alla fine della cerimonia", titleEn: "Ceremony", hintEn: "From the entrance to the end of the ceremony" },
  { key: "programma-ricevimento", title: "Ricevimento e festa", group: "Programmi", kind: "timeline", hint: "Dall'aperitivo al taglio della torta", titleEn: "Reception and party", hintEn: "From the aperitif to cutting the cake" },
  { key: "programma-sposa", title: "Programma della sposa", group: "Programmi", kind: "timeline", hint: "La giornata della sposa, dal risveglio", titleEn: "Bride's schedule", hintEn: "The bride's day, from waking up" },
  { key: "programma-sposo", title: "Programma dello sposo", group: "Programmi", kind: "timeline", hint: "La giornata dello sposo", titleEn: "Groom's schedule", hintEn: "The groom's day" },
  { key: "programma-invitati", title: "Programma per gli invitati", group: "Programmi", kind: "timeline", hint: "Cosa devono sapere gli ospiti, in ordine", titleEn: "Schedule for guests", hintEn: "What guests need to know, in order" },
  { key: "trasporti", title: "Trasporti", group: "Programmi", kind: "timeline", hint: "Partenze e tragitti: ora e punto di partenza", titleEn: "Transport", hintEn: "Departures and routes: time and starting point" },
  { key: "ordine-cerimonia", title: "Ordine della cerimonia", group: "Cerimonia e festa", kind: "timeline", hint: "I passaggi in ordine, uno per riga", priority: true, titleEn: "Order of ceremony", hintEn: "The steps in order, one per line" },
  { key: "discorsi", title: "Discorsi e brindisi", group: "Cerimonia e festa", kind: "checklist", hint: "Chi parla e in che momento", titleEn: "Speeches and toasts", hintEn: "Who speaks and when" },
  { key: "musica", title: "Musica", group: "Cerimonia e festa", kind: "checklist", hint: "Canzoni per ogni momento della giornata", titleEn: "Music", hintEn: "Songs for every moment of the day" },
  { key: "intrattenimento", title: "Intrattenimento e spettacoli", group: "Cerimonia e festa", kind: "checklist", hint: "Attività e spettacoli previsti", titleEn: "Entertainment and shows", hintEn: "Planned activities and shows" },
  { key: "piano-b", title: "Se qualcosa va storto", group: "Cerimonia e festa", kind: "checklist", hint: "Cosa fare in caso di pioggia, ritardi, malori", titleEn: "If something goes wrong", hintEn: "What to do in case of rain, delays, illness" },
  { key: "chi-chiamare", title: "Chi chiamare", group: "Persone", kind: "contacts", hint: "I numeri utili il giorno del sì", priority: true, titleEn: "Who to call", hintEn: "Useful numbers on the day" },
  { key: "corteo", title: "Corteo e testimoni", group: "Persone", kind: "contacts", hint: "Testimoni e damigelle, con il loro ruolo", titleEn: "Wedding party and witnesses", hintEn: "Witnesses and bridesmaids, with their role" },
  { key: "famiglia", title: "Genitori e famiglia", group: "Persone", kind: "contacts", hint: "Famiglie e persone da avvisare", titleEn: "Parents and family", hintEn: "Families and people to keep informed" },
  { key: "fornitori", title: "Contatti dei fornitori", group: "Persone", kind: "contacts", hint: "Si compila nella scheda Fornitori del planner", titleEn: "Vendor contacts", hintEn: "Filled in from the planner's Vendors tab" },
  { key: "ringraziamenti", title: "Regali e ringraziamenti", group: "Persone", kind: "checklist", hint: "Chi ha fatto un regalo e chi ha ringraziato", titleEn: "Gifts and thank-yous", hintEn: "Who gave a gift and who has been thanked" },
  { key: "luoghi", title: "Luoghi chiave", group: "Luoghi e logistica", kind: "contacts", hint: "Chiesa, villa, parcheggi: nome, indirizzo, telefono", titleEn: "Key places", hintEn: "Church, venue, parking: name, address, phone" },
  { key: "alloggio", title: "Alloggio degli invitati", group: "Luoghi e logistica", kind: "checklist", hint: "Hotel e sistemazioni prenotate", titleEn: "Guest accommodation", hintEn: "Hotels and lodging booked" },
  { key: "noleggi", title: "Noleggi", group: "Luoghi e logistica", kind: "checklist", hint: "Sedie, tavoli, tende, attrezzature", titleEn: "Rentals", hintEn: "Chairs, tables, marquees, equipment" },
  { key: "consegne", title: "Consegne", group: "Luoghi e logistica", kind: "checklist", hint: "Fiori, decorazioni, torta: chi consegna cosa e quando", titleEn: "Deliveries", hintEn: "Flowers, decorations, cake: who delivers what and when" },
  { key: "allestimento", title: "Istruzioni di allestimento", group: "Decorazioni", kind: "checklist", hint: "Come montare la sala, passo per passo", titleEn: "Setup instructions", hintEn: "How to set up the room, step by step" },
  { key: "palette", title: "Palette e stile", group: "Decorazioni", kind: "text", hint: "Colori, materiali, stile del giorno", titleEn: "Palette and style", hintEn: "Colours, materials, style of the day" },
  { key: "menu", title: "Menu del ricevimento", group: "Cibo e bevande", kind: "checklist", hint: "Portate, allergie e vegetariani", titleEn: "Reception menu", hintEn: "Courses, allergies and vegetarians" },
  { key: "bevande", title: "Bevande e bar", group: "Cibo e bevande", kind: "checklist", hint: "Vini, birre, cocktail, analcolici", titleEn: "Drinks and bar", hintEn: "Wines, beers, cocktails, soft drinks" },
  { key: "lista-foto", title: "Lista delle foto", group: "Foto e video", kind: "checklist", hint: "Le foto da fare, una per riga", titleEn: "Shot list", hintEn: "The photos to take, one per line" },
  { key: "programma-foto", title: "Programma delle foto", group: "Foto e video", kind: "timeline", hint: "Dove e quando, con il fotografo", titleEn: "Photo schedule", hintEn: "Where and when, with the photographer" },
  { key: "valigia-sposa", title: "Valigia della sposa", group: "Valigie", kind: "checklist", hint: "Tutto il necessario per la sposa", titleEn: "Bride's bag", hintEn: "Everything the bride needs" },
  { key: "valigia-sposo", title: "Valigia dello sposo", group: "Valigie", kind: "checklist", hint: "Tutto il necessario per lo sposo", titleEn: "Groom's bag", hintEn: "Everything the groom needs" },
  { key: "kit-emergenza", title: "Kit di emergenza", group: "Valigie", kind: "checklist", hint: "Cerotti, ago e filo, medicine, caricatore", titleEn: "Emergency kit", hintEn: "Plasters, needle and thread, medicine, charger" },
  { key: "altre-cose", title: "Altre cose", group: "Valigie", kind: "checklist", hint: "Tutto quello che non rientra altrove", titleEn: "Other things", hintEn: "Everything that doesn't fit elsewhere" },
  { key: "prenotare", title: "Cosa prenotare e comprare", group: "Checklist", kind: "checklist", hint: "Le cose da fare in anticipo", titleEn: "What to book and buy", hintEn: "Things to do in advance" },
  { key: "ultima-settimana", title: "Ultima settimana", group: "Checklist", kind: "checklist", hint: "Le cose da fare negli ultimi sette giorni", titleEn: "Last week", hintEn: "Things to do in the last seven days" },
  { key: "dopo-matrimonio", title: "Dopo il matrimonio", group: "Checklist", kind: "checklist", hint: "Cambio nome, documenti, foto da ritirare", titleEn: "After the wedding", hintEn: "Name change, documents, photos to collect" },
];

export const FOLDER_KEYS = new Set(FOLDER.map((s) => s.key));

// Campi ammessi per riga, per tipo di sezione. Il resto viene scartato.
export const ROW_FIELDS: Record<Exclude<FolderKind, "text">, Record<string, "text" | "bool">> = {
  timeline: { time: "text", item: "text" },
  contacts: { name: "text", role: "text", phone: "text" },
  checklist: { text: "text", done: "bool" },
};

export const ROW_LIMIT = 80;
export const TEXT_LIMIT = 4000;
