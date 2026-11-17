import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ADDON_KEYS,
  BLOCKS,
  BLOCK_TYPES,
  BLOCK_VARIANTS,
  defaultConfig,
  parseTemplate,
  validateManifest,
  type BlockType,
  type InviteConfig,
  type TemplateNode,
  type ThemeManifest,
  defaultRsvp,
} from "@inviteme/shared";
import { renderInvitePage, themeAssetsBase, type StyleFiles } from "./page";
import { sampleEventFields, sampleProps, sampleSample } from "./samples";
import { blockPartials } from "./blocks";

// Stili in cartelle (themes/<id>/): theme.json (manifest), theme.css, assets/. Il motore li legge all'avvio e li valida:
// uno stile non valido non viene servito. I blocchi (contenuto e struttura) stanno in engine/blocks.
export const THEMES_DIR = process.env.THEMES_DIR ?? fileURLToPath(new URL("../../../themes", import.meta.url));
export const RUNTIME_PATH = fileURLToPath(new URL("../../../engine/runtime.js", import.meta.url));

export type LoadedTheme = StyleFiles;
export type ThemeLoad = { theme: LoadedTheme | null; errors: string[]; warnings: string[] };

// Blocchi con una foto e il campo che la contiene: nella demo ciascuno deve avere una foto stock dello stile.
const PHOTO_SLOTS: Record<string, string> = { hero: "couplePhoto", gallery: "photos", image: "photo", venue: "photo" };

// Host che uno stile può citare: font di Google e la mappa di Google. Nessun altro sito.
const ALLOWED_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com", "www.google.com", "maps.google.com", "www.w3.org"]);
const FORBIDDEN_TAG = /<\s*\/?\s*(script|style|link|html|head|body|base|meta)\b/i;

export function loadTheme(dir: string): ThemeLoad {
  const name = path.basename(dir);
  const errors: string[] = [];
  const warnings: string[] = [];
  const read = (file: string, required: boolean): string => {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
      if (required) errors.push(`${name}: manca ${file}`);
      return "";
    }
    return fs.readFileSync(full, "utf8");
  };

  let json: unknown = null;
  try {
    json = JSON.parse(read("theme.json", true) || "null");
  } catch (e) {
    errors.push(`${name}: theme.json non è JSON valido (${(e as Error).message})`);
  }
  const { manifest, errors: manifestErrors } = validateManifest(json, name);
  errors.push(...manifestErrors);
  const css = read("theme.css", true);
  // CSS e asset si controllano sempre, anche con un manifest invalido: così si vedono tutti gli errori insieme.
  checkCss(css, name, errors);
  for (const m of css.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    if (!ALLOWED_HOSTS.has(m[1].toLowerCase())) errors.push(`${name}: theme.css cita un host non ammesso (${m[1]})`);
  }
  for (const ref of css.matchAll(/assets\/[A-Za-z0-9._-]+/g)) {
    if (!fs.existsSync(path.join(dir, ref[0]))) errors.push(`${name}: asset mancante ${ref[0]}`);
  }
  if (manifest?.envelope && !fs.existsSync(path.join(dir, manifest.envelope.video))) errors.push(`${name}: busta-video mancante (${manifest.envelope.video})`);
  if (manifest?.envelope?.poster && !fs.existsSync(path.join(dir, manifest.envelope.poster))) errors.push(`${name}: poster della busta mancante (${manifest.envelope.poster})`);
  for (const file of Object.values(manifest?.backgroundVideo ?? {})) {
    if (!fs.existsSync(path.join(dir, file))) errors.push(`${name}: video di sfondo mancante (${file})`);
  }
  for (const [block, props] of Object.entries({ ...(manifest?.demo ?? {}), ...(manifest?.demoEn ?? {}) })) {
    for (const v of Object.values(props)) {
      for (const f of Array.isArray(v) ? v : [v]) {
        if (typeof f === "string" && f.startsWith("assets/") && !fs.existsSync(path.join(dir, f))) errors.push(`${name}: demo.${block} usa un file mancante (${f})`);
      }
    }
  }
  // Ogni blocco con foto deve avere nella demo una foto stock dello stile: altrimenti il blocco appare vuoto.
  for (const [block, key] of Object.entries(PHOTO_SLOTS)) {
    const v = (manifest?.demo as Record<string, Record<string, unknown>> | undefined)?.[block]?.[key];
    const files = (Array.isArray(v) ? v : [v]).filter((f): f is string => typeof f === "string" && f.startsWith("assets/"));
    if (!files.some((f) => fs.existsSync(path.join(dir, f)))) warnings.push(`${name}: demo.${block}.${key} senza foto stock: il blocco comparirebbe vuoto`);
  }

  const { errors: partialErrors } = blockPartials();
  errors.push(...partialErrors.map((e) => `${name}: ${e}`));
  if (!manifest || errors.length) return { theme: null, errors, warnings };

  // Prova di rendering della demo con tutti i blocchi: ogni segnaposto deve trovare un dato, ogni asset deve esistere.
  // Blocchi con markup proprio: themes/<id>/blocks/<tipo>.html, validati come quelli standard.
  const overrides = loadBlockOverrides(dir, name, errors);
  if (errors.length) return { theme: null, errors, warnings };
  const files: LoadedTheme = { dir, manifest, css, blocks: overrides };
  const missing = new Set<string>();
  const html = renderInvitePage({ theme: files, config: sampleConfig(manifest), slug: "esempio", features: new Set(ADDON_KEYS), runtime: "", preview: true, missing });
  if (missing.size) errors.push(`${name}: segnaposto senza dato: ${[...missing].join(", ")}`);
  for (const file of assetRefs(html, manifest.id)) {
    if (!fs.existsSync(path.join(dir, "assets", file))) errors.push(`${name}: asset mancante assets/${file}`);
  }
  return { theme: errors.length ? null : files, errors, warnings };
}

