import { ADDON_KEYS, DEFAULT_CATALOG, MODEL_ID, type Catalog, type ModelDef, type AddonDef, type MusicTrack, type ThemeEntry } from "@inviteme/shared";
import { pool } from "./db";
import { loadThemes, type LoadedTheme } from "./engine/themes";

// Il catalogo effettivo = default del codice + modifiche salvate dalla console admin (tabella settings).
// I temi non stanno nel database: sono cartelle in themes/. Dal database si legge solo quali sono attivi.
export type StoredCatalog = {
  models: ModelDef[];
  addons: AddonDef[];
  themes?: { id: string; enabled: boolean }[];
};

// Temi caricati una volta all'avvio: sono file del repository, cambiano solo con un deploy.
let themeFiles: LoadedTheme[] | null = null;
export function themes(): LoadedTheme[] {
  if (!themeFiles) {
    const loaded = loadThemes();
    for (const e of loaded.errors) console.error(`[temi] ${e}`);
    for (const w of loaded.warnings) console.warn(`[temi] ${w}`);
    themeFiles = loaded.themes;
  }
  return themeFiles;
}

export function themeEntries(stored: StoredCatalog["themes"]): ThemeEntry[] {
  return themes().map((t) => ({
    enabled: stored?.find((s) => s.id === t.manifest.id)?.enabled !== false,
    manifest: t.manifest,
  }));
}

// Cache in memoria: si invalida a ogni salvataggio e dopo 15 secondi al massimo (per la libreria musicale).
const TTL_MS = 15_000;
let cache: { at: number; full: Catalog } | null = null;

export function invalidateCatalog() {
  cache = null;
}

async function readFull(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.full;
  const [{ rows: s }, { rows: t }] = await Promise.all([
    pool.query("SELECT value FROM settings WHERE key = 'catalog'"),
    pool.query("SELECT id, title, artist, url, license, enabled FROM music_tracks ORDER BY created_at DESC"),
  ]);
  const stored = s[0]?.value as Partial<StoredCatalog> | undefined;
  const full: Catalog = {
    models: stored?.models ?? DEFAULT_CATALOG.models,
    addons: stored?.addons ?? DEFAULT_CATALOG.addons,
    themes: themeEntries(stored?.themes),
    music: t.map((r) => ({ id: r.id, title: r.title, artist: r.artist, url: r.url, license: r.license, enabled: r.enabled })) as MusicTrack[],
  };
  cache = { at: Date.now(), full };
  return full;
}

// Un solo modello, con tutte le funzioni incluse: il catalogo salvato può ancora avere modelli e prezzi vecchi.
function singleModel(models: Catalog["models"]): Catalog["models"] {
  const base = models.find((m) => m.id === MODEL_ID) ?? DEFAULT_CATALOG.models[0];
  return [{ ...base, id: MODEL_ID, included: [...ADDON_KEYS], options: [], enabled: true }];
}

export async function loadCatalog(opts: { includeDisabled?: boolean } = {}): Promise<Catalog> {
  const full = await readFull();
  const models = singleModel(full.models);
  if (opts.includeDisabled) return { ...full, models };
  const on = <T extends { enabled: boolean }>(list: T[]) => list.filter((x) => x.enabled);
  return { models, addons: on(full.addons), themes: on(full.themes), music: on(full.music) };
}

// Salva modelli, funzioni e attivazione dei temi. Il resto (contenuto dei temi) non è modificabile dalla console.
export async function saveCatalog(next: StoredCatalog): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('catalog', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  invalidateCatalog();
}

// Versione completa, per la console: include anche gli elementi disabilitati.
export async function loadFullCatalog(): Promise<Catalog> {
  return loadCatalog({ includeDisabled: true });
}
