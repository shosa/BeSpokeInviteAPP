import type { AddonKey } from "./addons";
import type { FieldDef } from "./engine/manifest";

// Un invito è una lista ordinata di blocchi. Ogni blocco ha un tipo (il suo aspetto lo decide il template del blocco),
// proprietà proprie e può essere nascosto. I dati dell'evento (titolo, data, luogo…) sono globali e condivisi.

export const BLOCK_TYPES = [
  "cover",
  "hero",
  "scratchdate",
  "date",
  "countdown",
  "message",
  "gallery",
  "image",
  "program",
  "venue",
  "map",
  "transfer",
  "dresscode",
  "video",
  "music",
  "rsvp",
  "footer",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type BlockDef = {
  type: BlockType;
  label: string;
  description: string;
  feature?: AddonKey; // il blocco si può aggiungere solo se l'invito ha la funzione
  unique?: boolean; // al massimo uno per invito
  locked?: boolean; // non si elimina, non si sposta né si duplica
  anchored?: boolean; // sempre al primo posto, non spostabile (si può eliminare)
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  defaultsEn?: Record<string, unknown>; // testi di partenza in inglese (invito in lingua inglese)
};

// Dati dell'evento: validi per tutto l'invito. Nomi, riga sotto i nomi, data e ora si modificano nel blocco Intestazione.
export const HERO_EVENT_KEYS = ["title", "hosts", "eventDate", "eventTime"];
export const EVENT_FIELDS: FieldDef[] = [
  { key: "title", label: "Nomi o titolo", type: "text", group: "Evento", required: true, max: 80 },
  { key: "hosts", label: "Riga sotto i nomi", type: "text", group: "Evento", max: 120 },
  { key: "eventDate", label: "Data", type: "date", group: "Evento", required: true },
  { key: "eventTime", label: "Ora di inizio", type: "time", group: "Evento", required: true },
  { key: "address", label: "Indirizzo", type: "text", group: "Evento", max: 200 },
];

export const EVENT_DEFAULTS: Record<string, string> = {
  title: "Luca e Sara",
  hosts: "Con gioia, le famiglie",
  eventDate: "",
  eventTime: "16:00",
  venue: "",
  address: "",
};

// Un colore del dress code: il pallino e il suo nome (facoltativo, per chi legge con lo screen reader e per il ricordo).
const DRESS_COLOR: FieldDef[] = [
  { key: "hex", label: "Colore", type: "color", group: "Colore" },
  { key: "name", label: "Nome", type: "text", group: "Colore", max: 30 },
];

const PROGRAM_ITEM: FieldDef[] = [
  { key: "time", label: "Orario", type: "text", group: "Voce", max: 10 },
  { key: "label", label: "Che cosa", type: "text", group: "Voce", max: 80 },
];

export const BLOCKS: BlockDef[] = [
  {
    type: "cover",
    label: "Busta",
    description: "Copertina che si apre al tocco, con filmato e suono facoltativi.",
    unique: true,
    anchored: true,
    fields: [
      { key: "topText", label: "Testo sopra la busta", type: "text", group: "Busta", max: 80 },
      { key: "sealText", label: "Testo nel sigillo", type: "text", group: "Busta", max: 12 },
      { key: "envelopeColor", label: "Colore della busta", type: "color", group: "Busta" },
      { key: "sealColor", label: "Colore del sigillo", type: "color", group: "Busta" },
      { key: "coverVideo", label: "Filmato della busta (muto, max 90 s)", type: "video", group: "Busta" },
      { key: "tapBounce", label: "La scritta rimbalza", type: "toggle", group: "Busta", default: true },
      { key: "tapBackground", label: "Sfondo dietro la scritta", type: "toggle", group: "Busta", default: true },
    ],
    defaults: { topText: "", sealText: "", coverVideo: "", tapBounce: true, tapBackground: true },
    defaultsEn: {},
  },
  {
    type: "hero",
    label: "Intestazione",
    description: "Nomi, data e ora dell'evento, sottotitolo e foto principale.",
    unique: true,
    locked: true,
    fields: [
      { key: "kicker", label: "Testo sopra i nomi", type: "text", group: "Intestazione", max: 60 },
      { key: "occasion", label: "Sottotitolo", type: "text", group: "Intestazione", max: 60 },
      { key: "couplePhoto", label: "Foto principale", type: "photo", group: "Intestazione" },
    ],
    defaults: { kicker: "Con gioia", occasion: "Per sempre", couplePhoto: "" },
    defaultsEn: { kicker: "With joy", occasion: "Forever" },
  },
  {
    type: "scratchdate",
    label: "Data da grattare",
    description: "Giorno, mese e anno da scoprire con il dito.",
    unique: true,
    fields: [],
    defaults: {},
  },
  {
    type: "date",
    label: "Data",
    description: "Giorno, mese e anno in chiaro, sempre visibili.",
    unique: true,
    fields: [
      {
        key: "cellShape",
        label: "Forma dei campi",
        type: "choice",
        group: "Data",
        options: [
          { value: "box", label: "Riquadro" },
          { value: "round", label: "Cerchio" },
          { value: "pill", label: "Pillola" },
          { value: "plain", label: "Solo testo" },
        ],
      },
      { key: "showLabels", label: "Mostra le etichette", type: "toggle", group: "Data", default: true },
    ],
    defaults: { showLabels: true },
  },
  {
    type: "countdown",
    label: "Conto alla rovescia",
    description: "Giorni, ore, minuti e secondi alla data.",
    feature: "countdown",
    unique: true,
    fields: [],
    defaults: {},
  },
  {
    type: "message",
    label: "Messaggio",
    description: "Un testo libero con titolo.",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Testo", max: 80 },
      { key: "body", label: "Testo", type: "longtext", group: "Testo", max: 1200 },
    ],
    defaults: { heading: "Invito", body: "Abbiamo il piacere di invitarvi a festeggiare con noi." },
    defaultsEn: { heading: "Invitation", body: "We would love to celebrate with you." },
  },
  {
    type: "gallery",
    label: "Galleria",
    description: "Fino a sei foto in griglia.",
    feature: "gallery",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Galleria", max: 80 },
      { key: "photos", label: "Foto", type: "photos", group: "Galleria", max: 6 },
      {
        key: "galleryStyle",
        label: "Stile della galleria",
        type: "choice",
        group: "Galleria",
        options: [
          { value: "slider", label: "Slider" },
          { value: "mosaic", label: "Mosaico" },
          { value: "grid", label: "Griglia" },
        ],
      },
    ],
    defaults: { heading: "Noi due", photos: [] },
    defaultsEn: { heading: "Our story" },
  },
  {
    type: "image",
    label: "Immagine",
    description: "Una foto a larghezza piena, caricata o scelta da Pixabay, con didascalia facoltativa.",
    fields: [
      { key: "photo", label: "Foto", type: "photo", group: "Immagine" },
      { key: "caption", label: "Didascalia", type: "text", group: "Immagine", max: 120 },
    ],
    defaults: { photo: "", caption: "" },
  },
  {
    type: "program",
    label: "Programma",
    description: "Orari della giornata su una timeline.",
    feature: "program",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Programma", max: 80 },
      { key: "items", label: "Voci", type: "list", group: "Programma", max: 8, item: PROGRAM_ITEM },
    ],
    defaults: {
      heading: "Programma",
      items: [
        { time: "16:00", label: "Cerimonia" },
        { time: "18:00", label: "Aperitivo" },
        { time: "20:00", label: "Cena" },
      ],
    },
    defaultsEn: { heading: "Programme", items: [{ time: "16:00", label: "Ceremony" }, { time: "18:00", label: "Aperitif" }, { time: "20:00", label: "Dinner" }] },
  },
  {
    type: "venue",
    label: "Location",
    description: "Nome e tipo del luogo; l'indirizzo si imposta nella Mappa.",
    unique: true,
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Location", max: 80 },
      { key: "venue", label: "Nome del luogo", type: "text", group: "Location", max: 120 },
      {
        key: "kind",
        label: "Tipo",
        type: "choice",
        group: "Location",
        options: [
          { value: "villa", label: "Villa" },
          { value: "chiesa", label: "Chiesa" },
          { value: "ristorante", label: "Ristorante" },
          { value: "giardino", label: "Giardino" },
          { value: "hotel", label: "Hotel" },
          { value: "sala", label: "Sala ricevimenti" },
          { value: "spiaggia", label: "Spiaggia" },
          { value: "altro", label: "Altro" },
        ],
      },
      { key: "photo", label: "Foto del luogo", type: "photo", group: "Location" },
    ],
    defaults: { heading: "Dove", venue: "", kind: "", photo: "" },
    defaultsEn: { heading: "Where" },
  },
  {
    type: "map",
    label: "Mappa",
    description: "Mappa del luogo con il link alle indicazioni.",
    feature: "map",
    unique: true,
    fields: [
      {
        key: "mapShape",
        label: "Forma della mappa",
        type: "choice",
        group: "Mappa",
        options: [
          { value: "theme", label: "Come lo stile" },
          { value: "square", label: "Quadrato" },
          { value: "arch", label: "Arco" },
          { value: "circle", label: "Cerchio" },
          { value: "rounded", label: "Angoli arrotondati" },
        ],
      },
    ],
    defaults: { mapShape: "theme" },
  },
  {
    type: "transfer",
    label: "Come arrivare",
    description: "Navetta, parcheggio, indicazioni.",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Come arrivare", max: 80 },
      { key: "body", label: "Indicazioni", type: "longtext", group: "Come arrivare", max: 800 },
    ],
    defaults: { heading: "Come arrivare", body: "" },
    defaultsEn: { heading: "How to get there", body: "" },
  },
  {
    type: "dresscode",
    label: "Dress code",
    description: "Un abbigliamento richiesto, in evidenza.",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Dress code", max: 80 },
      { key: "dress", label: "Dress code", type: "text", group: "Dress code", max: 60 },
      { key: "colors", label: "Colori", type: "list", group: "Dress code", max: 6, item: DRESS_COLOR },
    ],
    defaults: {
      heading: "Dress code",
      dress: "Black tie",
      colors: [{ hex: "#1d1b19", name: "Nero" }, { hex: "#ffffff", name: "Bianco" }, { hex: "#b8924a", name: "Oro" }],
    },
    defaultsEn: {
      heading: "Dress code",
      dress: "Black tie",
      colors: [{ hex: "#1d1b19", name: "Black" }, { hex: "#ffffff", name: "White" }, { hex: "#b8924a", name: "Gold" }],
    },
  },
  {
    type: "video",
    label: "Video",
    description: "Un video muto in loop, che parte quando entra nello schermo.",
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Video", max: 80 },
      { key: "video", label: "Video (muto, max 90 s)", type: "video", group: "Video" },
    ],
    defaults: { heading: "Un assaggio", video: "" },
    defaultsEn: { heading: "A taste of the day" },
  },
  {
    type: "music",
    label: "Musica",
    description: "Musica di sottofondo: parte quando la busta si apre, con un pulsante per fermarla.",
    feature: "music",
    unique: true,
    fields: [{ key: "music", label: "Brano (mp3, max 6 MB)", type: "audio", group: "Musica" }],
    defaults: { music: "" },
    defaultsEn: { music: "" },
  },
  {
    type: "rsvp",
    label: "Conferma di presenza",
    description: "Modulo di risposta in popup, con le domande configurate.",
    feature: "rsvp",
    unique: true,
    fields: [
      { key: "heading", label: "Titolo", type: "text", group: "Conferma", max: 80 },
      { key: "intro", label: "Testo introduttivo", type: "longtext", group: "Conferma", max: 300 },
    ],
    defaults: { heading: "Conferma la tua presenza", intro: "Ti chiediamo gentilmente di confermare la tua presenza." },
    defaultsEn: { heading: "Confirm your attendance", intro: "Please let us know whether you will be able to join us." },
  },
  {
    type: "footer",
    label: "Firma",
    description: "Firma in fondo alla pagina.",
    unique: true,
    fields: [{ key: "signature", label: "Firma", type: "text", group: "Firma", max: 80 }],
    defaults: { signature: "Luca e Sara" },
    defaultsEn: { signature: "With love" },
  },
];

