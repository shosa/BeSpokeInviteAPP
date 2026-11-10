import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { THEMES_DIR, loadTheme } from "./engine/themes";
import { readZip, ZipError } from "./zip";

// Caricamento di un tema dalla console: uno ZIP con la cartella del tema (theme.json, theme.css, assets/, blocks/).
// Il tema finisce in themes/<id>/, la stessa cartella di tutti i temi. Prima passa dallo stesso controllo
// dei temi del repository (validate-theme): se non è valido non si installa nulla.
// Formato dello ZIP: docs/TEMI.md, sezione «Esportare lo stile per la console».

export class ThemeUploadError extends Error {
  constructor(message: string, readonly status = 400, readonly details: string[] = [], readonly code?: string) {
    super(message);
  }
}

const LIMITS = { maxFiles: 400, maxTotalBytes: 250 * 1024 * 1024, maxFileBytes: 60 * 1024 * 1024 };
const ID_RE = /^[a-z0-9-]{2,40}$/;
const ASSET_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "svg", "mp4", "webm", "mp3", "m4a", "ogg"]);
// File di sistema che gli archiviatori aggiungono da soli: si ignorano.
const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\._)/;
// SVG serviti dal nostro dominio: niente script, gestori di eventi o contenuti esterni incorporati.
const SVG_DANGER = /<\s*script|\bon[a-z]+\s*=|javascript:|<\s*foreignObject|<\s*iframe|<\s*embed|<\s*object/i;

function allowedPath(rel: string): boolean {
  if (rel === "theme.json" || rel === "theme.css") return true;
  let m = /^assets\/([A-Za-z0-9._-]+)$/.exec(rel);
  if (m) {
    const ext = m[1].split(".").pop()?.toLowerCase() ?? "";
    return !m[1].startsWith(".") && ASSET_EXT.has(ext);
  }
  m = /^blocks\/([a-z]+)\.html$/.exec(rel);
  return Boolean(m);
}

export type UploadResult = { id: string; name: string; replaced: boolean; warnings: string[] };

export function installThemeZip(zip: Buffer, opts: { replace: boolean }): UploadResult {
  let entries;
  try {
    entries = readZip(zip, LIMITS);
  } catch (e) {
    if (e instanceof ZipError) throw new ThemeUploadError(e.message);
    throw e;
  }
  entries = entries.filter((e) => !JUNK.test(e.name));
  if (entries.length === 0) throw new ThemeUploadError("Lo ZIP è vuoto");

  // La cartella del tema può essere la radice dello ZIP, oppure un'unica cartella che contiene tutto.
  let prefix = "";
  if (!entries.some((e) => e.name === "theme.json")) {
    const tops = new Set(entries.map((e) => e.name.split("/")[0]));
    const top = [...tops][0];
    if (tops.size === 1 && entries.some((e) => e.name === `${top}/theme.json`)) prefix = `${top}/`;
    else throw new ThemeUploadError("Nello ZIP manca theme.json: deve stare nella radice, o in un'unica cartella che contiene tutto il tema");
  }

  const files = new Map<string, Buffer>();
  const rejected: string[] = [];
  for (const e of entries) {
    const rel = e.name.slice(prefix.length).replace(/\\/g, "/");
    if (!allowedPath(rel)) {
      rejected.push(rel || e.name);
      continue;
    }
    if (rel.endsWith(".svg") && SVG_DANGER.test(e.data.toString("utf8"))) rejected.push(`${rel} (SVG con script o contenuti attivi)`);
    files.set(rel, e.data);
  }
  if (rejected.length) {
    throw new ThemeUploadError(
      "Lo ZIP contiene file non ammessi: ammessi solo theme.json, theme.css, assets/<file> (immagini, video, audio) e blocks/<tipo>.html",
      400,
      rejected.slice(0, 30),
    );
  }

  let id = "";
  let name = "";
  try {
    const json = JSON.parse(files.get("theme.json")!.toString("utf8")) as { id?: unknown; name?: unknown };
    id = typeof json.id === "string" ? json.id : "";
    name = typeof json.name === "string" ? json.name : id;
  } catch (e) {
    throw new ThemeUploadError(`theme.json non è JSON valido (${(e as Error).message})`);
  }
  if (!ID_RE.test(id)) throw new ThemeUploadError("L'id in theme.json deve avere 2–40 caratteri: minuscole, numeri e trattini");

  const target = path.join(THEMES_DIR, id);
  const exists = fs.existsSync(target);
  if (exists && !opts.replace) throw new ThemeUploadError(`Esiste già un tema con id "${id}"`, 409, [], "exists");

  // Prova in una cartella nascosta (il caricamento dei temi salta le cartelle che iniziano con un punto).
  const stageRoot = path.join(THEMES_DIR, `.upload-${randomUUID()}`);
  const stage = path.join(stageRoot, id);
  try {
    for (const [rel, data] of files) {
      const full = path.join(stage, rel);
      if (!full.startsWith(stage + path.sep)) throw new ThemeUploadError(`Percorso non valido: ${rel}`);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, data);
    }
    const check = loadTheme(stage);
    if (!check.theme) throw new ThemeUploadError("Il tema non supera il controllo: correggi gli errori e ricarica lo ZIP", 422, check.errors.map((e) => e.replace(`${id}: `, "")));

    // Sostituzione: la cartella vecchia si sposta da parte e si cancella solo a installazione riuscita.
    const old = exists ? path.join(stageRoot, `${id}.old`) : null;
    if (old) fs.renameSync(target, old);
    try {
      fs.renameSync(stage, target);
    } catch (e) {
      if (old) fs.renameSync(old, target);
      throw e;
    }
    return { id, name, replaced: exists, warnings: check.warnings.map((w) => w.replace(`${id}: `, "")) };
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

export function removeThemeDir(id: string): void {
  if (!ID_RE.test(id)) throw new ThemeUploadError("Tema non trovato", 404);
  const target = path.join(THEMES_DIR, id);
  if (!fs.existsSync(target)) throw new ThemeUploadError("Tema non trovato", 404);
  fs.rmSync(target, { recursive: true, force: true });
}