// Carica tutti gli stili della cartella. Un id duplicato è un errore.
export function loadThemes(root = THEMES_DIR): { themes: LoadedTheme[]; errors: string[]; warnings: string[] } {
  const themes: LoadedTheme[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(root)) return { themes, errors: [`cartella degli stili non trovata: ${root}`], warnings };
  const seen = new Set<string>();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const r = loadTheme(path.join(root, entry.name));
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (!r.theme) continue;
    if (seen.has(r.theme.manifest.id)) {
      errors.push(`${entry.name}: id "${r.theme.manifest.id}" già usato da un altro stile`);
      continue;
    }
    seen.add(r.theme.manifest.id);
    themes.push(r.theme);
  }
  return { themes, errors, warnings };
}

// Sostituzioni di blocco dello stile. Stessi divieti dei template standard: niente script, stili o gestori inline.
function loadBlockOverrides(dir: string, name: string, errors: string[]): Map<BlockType, TemplateNode[]> {
  const out = new Map<BlockType, TemplateNode[]>();
  const folder = path.join(dir, "blocks");
  if (!fs.existsSync(folder)) return out;
  for (const file of fs.readdirSync(folder)) {
    const type = file.replace(/\.html$/, "") as BlockType;
    // Tipi di blocco e varianti (map-button, rsvp-inline).
    if (!file.endsWith(".html") || !([...BLOCK_TYPES, ...BLOCK_VARIANTS] as readonly string[]).includes(type)) {
      errors.push(`${name}: blocks/${file} non è un tipo di blocco noto`);
      continue;
    }
    const src = fs.readFileSync(path.join(folder, file), "utf8");
    const tag = src.match(FORBIDDEN_TAG);
    if (tag) errors.push(`${name}: blocks/${file} contiene <${tag[1]}>`);
    if (/\son[a-z]+\s*=/i.test(src)) errors.push(`${name}: blocks/${file} usa un gestore inline (onclick…)`);
    try {
      out.set(type, parseTemplate(src));
    } catch (e) {
      errors.push(`${name}: blocks/${file}: ${(e as Error).message}`);
    }
  }
  return out;
}