export type BlockInstance = {
  id: string;
  type: BlockType;
  hidden?: boolean;
  props: Record<string, unknown>;
};

export const blockDef = (type: string): BlockDef | undefined => BLOCKS.find((b) => b.type === type);
// Blocchi che non cambiano posizione: il principale e la busta.
export const isFixedPosition = (type: string): boolean => !!(blockDef(type)?.locked || blockDef(type)?.anchored);

// Blocchi di partenza per un nuovo invito. L'ordine è quello della pagina.
// Aspetto: ogni blocco può cambiare sfondo e colore del testo. La data da grattare aggiunge forma e colore della copertura.
// Un valore vuoto vale il colore del tema, quindi un invito senza modifiche resta identico a prima.
const LOOK_FIELDS: FieldDef[] = [
  { key: "lookBg", label: "Colore di sfondo", type: "color", group: "Aspetto" },
  { key: "lookInk", label: "Colore del testo", type: "color", group: "Aspetto" },
];
const SCRATCH_LOOK: FieldDef[] = [
  {
    key: "lookShape",
    label: "Forma delle caselle",
    type: "choice",
    group: "Aspetto",
    options: [
      { value: "square", label: "Squadrata" },
      { value: "round", label: "Ovale" },
      { value: "pill", label: "Pillola" },
    ],
  },
  { key: "lookCover", label: "Colore della copertura", type: "color", group: "Aspetto" },
];
for (const b of BLOCKS) {
  if (b.type === "music") continue; // il lettore audio non ha superfici da colorare
  if (b.type === "cover") continue; // la busta ha i suoi colori (busta e sigillo): il motore non applica l'aspetto alla copertura
  b.fields = [...b.fields, ...LOOK_FIELDS, ...(b.type === "scratchdate" ? SCRATCH_LOOK : [])];
}
// Forma della foto: predefinite, scelte dal cliente per ogni blocco che mostra una o più foto.
const PHOTO_SHAPE: FieldDef = {
  key: "photoShape",
  label: "Forma della foto",
  type: "choice",
  group: "Foto",
  options: [
    { value: "arch", label: "Arco" },
    { value: "circle", label: "Cerchio" },
    { value: "oval", label: "Ovale" },
    { value: "rounded", label: "Angoli arrotondati" },
    { value: "diamond", label: "Rombo" },
    { value: "hexagon", label: "Esagono" },
  ],
};
// Adattamento: intera (senza ritagli, con lo sfondo intorno) oppure riempi (ritaglia i bordi). Predefinito: quello del tema.
const PHOTO_FIT: FieldDef = {
  key: "photoFit",
  label: "Adattamento della foto",
  type: "choice",
  group: "Foto",
  options: [
    { value: "contain", label: "Intera, senza ritagli" },
    { value: "cover", label: "Riempi, ritaglia i bordi" },
  ],
};
// Centratura: quale parte della foto resta visibile quando viene ritagliata.
const PHOTO_FOCUS: FieldDef = {
  key: "photoFocus",
  label: "Centratura della foto",
  type: "choice",
  group: "Foto",
  options: [
    { value: "center", label: "Al centro" },
    { value: "top", label: "In alto" },
    { value: "bottom", label: "In basso" },
    { value: "left", label: "A sinistra" },
    { value: "right", label: "A destra" },
  ],
};
for (const b of BLOCKS) {
  if (b.fields.some((f) => f.type === "photo" || f.type === "photos")) b.fields = [...b.fields, PHOTO_SHAPE, PHOTO_FIT, PHOTO_FOCUS];
}

