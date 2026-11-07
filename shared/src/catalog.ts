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
export type ThemeEntry = { enabled: boolean; manifest: ThemeManifest };

export type MusicTrack = { id: string; title: string; artist: string; url: string; enabled: boolean; license: string };

export type Catalog = { models: ModelDef[]; addons: AddonDef[]; themes: ThemeEntry[]; music: MusicTrack[] };

export const DEFAULT_CATALOG: Omit<Catalog, "themes" | "music"> = {
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

export const EVENT_TYPES: { id: EventType; label: string; sampleTitle: string }[] = [
  { id: "wedding", label: "Matrimonio", sampleTitle: "Sara & Luca" },
  { id: "birthday", label: "Compleanno", sampleTitle: "I 40 di Marco" },
  { id: "baby", label: "Baby shower", sampleTitle: "Aspettiamo Bea" },
  { id: "corporate", label: "Evento aziendale", sampleTitle: "Cena di Gala 2027" },
  { id: "graduation", label: "Laurea", sampleTitle: "Laurea di Giulia" },
];

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
