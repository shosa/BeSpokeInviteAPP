import { EVENT_TYPES, activeFeatures, enabledModels, enabledThemes, getModel, getTheme, type Catalog, type EventType } from "./catalog";
import type { AddonKey } from "./addons";
import { sanitizeValues } from "./engine/values";
import { sanitizeQuestions, type RsvpQuestion, type ThemeManifest } from "./engine/manifest";
import { BLOCK_TYPES, EVENT_DEFAULTS, EVENT_FIELDS, HERO_EVENT_KEYS, blockDef, defaultBlocks, makeBlock, newBlockId, templateBlocks, type BlockInstance, type BlockType } from "./blocks";
import { sanitizeFontMap } from "./fonts";
import { sanitizeBackground, type BackgroundSpec } from "./background";

export type { RsvpQuestion } from "./engine/manifest";
export type { BlockInstance, BlockType } from "./blocks";

// Configurazione di un invito: dati dell'evento, lista ordinata di blocchi, domande di conferma.
// `themeId` è lo stile (colori, font, CSS). Il contenuto è tutto nei blocchi.
export type InviteConfig = {
  themeId: string;
  model: string;
  addons: AddonKey[]; // solo funzioni acquistabili per il modello
  eventType: EventType;
  locale: "it" | "en";
  event: Record<string, unknown>; // titolo, nomi, data, ora, luogo, indirizzo
  blocks: BlockInstance[];
  rsvpQuestions: RsvpQuestion[];
  background?: BackgroundSpec; // sfondo animato scelto dal cliente; assente = quello proposto dallo stile
};

// Regole dell'invito acquistato: si modifica finché non si conferma; dopo l'acquisto il template non cambia più.
// Usata sia dalla modifica dell'invito sia dall'assistente del builder: non duplicare la logica altrove.
export function editRules(inv: { status: string; edit_count: number }): { readOnly: boolean; themeLocked: boolean } {
  const paid = inv.status === "paid";
  return { readOnly: paid && inv.edit_count >= 1, themeLocked: paid };
}

// Lo slug del link: minuscole, numeri e trattini, da 3 a 60 caratteri, senza trattini agli estremi.
export function normalizeSlug(input: unknown): string | null {
  const s = String(input ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(s) || s.includes("--")) return null;
  return s;
}

export const MAX_BLOCKS = 30;

// Domande di partenza per la conferma di presenza.
export const DEFAULT_RSVP: RsvpQuestion[] = [
  { id: "name", label: "Nome e cognome", type: "text", required: true },
  { id: "attending", label: "Parteciperai?", type: "yes-no", required: true, yes: "Sì, con piacere", no: "Purtroppo non posso" },
  { id: "guests", label: "Numero di persone (compreso te)", type: "number" },
  { id: "note", label: "Un messaggio per gli sposi", type: "text" },
];

// Stesse domande in inglese, per gli inviti con lingua della pagina inglese.
export const DEFAULT_RSVP_EN: RsvpQuestion[] = [
  { id: "name", label: "Full name", type: "text", required: true },
  { id: "attending", label: "Will you attend?", type: "yes-no", required: true, yes: "Yes, with pleasure", no: "Sorry, I cannot" },
  { id: "guests", label: "Number of people (including you)", type: "number" },
  { id: "note", label: "A message for the hosts", type: "text" },
];

// Domanda che dice se l'ospite viene: quella con id "attending" (domande di partenza), altrimenti la prima sì/no.
// Gli inviti con domande personalizzate hanno id come "q2": cercare solo "attending" li leggeva tutti come assenti.
export function attendanceQuestion(questions: RsvpQuestion[]): RsvpQuestion | undefined {
  return questions.find((q) => q.id === "attending" && q.type === "yes-no") ?? questions.find((q) => q.type === "yes-no");
}

// Domanda sul numero di persone: id "guests", altrimenti la prima domanda numerica.
export function partySizeQuestion(questions: RsvpQuestion[]): RsvpQuestion | undefined {
  return questions.find((q) => q.id === "guests" && q.type === "number") ?? questions.find((q) => q.type === "number");
}

// Presenza dichiarata in una risposta: true, false, o null se l'invito non chiede la presenza.
export function attendanceOf(questions: RsvpQuestion[], answers: Record<string, unknown>): boolean | null {
  const q = attendanceQuestion(questions);
  if (!q) return null;
  const v = answers[q.id];
  return v === true ? true : v === false ? false : null;
}

// Persone in una risposta positiva: il numero dichiarato (almeno 1), altrimenti 1.
export function partySizeOf(questions: RsvpQuestion[], answers: Record<string, unknown>): number {
  const q = partySizeQuestion(questions);
  const n = q ? Number(answers[q.id]) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
}