// Testi che il motore mette nei blocchi (etichette): diventano campi modificabili, già compilati con il testo attuale.
type LabelDef = { key: string; tKey: string; label: string; it: string; en: string };
const DATE_LABELS: LabelDef[] = [
  { key: "dateTitle", tKey: "dateTitle", label: "Titolo della data", it: "La data", en: "The date" },
  { key: "dayLabel", tKey: "dayLabel", label: "Etichetta del giorno", it: "Giorno", en: "Day" },
  { key: "monthLabel", tKey: "monthLabel", label: "Etichetta del mese", it: "Mese", en: "Month" },
  { key: "yearLabel", tKey: "yearLabel", label: "Etichetta dell'anno", it: "Anno", en: "Year" },
];
export const BLOCK_LABELS: Partial<Record<BlockType, LabelDef[]>> = {
  cover: [{ key: "tapLabel", tKey: "tapToOpen", label: "Testo per aprire la busta", it: "Tocca per aprire", en: "Tap to open" }],
  hero: [{ key: "scrollLabel", tKey: "scrollDown", label: "Testo per scorrere", it: "Scorri", en: "Scroll" }],
  date: DATE_LABELS.filter((l) => l.key === "dateTitle"),
  scratchdate: [...DATE_LABELS, { key: "revealLabel", tKey: "revealAll", label: "Testo per scoprire la data", it: "Scopri la data", en: "Reveal the date" }],
  rsvp: [
    { key: "openLabel", tKey: "rsvpOpen", label: "Testo per aprire la conferma", it: "Clicca per aprire", en: "Click to open" },
    { key: "submitLabel", tKey: "rsvpSubmit", label: "Testo del pulsante di invio", it: "Invia", en: "Send" },
    { key: "thanksLabel", tKey: "rsvpThanks", label: "Titolo del ringraziamento", it: "Grazie di cuore!", en: "Thank you!" },
  ],
};
for (const def of BLOCKS) {
  const labels = BLOCK_LABELS[def.type];
  if (!labels) continue;
  def.fields = [...def.fields, ...labels.map((l) => ({ key: l.key, label: l.label, type: "text" as const, group: "Testi", max: 120 }))];
  def.defaults = { ...def.defaults, ...Object.fromEntries(labels.map((l) => [l.key, l.it])) };
  def.defaultsEn = { ...(def.defaultsEn ?? {}), ...Object.fromEntries(labels.map((l) => [l.key, l.en])) };
}

