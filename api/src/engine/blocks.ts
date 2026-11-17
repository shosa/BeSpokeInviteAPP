import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BLOCK_TYPES, BLOCK_VARIANTS, parseTemplate, type BlockType, type BlockVariant, type TemplateNode } from "@inviteme/shared";

// Template di ogni tipo di blocco (engine/blocks/<tipo>.html). Il markup è condiviso da tutti gli stili:
// lo stile lo decide il CSS del tema, la struttura del blocco sta qui.
export const BLOCKS_DIR = process.env.BLOCKS_DIR ?? fileURLToPath(new URL("../../../engine/blocks", import.meta.url));

let cache: { partials: Map<BlockType, TemplateNode[]>; errors: string[] } | null = null;

export function blockPartials(): { partials: Map<BlockType, TemplateNode[]>; errors: string[] } {
  if (cache) return cache;
  const partials = new Map<BlockType, TemplateNode[]>();
  const errors: string[] = [];
  for (const type of BLOCK_TYPES) {
    const file = path.join(BLOCKS_DIR, `${type}.html`);
    if (!fs.existsSync(file)) {
      errors.push(`blocco "${type}": manca ${type}.html`);
      continue;
    }
    try {
      partials.set(type, parseTemplate(fs.readFileSync(file, "utf8")));
    } catch (e) {
      errors.push(`blocco "${type}": ${(e as Error).message}`);
    }
  }
  cache = { partials, errors };
  return cache;
}

// Varianti del motore (engine/blocks/<variante>.html): mappa come pulsante, conferma già aperta nella pagina.
let variants: Map<BlockVariant, TemplateNode[]> | null = null;
export function variantPartials(): Map<BlockVariant, TemplateNode[]> {
  if (!variants) {
    variants = new Map();
    for (const v of BLOCK_VARIANTS) variants.set(v, parseTemplate(fs.readFileSync(path.join(BLOCKS_DIR, `${v}.html`), "utf8")));
  }
  return variants;
}