export function defaultRsvp(locale: "it" | "en"): RsvpQuestion[] {
  return locale === "en" ? DEFAULT_RSVP_EN : DEFAULT_RSVP;
}

// Config di partenza per un nuovo invito, con i blocchi che le funzioni del modello abilitano.
export function defaultConfig(theme: ThemeManifest, model: string, eventType: EventType = "wedding", features: ReadonlySet<AddonKey> = new Set()): InviteConfig {
  const type = EVENT_TYPES.find((e) => e.id === eventType) ?? EVENT_TYPES[0];
  const event: Record<string, unknown> = { ...EVENT_DEFAULTS, title: type.sampleTitle };
  event.eventDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10);
  return {
    themeId: theme.id,
    model,
    addons: [],
    eventType,
    locale: "it",
    event,
    blocks: templateBlocks(theme.demo, features),
    rsvpQuestions: DEFAULT_RSVP,
  };
}

export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "invito"}-${Math.random().toString(36).slice(2, 7)}`;
}

// Valida e normalizza la configurazione ricevuta dal client: nessun campo è fidato.
// Ritorna null se lo stile o il modello non sono disponibili.
export function sanitizeConfig(c: Catalog, input: unknown): InviteConfig | null {
  if (!input || typeof input !== "object") return null;
  const x = input as Record<string, unknown>;
  const locale: "it" | "en" = x.locale === "en" ? "en" : "it";
  const models = enabledModels(c);
  if (models.length === 0) return null;
  const model = getModel(c, String(x.model)) ? String(x.model) : models[0].id;
  const theme = getTheme(c, String(x.themeId), model) ?? enabledThemes(c, model)[0];
  if (!theme) return null;

  const options = getModel(c, model)?.options ?? [];
  const selected = Array.isArray(x.addons)
    ? [...new Set(x.addons.filter((a): a is AddonKey => typeof a === "string" && options.includes(a as AddonKey)))]
    : [];
  const features = activeFeatures(c, model, selected);
  const eventType = EVENT_TYPES.some((e) => e.id === x.eventType) ? (x.eventType as EventType) : "wedding";

  const blocks = sanitizeBlocks(x.blocks, features);
  const hasForm = blocks.some((b) => b.type === "rsvp") && features.has("rsvp");
  const questions = hasForm ? sanitizeQuestions(x.rsvpQuestions, "rsvpQuestions") : [];
  const background = sanitizeBackground(x.background);

  return {
    themeId: theme.id,
    model,
    addons: selected,
    eventType,
    locale,
    event: sanitizeValues(EVENT_FIELDS, x.event, features),
    blocks,
    rsvpQuestions: questions.length ? questions : hasForm ? defaultRsvp(locale) : [],
    ...(background ? { background } : {}),
  };
}

// Blocchi: solo tipi noti, funzioni acquistate, blocchi unici, proprietà ripulite, al massimo MAX_BLOCKS.
export function sanitizeBlocks(input: unknown, features: ReadonlySet<AddonKey>): BlockInstance[] {
  if (!Array.isArray(input)) return [];
  const out: BlockInstance[] = [];
  const seen = new Set<string>();
  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const y = raw as Record<string, unknown>;
    const type = (BLOCK_TYPES as readonly string[]).includes(String(y.type)) ? (y.type as BlockType) : null;
    const def = type ? blockDef(type) : undefined;
    if (!def || !type) continue;
    if (def.feature && !features.has(def.feature)) continue;
    if (def.unique && seen.has(type)) continue;
    seen.add(type);
    const id = typeof y.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(y.id) ? y.id : newBlockId();
    // Font scelti per i singoli testi del blocco: solo i campi di testo (e i titoli dell'evento nell'intestazione).
    const textKeys = [...def.fields.filter((f) => f.type === "text" || f.type === "longtext").map((f) => f.key), ...(type === "hero" ? HERO_EVENT_KEYS : [])];
    const fonts = sanitizeFontMap(textKeys, (y.props as Record<string, unknown> | null | undefined)?.fonts);
    out.push({
      id,
      type,
      hidden: y.hidden === true,
      props: { ...sanitizeValues(def.fields, y.props, features), ...(fonts ? { fonts } : {}) },
    });
  }
  return out;
}

// Il blocco nuovo di un tipo, con le proprietà di partenza (per l'aggiunta dal builder).
export { makeBlock };

// L'invito ha il modulo di conferma: il tema lo supporta, il modello (o un addon) lo prevede, e c'è il blocco.
export function hasRsvp(c: Catalog, config: Pick<InviteConfig, "themeId" | "model" | "addons" | "blocks">): boolean {
  const theme = getTheme(c, config.themeId, config.model);
  return !!theme && activeFeatures(c, config.model, config.addons).has("rsvp") && config.blocks.some((b) => b.type === "rsvp" && !b.hidden);
}