export const DEFAULT_BLOCKS: BlockType[] = ["cover", "hero", "scratchdate", "countdown", "message", "program", "venue", "map", "transfer", "dresscode", "rsvp", "footer"];

let counter = 0;
export function newBlockId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeBlock(type: BlockType, locale: "it" | "en" = "it"): BlockInstance {
  const def = blockDef(type);
  if (!def) throw new Error(`blocco sconosciuto: ${type}`);
  const base = locale === "en" && def.defaultsEn ? def.defaultsEn : def.defaults;
  return { id: newBlockId(), type, props: JSON.parse(JSON.stringify(base)) };
}

// Blocchi di partenza di un nuovo invito: quelli previsti dalla demo dello stile, nello stesso ordine e con gli stessi scambi
// (es. data da grattare al posto della data). Busta e intestazione ci sono sempre. Le funzioni non acquistate restano fuori.
export function templateBlocks(demo: Record<string, unknown> | undefined, features: ReadonlySet<AddonKey> | AddonKey[]): BlockInstance[] {
  if (!demo) return defaultBlocks(features);
  const has = (k?: AddonKey) => !k || (Array.isArray(features) ? features.includes(k) : features.has(k));
  const swap = (demo.blockSwap ?? {}) as Record<string, string>;
  const dropped = new Set<string>(["date", ...Object.values(swap)]);
  const out = BLOCKS.filter((d) => !dropped.has(d.type) && (d.locked || d.anchored || d.type in demo))
    .filter((d) => has(d.feature))
    .map((d) => {
      // Stesse proprietà della pagina demo: foto, testi e voci dichiarati dallo stile per quel blocco.
      const type = (swap[d.type] ?? d.type) as BlockType;
      const block = makeBlock(type);
      const styled = demo[type];
      if (styled && typeof styled === "object") block.props = { ...block.props, ...JSON.parse(JSON.stringify(styled)) };
      return block;
    });
  return out.length ? out : defaultBlocks(features);
}

export function defaultBlocks(features: ReadonlySet<AddonKey> | AddonKey[]): BlockInstance[] {
  const has = (k?: AddonKey) => !k || (Array.isArray(features) ? features.includes(k) : features.has(k));
  return DEFAULT_BLOCKS.map((t) => blockDef(t)!).filter((d) => has(d.feature)).map((d) => makeBlock(d.type));
}
