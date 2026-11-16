import { ADDON_KEYS, isAddonKey, type AddonKey } from "../addons";
import { BACKGROUND_KINDS, sanitizeBackground, type BackgroundSpec } from "../background";

// Tipi dei campi e delle domande di conferma, condivisi da blocchi, API e builder.
// Uno stile (tema) è una cartella con theme.json (questo manifest), theme.css e assets/. Non contiene campi:
// i contenuti sono nei blocchi dell'invito (vedi blocks.ts).

export const ENGINE_VERSION = 2;

export const FIELD_TYPES = ["text", "longtext", "date", "time", "number", "url", "photo", "photos", "video", "audio", "list", "color", "choice", "toggle"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  help?: string;
  required?: boolean;
  max?: number; // caratteri per i testi, numero di elementi per photos e list, valore massimo per number
  default?: string | number | boolean;
  feature?: AddonKey; // il campo esiste solo se l'invito ha questa funzione
  item?: FieldDef[]; // solo per list: campi di ogni voce (niente liste dentro liste)
  options?: { value: string; label: string }[]; // solo per choice
};

export type RsvpQuestionType = "yes-no" | "text" | "number" | "choice";

export type RsvpQuestion = {
  id: string;
  label: string;
  type: RsvpQuestionType;
  required?: boolean;
  options?: string[]; // solo per choice
  yes?: string; // etichette del sì/no (solo per yes-no)
  no?: string;
};

// Manifest di uno stile: colori, font, CSS e il nome che vede il cliente.
export type ThemeManifest = {
  engine: typeof ENGINE_VERSION;
  id: string;
  name: string;
  description: string;
  // Nome e descrizione in inglese, per il sito in inglese. Obbligatori: ogni tema è bilingue.
  nameEn: string;
  descriptionEn: string;
  models: string[]; // modelli del catalogo che lo offrono; vuoto = tutti
  themeColor: string; // colore della barra del browser
  fonts: string[]; // fogli di stile di Google Fonts, soli URL https://fonts.googleapis.com/
  // Esempi per la demo e per le anteprime: per blocco, valori delle proprietà con percorsi "assets/…" del tema.
  demo: Record<string, Record<string, unknown>>;
  // Versione inglese degli esempi: per blocco, solo le proprietà da sostituire quando la demo è in inglese. Il resto viene da demo.
  demoEn?: Record<string, Record<string, unknown>>;
  // Sfondo animato proposto dallo stile (il cliente può cambiarlo o spegnerlo nel builder).
  background?: BackgroundSpec;
  // Busta-video: il filmato del tema apre l'invito al posto della busta disegnata. Il blocco Busta non ha proprietà.
  envelope?: { video: string; poster?: string };
  // Video di sfondo per zona: l'intestazione (hero) ha il suo, il resto del corpo un altro. Muti, in ciclo, scorrono con i blocchi.
  backgroundVideo?: { hero?: string; body?: string };
};

// Nomi riservati al motore: un campo o una proprietà con questo nome nasconderebbe un dato di sistema.
export const RESERVED = new Set(["features", "rsvp", "rsvpQuestions", "date", "theme", "meta", "config", "runtime", "slug", "locale", "baseAudio", "preview"]);