// CSS dello stile: niente import, niente espressioni, url() solo verso assets/ o data:image/.
function checkCss(css: string, name: string, errors: string[]) {
  if (/@import|expression\s*\(|<\/?style|<\/?script/i.test(css)) errors.push(`${name}: theme.css contiene una regola non ammessa (@import, expression, <style>, <script>)`);
  if (/url\(\s*(?!["']?(?:assets\/|data:image\/))/i.test(css)) errors.push(`${name}: theme.css: url() ammesso solo verso assets/ o data:image/`);
}

// Config di esempio per la demo e le anteprime: tutti i blocchi, tutte le funzioni, i file dello stile come esempio.
// Vetrina: ogni caricamento genera contenuti nuovi (nomi, date, luoghi, programma) nella lingua richiesta.
// Con fixedDemo nel manifest, invece, l'esempio è sempre lo stesso: i dati di demo (e demoEn in inglese) hanno la
// precedenza, e quelli che mancano si generano con un seme fisso legato all'id del tema (stesso risultato a ogni caricamento).
// Le proprietà di testo ed elenco di un blocco (titoli, etichette, programma, colori con nome): tolte dalla demo in inglese.
function withoutTexts(def: { fields: { key: string; type: string }[] }, props: Record<string, unknown>): Record<string, unknown> {
  const textual = new Set(def.fields.filter((f) => f.type === "text" || f.type === "longtext" || f.type === "list").map((f) => f.key));
  return Object.fromEntries(Object.entries(props).filter(([k]) => !textual.has(k)));
}

// Generatore pseudo-casuale con seme: stessi numeri per lo stesso testo (mulberry32 su un hash FNV-1a).
function seeded(text: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleConfig(manifest: ThemeManifest, lang: "it" | "en" = "it", rnd: () => number = Math.random): InviteConfig {
  const fixed = manifest.fixedDemo === true;
  const sample = sampleSample(manifest.id, lang, fixed ? seeded(`${manifest.id}:${lang}`) : rnd);
  if (fixed) {
    // Firma e orari coerenti con i dati del tema: i nomi del titolo («Ginevra & Tommaso») e l'ora dell'evento.
    const own = (manifest.demo.event ?? {}) as Record<string, unknown>;
    const names = typeof own.title === "string" ? own.title.split(/\s*(?:&|\be\b|\band\b)\s*/).filter(Boolean) : [];
    if (names.length === 2) sample.signature = lang === "en" ? `${names[0]} & ${names[1]}` : `${names[0]} e ${names[1]}`;
    if (typeof own.eventTime === "string" && /^\d{2}:\d{2}$/.test(own.eventTime)) sample.time = own.eventTime;
  }
  const config = defaultConfig(manifest, "invitation-rsvp", sample.eventType === "anniversary" ? "wedding" : sample.eventType, new Set(ADDON_KEYS));
  config.locale = lang;
  config.rsvpQuestions = defaultRsvp(lang);
  config.event = { ...config.event, ...sampleEventFields(sample) };
  if (fixed) {
    // Esempi fissi: nomi, data, ora e luogo del tema. In inglese la riga di apertura (hosts) è italiana: vale quella di demoEn, se c'è.
    const own = (manifest.demo.event ?? {}) as Record<string, unknown>;
    const ownEn = (manifest.demoEn?.event ?? {}) as Record<string, unknown>;
    const fromTheme = Object.fromEntries(Object.entries(own).filter(([k, v]) => typeof v === "string" && v.trim() && !(lang === "en" && k === "hosts")));
    config.event = { ...config.event, ...fromTheme, ...(lang === "en" ? ownEn : {}) };
  }
  // Alcuni template mostrano la data in chiaro al posto di quella da grattare: il manifest dichiara lo scambio.
  const swap: Record<string, string> = (manifest.demo as { blockSwap?: Record<string, string> }).blockSwap ?? {};
  // Il blocco Data compare solo dove il template lo sceglie con lo scambio: mai insieme alla data da grattare.
  const dropped = new Set<string>(["date", ...Object.values(swap)]);
  config.blocks = BLOCKS.filter((def) => !dropped.has(def.type)).map((def) => {
    const type = (swap[def.type] ?? def.type) as BlockType;
    const generated = sampleProps(type, sample, lang) ?? {};
    return {
      id: `demo-${type}`,
      type,
      hidden: false,
      // I valori dello stile (immagini, filmati) restano quelli del template; i testi cambiano a ogni caricamento.
      // In inglese i testi scritti in italiano dallo stile non si usano: vale demoEn, altrimenti i dati generati e le etichette di default.
      // Con esempi fissi i testi del tema vincono su quelli generati; altrimenti i generati cambiano a ogni caricamento.
      props: fixed
        ? { ...JSON.parse(JSON.stringify(lang === "en" ? (def.defaultsEn ?? def.defaults) : def.defaults)), ...generated, ...(lang === "en" ? withoutTexts(def, manifest.demo[type] ?? {}) : (manifest.demo[type] ?? {})), ...(lang === "en" ? (manifest.demoEn?.[type] ?? {}) : {}) }
        : { ...JSON.parse(JSON.stringify(lang === "en" ? (def.defaultsEn ?? def.defaults) : def.defaults)), ...(lang === "en" ? withoutTexts(def, manifest.demo[type] ?? {}) : (manifest.demo[type] ?? {})), ...(lang === "en" ? (manifest.demoEn?.[type] ?? {}) : {}), ...generated },
    };
  });
  return config;
}

// Percorsi relativi agli asset dello stile citati nella pagina renderizzata.
function assetRefs(html: string, themeId: string): string[] {
  const base = themeAssetsBase(themeId).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`${base}/([^"'\\s)]+)`, "g");
  return [...html.matchAll(re)].map((m) => decodeURI(m[1]));
}

// Controllo del motore: nessun segnaposto rimasto nella pagina generata.
export function hasLeftoverTags(html: string): boolean {
  return /\{\{\s*[#^/!]?\s*[A-Za-z_.|\s]+\}\}/.test(html);
}
