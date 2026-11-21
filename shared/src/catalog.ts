// Catalogo condiviso tra API e frontend. I valori qui sono i DEFAULT: in produzione il catalogo effettivo
// è letto dal database e modificabile dalla console admin (vedi api/src/catalog.ts).
import { ADDON_KEYS, type AddonKey } from "./addons";

export const MODEL_ID = "invitation-rsvp";
import type { ThemeManifest } from "./engine/manifest";

export type { AddonKey } from "./addons";
export type ModelId = string;
export type EventType = "wedding" | "birthday" | "baby" | "corporate" | "graduation";

export type ModelDef = {
  id: ModelId;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  included: AddonKey[]; // incluse nel prezzo base
  options: AddonKey[]; // acquistabili a parte
  enabled: boolean;
  sort: number;
  // Testi in inglese modificabili dalla console. Se mancano, il sito usa quelli predefiniti in lingua o l'italiano.
  en?: { name: string; tagline: string; description: string };
};

export type AddonDef = { key: AddonKey; label: string; description: string; cents: number; enabled: boolean };

// Un tema è una cartella in themes/ (vedi docs/TEMI.md). Il catalogo salva solo se è attivo.
// premium: template riservato all'invito completo; con l'invito base si vede, ma con il lucchetto.
// Categoria dei template (Matrimoni, Compleanni…): creata e ordinata dalla console, con un'icona della libreria
// (shared/src/plannerIcons.ts). Un template può stare in più categorie.
export type TemplateCategory = { id: string; name: string; nameEn: string; icon: string };
export const DEFAULT_TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "matrimoni", name: "Matrimoni", nameEn: "Weddings", icon: "gem" },
  { id: "compleanni", name: "Compleanni", nameEn: "Birthdays", icon: "cake" },
  { id: "feste", name: "Feste", nameEn: "Parties", icon: "party-popper" },
  { id: "battesimi", name: "Battesimi e nascite", nameEn: "Christenings and births", icon: "baby" },
  { id: "lauree", name: "Lauree", nameEn: "Graduations", icon: "graduation-cap" },
  { id: "aziendali", name: "Eventi aziendali", nameEn: "Corporate events", icon: "briefcase" },
];

export type ThemeEntry = { enabled: boolean; premium: boolean; categories: string[]; manifest: ThemeManifest };

export type MusicTrack = { id: string; title: string; artist: string; url: string; enabled: boolean; license: string };

export type Catalog = { models: ModelDef[]; addons: AddonDef[]; themes: ThemeEntry[]; music: MusicTrack[]; categories: TemplateCategory[] };

export const DEFAULT_CATALOG: Omit<Catalog, "themes" | "music" | "categories"> = {
  models: [
    {
      id: MODEL_ID,
      name: "Invito su misura",
      tagline: "Un invito completo, con tutte le sue sezioni",
      description: "Tutte le sezioni incluse: foto, galleria, programma, mappa, musica, conto alla rovescia e conferma di presenza.",
      priceCents: 6500,
      included: [...ADDON_KEYS],
      options: [],
      enabled: true,
      sort: 1,
    },
  ],
  addons: [
    { key: "rsvp", label: "Conferma di presenza", description: "Modulo di risposta con domande personalizzate", cents: 1500, enabled: true },
    { key: "program", label: "Programma dettagliato", description: "Fino a 5 voci: cerimonia, cena, festa", cents: 500, enabled: true },
    { key: "map", label: "Mappa e indicazioni", description: "Mappa del luogo con link alle indicazioni", cents: 1000, enabled: true },
    { key: "music", label: "Musica di sottofondo", description: "Un brano dalla libreria, o il tuo file", cents: 1500, enabled: true },
    { key: "countdown", label: "Conto alla rovescia", description: "Giorni, ore, minuti e secondi alla data", cents: 500, enabled: true },
    { key: "gallery", label: "Galleria foto", description: "Fino a 6 foto invece di 3", cents: 1000, enabled: true },
  ],
};

export const EVENT_TYPES: { id: EventType; label: string; labelEn: string; sampleTitle: string }[] = [
  { id: "wedding", label: "Matrimonio", labelEn: "Wedding", sampleTitle: "Sara & Luca" },
  { id: "birthday", label: "Compleanno", labelEn: "Birthday", sampleTitle: "I 40 di Marco" },
  { id: "baby", label: "Baby shower", labelEn: "Baby shower", sampleTitle: "Aspettiamo Bea" },
  { id: "corporate", label: "Evento aziendale", labelEn: "Corporate event", sampleTitle: "Cena di Gala 2027" },
  { id: "graduation", label: "Laurea", labelEn: "Graduation", sampleTitle: "Laurea di Giulia" },
];

