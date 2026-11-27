import { blockDef, type BlockInstance } from "./blocks";
import type { FieldDef } from "./engine/manifest";
import type { InviteConfig } from "./invitation";

// Testi dell'invito da tradurre nelle lingue in più: quelli scritti nei blocchi (campi testo e testo lungo, anche
// dentro le liste), la riga di apertura dell'evento e le domande della conferma. Restano come sono i nomi propri
// e i dati: titolo (i nomi), luogo, indirizzo, data, link, colori e i campi non testuali.

const SKIP_KEYS = new Set(["venue", "sealText"]); // nome del luogo e iniziali del sigillo: nomi propri
const hasWords = (s: string) => /\p{L}/u.test(s) && s.trim().length > 0;

type Visit = (value: string) => string;

function visitFields(fields: FieldDef[], props: Record<string, unknown>, visit: Visit): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const f of fields) {
    const v = props[f.key];
    if ((f.type === "text" || f.type === "longtext") && typeof v === "string" && !SKIP_KEYS.has(f.key)) {
      if (hasWords(v)) out[f.key] = visit(v);
    } else if (f.type === "list" && Array.isArray(v) && f.item) {
      out[f.key] = v.map((row) => (row && typeof row === "object" ? visitFields(f.item!, row as Record<string, unknown>, visit) : row));
    }
  }
  return out;
}

// Applica `visit` a ogni testo traducibile e restituisce una copia della configurazione.
export function mapTranslatable(config: InviteConfig, visit: Visit, opts: { rsvp?: boolean } = {}): InviteConfig {
  const blocks: BlockInstance[] = config.blocks.map((b) => {
    const def = blockDef(b.type);
    return def ? { ...b, props: visitFields(def.fields ?? [], b.props, visit) } : b;
  });
  const event = { ...config.event };
  if (typeof event.hosts === "string" && hasWords(event.hosts)) event.hosts = visit(event.hosts);
  const rsvpQuestions = opts.rsvp === false
    ? config.rsvpQuestions
    : config.rsvpQuestions.map((q) => ({
        ...q,
        label: hasWords(q.label) ? visit(q.label) : q.label,
        ...(q.yes && hasWords(q.yes) ? { yes: visit(q.yes) } : {}),
        ...(q.no && hasWords(q.no) ? { no: visit(q.no) } : {}),
        ...(q.options ? { options: q.options.map((o) => (hasWords(o) ? visit(o) : o)) } : {}),
      }));
  return { ...config, event, blocks, rsvpQuestions };
}

// Tutti i testi da tradurre, senza doppioni, nell'ordine in cui compaiono.
export function translatableTexts(config: InviteConfig, opts: { rsvp?: boolean } = {}): string[] {
  const seen = new Set<string>();
  mapTranslatable(config, (s) => { seen.add(s); return s; }, opts);
  return [...seen];
}

// Configurazione tradotta: ogni testo sostituito dalla sua traduzione (se manca, resta l'originale).
export function applyTranslations(config: InviteConfig, map: Record<string, string>, opts: { rsvp?: boolean } = {}): InviteConfig {
  return mapTranslatable(config, (s) => (typeof map[s] === "string" && map[s].trim() ? map[s] : s), opts);
}
