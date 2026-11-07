// Cartella del matrimonio: catalogo delle sezioni e forma dei dati. Condiviso tra API (validazione) e interfaccia.
// Ogni sezione ha un tipo: programma con orari, contatti, checklist con spunte, oppure testo libero.
export const FOLDER_KINDS = ["timeline", "contacts", "checklist", "text"] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

export type FolderSection = { key: string; title: string; group: string; kind: FolderKind; hint: string; priority?: boolean };

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

export const FOLDER: FolderSection[] = [
  { key: "programma-generale", title: "Programma generale", group: "Programmi", kind: "timeline", hint: "Un momento per riga: orario e cosa succede", priority: true },
  { key: "programma-cerimonia", title: "Cerimonia", group: "Programmi", kind: "timeline", hint: "Dall'ingresso alla fine della cerimonia" },
  { key: "programma-ricevimento", title: "Ricevimento e festa", group: "Programmi", kind: "timeline", hint: "Dall'aperitivo al taglio della torta" },
  { key: "programma-sposa", title: "Programma della sposa", group: "Programmi", kind: "timeline", hint: "La giornata della sposa, dal risveglio" },
  { key: "programma-sposo", title: "Programma dello sposo", group: "Programmi", kind: "timeline", hint: "La giornata dello sposo" },
  { key: "programma-invitati", title: "Programma per gli invitati", group: "Programmi", kind: "timeline", hint: "Cosa devono sapere gli ospiti, in ordine" },
  { key: "trasporti", title: "Trasporti", group: "Programmi", kind: "timeline", hint: "Partenze e tragitti: ora e punto di partenza" },
  { key: "ordine-cerimonia", title: "Ordine della cerimonia", group: "Cerimonia e festa", kind: "timeline", hint: "I passaggi in ordine, uno per riga", priority: true },
  { key: "discorsi", title: "Discorsi e brindisi", group: "Cerimonia e festa", kind: "checklist", hint: "Chi parla e in che momento" },
  { key: "musica", title: "Musica", group: "Cerimonia e festa", kind: "checklist", hint: "Canzoni per ogni momento della giornata" },
  { key: "intrattenimento", title: "Intrattenimento e spettacoli", group: "Cerimonia e festa", kind: "checklist", hint: "Attività e spettacoli previsti" },
  { key: "piano-b", title: "Se qualcosa va storto", group: "Cerimonia e festa", kind: "checklist", hint: "Cosa fare in caso di pioggia, ritardi, malori" },
  { key: "chi-chiamare", title: "Chi chiamare", group: "Persone", kind: "contacts", hint: "I numeri utili il giorno del sì", priority: true },
  { key: "corteo", title: "Corteo e testimoni", group: "Persone", kind: "contacts", hint: "Testimoni e damigelle, con il loro ruolo" },
  { key: "famiglia", title: "Genitori e famiglia", group: "Persone", kind: "contacts", hint: "Famiglie e persone da avvisare" },
  { key: "fornitori", title: "Contatti dei fornitori", group: "Persone", kind: "contacts", hint: "Si compila nella scheda Fornitori del planner" },
  { key: "ringraziamenti", title: "Regali e ringraziamenti", group: "Persone", kind: "checklist", hint: "Chi ha fatto un regalo e chi ha ringraziato" },
  { key: "luoghi", title: "Luoghi chiave", group: "Luoghi e logistica", kind: "contacts", hint: "Chiesa, villa, parcheggi: nome, indirizzo, telefono" },
  { key: "alloggio", title: "Alloggio degli invitati", group: "Luoghi e logistica", kind: "checklist", hint: "Hotel e sistemazioni prenotate" },
  { key: "noleggi", title: "Noleggi", group: "Luoghi e logistica", kind: "checklist", hint: "Sedie, tavoli, tende, attrezzature" },
  { key: "consegne", title: "Consegne", group: "Luoghi e logistica", kind: "checklist", hint: "Fiori, decorazioni, torta: chi consegna cosa e quando" },
  { key: "allestimento", title: "Istruzioni di allestimento", group: "Decorazioni", kind: "checklist", hint: "Come montare la sala, passo per passo" },
  { key: "palette", title: "Palette e stile", group: "Decorazioni", kind: "text", hint: "Colori, materiali, stile del giorno" },
  { key: "menu", title: "Menu del ricevimento", group: "Cibo e bevande", kind: "checklist", hint: "Portate, allergie e vegetariani" },
  { key: "bevande", title: "Bevande e bar", group: "Cibo e bevande", kind: "checklist", hint: "Vini, birre, cocktail, analcolici" },
  { key: "lista-foto", title: "Lista delle foto", group: "Foto e video", kind: "checklist", hint: "Le foto da fare, una per riga" },
  { key: "programma-foto", title: "Programma delle foto", group: "Foto e video", kind: "timeline", hint: "Dove e quando, con il fotografo" },
  { key: "valigia-sposa", title: "Valigia della sposa", group: "Valigie", kind: "checklist", hint: "Tutto il necessario per la sposa" },
  { key: "valigia-sposo", title: "Valigia dello sposo", group: "Valigie", kind: "checklist", hint: "Tutto il necessario per lo sposo" },
  { key: "kit-emergenza", title: "Kit di emergenza", group: "Valigie", kind: "checklist", hint: "Cerotti, ago e filo, medicine, caricatore" },
  { key: "altre-cose", title: "Altre cose", group: "Valigie", kind: "checklist", hint: "Tutto quello che non rientra altrove" },
  { key: "prenotare", title: "Cosa prenotare e comprare", group: "Checklist", kind: "checklist", hint: "Le cose da fare in anticipo" },
  { key: "ultima-settimana", title: "Ultima settimana", group: "Checklist", kind: "checklist", hint: "Le cose da fare negli ultimi sette giorni" },
  { key: "dopo-matrimonio", title: "Dopo il matrimonio", group: "Checklist", kind: "checklist", hint: "Cambio nome, documenti, foto da ritirare" },
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