// Frasi che cambiano con il tipo di evento (planner, creazione): «Impostazioni del matrimonio», «della laurea»…
// of: complemento («del matrimonio»; in inglese il nome: «wedding»), your: titolo di riserva, names: cosa va nel titolo,
// after: cosa dice il conto alla rovescia a evento passato.
export type EventPhrases = { of: string; your: string; names: string; namesHint: string; after: string };
const EVENT_PHRASES: Record<EventType, { it: EventPhrases; en: EventPhrases }> = {
  wedding: {
    it: { of: "del matrimonio", your: "Il vostro matrimonio", names: "Nomi degli sposi", namesHint: "Giulia & Marco", after: "Sposati!" },
    en: { of: "wedding", your: "Your wedding", names: "Couple's names", namesHint: "Giulia & Marco", after: "Married!" },
  },
  birthday: {
    it: { of: "del compleanno", your: "La festa di compleanno", names: "Nome o titolo della festa", namesHint: "I 40 di Marco", after: "Che festa!" },
    en: { of: "birthday", your: "The birthday party", names: "Name or party title", namesHint: "Marco's 40th", after: "What a party!" },
  },
  baby: {
    it: { of: "del baby shower", your: "Il baby shower", names: "Nome o titolo della festa", namesHint: "Aspettiamo Bea", after: "Che festa!" },
    en: { of: "baby shower", your: "The baby shower", names: "Name or party title", namesHint: "Waiting for Bea", after: "What a party!" },
  },
  corporate: {
    it: { of: "dell'evento", your: "Il vostro evento", names: "Nome dell'evento", namesHint: "Cena di Gala 2027", after: "Fatto!" },
    en: { of: "event", your: "Your event", names: "Event name", namesHint: "Gala Dinner 2027", after: "Done!" },
  },
  graduation: {
    it: { of: "della laurea", your: "La festa di laurea", names: "Nome o titolo della festa", namesHint: "Laurea di Giulia", after: "Congratulazioni!" },
    en: { of: "graduation", your: "The graduation party", names: "Name or party title", namesHint: "Giulia's graduation", after: "Congratulations!" },
  },
};
export function eventPhrases(type: string | undefined, lang: "it" | "en"): EventPhrases {
  const p = EVENT_PHRASES[(type ?? "") as EventType] ?? EVENT_PHRASES.wedding;
  return p[lang];
}
// Nome del file PDF del planner: tipo di evento e nome, in minuscolo e senza accenti («cartella-compleanno-30-anni-di-stefano.pdf»).
export function plannerPdfName(type: string | undefined, title: string, lang: "it" | "en"): string {
  const slug = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const noun = eventPhrases(type, lang).of.replace(/^(del|della|dello|dell')\s*/, "");
  const head = lang === "en" ? `${noun}-folder` : `cartella-${noun}`;
  return `${[slug(head), slug(title)].filter(Boolean).join("-")}.pdf`;
}
export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && EVENT_TYPES.some((e) => e.id === v);
}


export const CURRENCY = "EUR";

export function enabledModels(c: Catalog) {
  return c.models.filter((m) => m.enabled).sort((a, b) => a.sort - b.sort);
}

// Temi attivi che offrono il modello (un tema senza elenco di modelli li offre tutti).
// Un solo modello: tutti i temi attivi valgono per l'invito, a prescindere dal modello richiesto.
export function enabledThemes(c: Catalog, _model?: string): ThemeManifest[] {
  return c.themes.filter((t) => t.enabled).map((t) => t.manifest);
}

// Il modello è unico: qualunque id richiesto restituisce quello attivo.
export function getModel(c: Catalog, _id?: string) {
  return c.models.find((m) => m.id === MODEL_ID && m.enabled) ?? c.models.find((m) => m.enabled);
}
export function getTheme(c: Catalog, id: string, model?: string): ThemeManifest | undefined {
  return enabledThemes(c, model).find((t) => t.id === id);
}
export function getAddon(c: Catalog, key: string) {
  return c.addons.find((a) => a.key === key && a.enabled);
}

// Funzioni attive: quelle incluse nel modello più quelle scelte, solo se acquistabili e abilitate.
// Tutti i blocchi sono sempre inclusi: niente acquisti a parte.
export function activeFeatures(_c: Catalog, _model: string, _selected: string[]): Set<AddonKey> {
  return new Set<AddonKey>(ADDON_KEYS);
}

export function formatPrice(cents: number, locale = "it-IT", currency = CURRENCY) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