const KEY = /^[a-z][A-Za-z0-9]{0,39}$/;
const THEME_ID = /^[a-z0-9-]{2,40}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const FONT_URL = /^https:\/\/fonts\.googleapis\.com\/css2\?[^"'<>\s]{1,400}$/;

export type ManifestResult = { manifest: ThemeManifest | null; errors: string[] };

export function validateManifest(input: unknown, dir = "stile"): ManifestResult {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`${dir}: ${msg}`);
  if (!isRecord(input)) return { manifest: null, errors: [`${dir}: theme.json deve essere un oggetto`] };
  const x = input;

  const allowed = ["engine", "id", "name", "description", "nameEn", "descriptionEn", "models", "themeColor", "fonts", "demo", "background", "envelope", "backgroundVideo", "demoEn"];
  for (const k of Object.keys(x)) if (!allowed.includes(k)) err(`campo sconosciuto "${k}"`);
  if (x.engine !== ENGINE_VERSION) err(`engine deve essere ${ENGINE_VERSION}`);

  const id = typeof x.id === "string" && THEME_ID.test(x.id) ? x.id : null;
  if (!id) err("id: solo minuscole, numeri e trattini, da 2 a 40 caratteri");
  const name = typeof x.name === "string" && x.name.trim().length > 0 && x.name.length <= 60 ? x.name.trim() : null;
  if (!name) err("name: testo da 1 a 60 caratteri");
  const description = typeof x.description === "string" ? x.description.slice(0, 200) : "";
  // Inglese obbligatorio: nome, descrizione ed esempi (demoEn) servono al sito e alle anteprime in inglese.
  const nameEn = typeof x.nameEn === "string" && x.nameEn.trim().length > 0 && x.nameEn.length <= 60 ? x.nameEn.trim() : null;
  if (!nameEn) err("nameEn: nome inglese obbligatorio, da 1 a 60 caratteri");
  const descriptionEn = typeof x.descriptionEn === "string" && x.descriptionEn.trim().length > 0 && x.descriptionEn.length <= 200 ? x.descriptionEn.trim() : null;
  if (!descriptionEn) err("descriptionEn: descrizione inglese obbligatoria, da 1 a 200 caratteri");
  if (x.demoEn === undefined) err("demoEn: esempi in inglese obbligatori (per blocco, i testi da sostituire a quelli di demo)");
  const models = strings(x.models, "models", err, 4);
  const themeColor = typeof x.themeColor === "string" && HEX.test(x.themeColor) ? x.themeColor : "";
  if (!themeColor) err("themeColor: colore #RRGGBB");
  const fonts = strings(x.fonts, "fonts", err, 4).filter((f) => {
    if (FONT_URL.test(f)) return true;
    err(`fonts: URL non ammesso (${f.slice(0, 60)}). Solo https://fonts.googleapis.com/css2?...`);
    return false;
  });
  const demo = validateDemo(x.demo, err);
  const demoEn = x.demoEn === undefined ? undefined : validateDemo(x.demoEn, err);
  let background: BackgroundSpec | undefined;
  if (x.background !== undefined) {
    background = sanitizeBackground(x.background);
    if (!background) err(`background: tipo non valido (ammessi: ${BACKGROUND_KINDS.join(", ")}), colore #RRGGBB facoltativo`);
  }

  const VIDEO_FILE = /^assets\/[A-Za-z0-9._-]+\.(mp4|webm)$/;
  let backgroundVideo: { hero?: string; body?: string } | undefined;
  if (x.backgroundVideo !== undefined) {
    const v = isRecord(x.backgroundVideo) ? x.backgroundVideo : {};
    const hero = typeof v.hero === "string" && VIDEO_FILE.test(v.hero) ? v.hero : undefined;
    const body = typeof v.body === "string" && VIDEO_FILE.test(v.body) ? v.body : undefined;
    if (!isRecord(x.backgroundVideo) || (!hero && !body) || Object.keys(v).some((k) => k !== "hero" && k !== "body")) {
      err("backgroundVideo: { hero?: \"assets/nome.mp4\", body?: \"assets/nome.mp4\" } (almeno uno; mp4 o webm, senza audio)");
    } else backgroundVideo = { ...(hero ? { hero } : {}), ...(body ? { body } : {}) };
  }
  // Busta-video: il fotogramma iniziale (poster) è la busta ferma finché il filmato non parte.
  let envelope: { video: string; poster?: string } | undefined;
  if (x.envelope !== undefined) {
    const env = isRecord(x.envelope) ? x.envelope : {};
    const video = typeof env.video === "string" ? env.video : "";
    const poster = typeof env.poster === "string" ? env.poster : undefined;
    const posterOk = poster === undefined || /^assets\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(poster);
    if (/^assets\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(video) && posterOk) envelope = { video, ...(poster ? { poster } : {}) };
    else err("envelope: { video: \"assets/nome.mp4\", poster?: \"assets/nome.jpg\" } (filmato mp4 o webm del tema, senza audio; poster facoltativo)");
  }

  if (errors.length || !id || !name || !nameEn || !descriptionEn) return { manifest: null, errors };
  return {
    manifest: {
      engine: ENGINE_VERSION,
      id,
      name,
      description,
      nameEn,
      descriptionEn,
      models,
      themeColor,
      fonts,
      demo,
      ...(demoEn ? { demoEn } : {}),
      ...(background ? { background } : {}),
      ...(envelope ? { envelope } : {}),
      ...(backgroundVideo ? { backgroundVideo } : {}),
    },
    errors,
  };
}

// Campi dell'evento ammessi negli esempi della demo (sezione "event"): nomi, data, luogo, testi.
export const EVENT_DEMO_KEYS = ["title", "hosts", "eventDate", "eventTime", "venue", "address"];

// Demo: per blocco, solo proprietà di quel blocco; i file sono sempre asset del tema, mai percorsi esterni.
function validateDemo(input: unknown, err: (m: string) => void): Record<string, Record<string, unknown>> {
  if (input === undefined) return {};
  if (!isRecord(input)) { err("demo: oggetto con gli esempi per blocco"); return {}; }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [block, props] of Object.entries(input)) {
    if (!isRecord(props)) { err(`demo.${block}: oggetto con le proprietà`); continue; }
    out[block] = {};
    for (const [k, v] of Object.entries(props)) {
      if (RESERVED.has(k) || !KEY.test(k)) { err(`demo.${block}.${k}: nome non valido`); continue; }
      if (block === "event" && !EVENT_DEMO_KEYS.includes(k)) { err(`demo.event.${k}: campo dell'evento non ammesso`); continue; }
      if (typeof v === "string" && (v.includes("/") || v.includes("\\")) && !/^assets\/[A-Za-z0-9._-]+$/.test(v) && !/^https?:|^\/\//.test(v)) { err(`demo.${block}.${k}: percorso asset non valido (ammesso solo assets/nome.file)`); continue; }
      if (typeof v === "string" && /^https?:|^\/\//.test(v)) { err(`demo.${block}.${k}: niente URL esterni, solo assets/…`); continue; }
      out[block][k] = v;
    }
  }
  return out;
}

// Domande di conferma presenza: id, tipo e opzioni controllati. Usate sia nei default sia negli inviti.
export function sanitizeQuestions(input: unknown, where: string, errors: string[] = []): RsvpQuestion[] {
  if (!Array.isArray(input)) { errors.push(`${where}: elenco di domande`); return []; }
  const types: RsvpQuestionType[] = ["yes-no", "text", "number", "choice"];
  const out: RsvpQuestion[] = [];
  for (const raw of input.slice(0, 8)) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" && KEY.test(raw.id) ? raw.id : null;
    if (!id) { errors.push(`${where}: id domanda non valido (${String(raw.id)})`); continue; }
    const type = types.includes(raw.type as RsvpQuestionType) ? (raw.type as RsvpQuestionType) : "text";
    const q: RsvpQuestion = { id, label: typeof raw.label === "string" ? raw.label.slice(0, 160) : id, type };
    if (raw.required === true) q.required = true;
    if (type === "choice") q.options = strings(raw.options, `${where}.${id}.options`, (m) => errors.push(m), 6).map((o) => o.slice(0, 60));
    if (type === "yes-no") {
      q.yes = typeof raw.yes === "string" ? raw.yes.slice(0, 40) : "Sì";
      q.no = typeof raw.no === "string" ? raw.no.slice(0, 40) : "No";
    }
    out.push(q);
  }
  return out;
}

function strings(v: unknown, where: string, err: (m: string) => void, max: number): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) { err(`${where}: elenco di testi`); return []; }
  return v.slice(0, max);
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export { ADDON_KEYS };
