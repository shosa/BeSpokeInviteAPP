import { activeFeatures, getTheme, type Catalog } from "../catalog";
import { BLOCK_TYPES, EVENT_FIELDS, blockDef, isFixedPosition, makeBlock, type BlockType } from "../blocks";
import type { AddonKey } from "../addons";
import { MAX_BLOCKS, type InviteConfig } from "../invitation";
import { emptyValue, sanitizeValues } from "../engine/values";
import { isRecord, sanitizeQuestions, type FieldDef } from "../engine/manifest";
import { EVENT_TYPES, type EventType } from "../catalog";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Azioni che l'assistente può proporre. Ogni azione è un'istruzione su un setter del builder, non markup:
// l'API le valida con validateActions prima di restituirle al cliente. Un'azione non valida si scarta.

export const ASSISTANT_TOOLS = [
  "setEvent", "setBlockProp", "setBlockList", "setBlockMedia", "setBlockHidden", "setBlockLook", "addBlock", "removeBlock", "moveBlock",
  "setTheme", "setRsvpQuestions", "setEventType",
] as const;
export type AssistantTool = (typeof ASSISTANT_TOOLS)[number];

export type Action =
  | { tool: "setEvent"; key: string; value: string }
  | { tool: "setBlockProp"; blockId: string; key: string; value: string }
  | { tool: "addBlock"; type: BlockType; blockId?: string } // blockId lo assegna il server, così il modello può spostare il blocco
  | { tool: "removeBlock"; blockId: string }
  | { tool: "moveBlock"; blockId: string; to: number }
  | { tool: "setBlockList"; blockId: string; key: string; itemsJson: string }
  | { tool: "setTheme"; themeId: string }
  | { tool: "setRsvpQuestions"; questionsJson: string }
  | { tool: "setEventType"; eventType: EventType }
  | { tool: "setBlockHidden"; blockId: string; hidden: boolean }
  | { tool: "setBlockLook"; blockId: string; lookBg: string; lookInk: string; lookCover: string }
  | { tool: "setBlockMedia"; blockId: string; key: string; url: string };

export type ActionContext = {
  catalog: Catalog;
  paid: boolean; // invito acquistato: il template non si cambia
  purchased: ReadonlySet<AddonKey>; // funzioni già pagate: il loro blocco non si toglie
  placesAllowed?: ReadonlySet<string>; // indirizzi trovati dalla ricerca in questa richiesta: l'indirizzo si salva solo se è uno di questi
  mediaAllowed?: ReadonlySet<string>; // file che il modello può usare: importati in questa richiesta, libreria musica, già nell'invito
};

export type Rejection = { action: unknown; reason: string };
export type ValidationResult = { config: InviteConfig; actions: Action[]; rejected: Rejection[] };

// Campi che l'assistente non tocca: file e immagini si caricano a mano, gli elenchi (programma, colori) hanno una forma troppo ricca.
const NOT_SETTABLE = new Set<FieldDef["type"]>(["photo", "photos", "video", "audio", "list"]);

export function parseAction(raw: unknown): { action: Action } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "azione non riconosciuta" };
  const x = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : null);
  switch (x.tool) {
    case "setEvent": {
      const key = str(x.key);
      const value = typeof x.value === "string" ? x.value : null;
      return key !== null && value !== null ? { action: { tool: "setEvent", key, value } } : { error: "setEvent: chiave o valore mancanti" };
    }
    case "setBlockProp": {
      const blockId = str(x.blockId);
      const key = str(x.key);
      const value = typeof x.value === "string" ? x.value : null;
      return blockId && key !== null && value !== null ? { action: { tool: "setBlockProp", blockId, key, value } } : { error: "setBlockProp: blocco, campo o valore mancanti" };
    }
    case "addBlock": {
      const type = BLOCK_TYPES.find((t) => t === x.type);
      const blockId = typeof x.blockId === "string" && x.blockId.length > 0 && x.blockId.length <= 64 ? x.blockId : undefined;
      return type ? { action: { tool: "addBlock", type, ...(blockId ? { blockId } : {}) } } : { error: "addBlock: tipo di blocco sconosciuto" };
    }
    case "removeBlock": {
      const blockId = str(x.blockId);
      return blockId ? { action: { tool: "removeBlock", blockId } } : { error: "removeBlock: blocco mancante" };
    }
    case "moveBlock": {
      const blockId = str(x.blockId);
      const to = typeof x.to === "number" && Number.isInteger(x.to) ? x.to : null;
      return blockId && to !== null ? { action: { tool: "moveBlock", blockId, to } } : { error: "moveBlock: blocco o posizione non validi" };
    }
    case "setBlockList": {
      const blockId = str(x.blockId);
      const key = str(x.key);
      const itemsJson = typeof x.itemsJson === "string" && x.itemsJson.length <= 4000 ? x.itemsJson : null;
      return blockId && key !== null && itemsJson !== null ? { action: { tool: "setBlockList", blockId, key, itemsJson } } : { error: "setBlockList: blocco, elenco o voci mancanti" };
    }
    case "setEventType": {
      const eventType = EVENT_TYPES.map((e) => e.id).find((t) => t === x.eventType);
      return eventType ? { action: { tool: "setEventType", eventType } } : { error: "setEventType: tipo di evento sconosciuto" };
    }
    case "setBlockHidden": {
      const blockId = str(x.blockId);
      return blockId && typeof x.hidden === "boolean" ? { action: { tool: "setBlockHidden", blockId, hidden: x.hidden } } : { error: "setBlockHidden: blocco o valore mancanti" };
    }
    case "setBlockLook": {
      const blockId = str(x.blockId);
      const parts = [x.lookBg, x.lookInk, x.lookCover];
      return blockId && parts.every((v) => typeof v === "string" && v.length <= 9)
        ? { action: { tool: "setBlockLook", blockId, lookBg: parts[0] as string, lookInk: parts[1] as string, lookCover: parts[2] as string } }
        : { error: "setBlockLook: blocco o colori non validi" };
    }
    case "setBlockMedia": {
      const blockId = str(x.blockId);
      const key = str(x.key);
      const url = typeof x.url === "string" && x.url.length <= 200 ? x.url : null;
      return blockId && key !== null && url !== null ? { action: { tool: "setBlockMedia", blockId, key, url } } : { error: "setBlockMedia: blocco, campo o file mancanti" };
    }
    case "setTheme": {
      const themeId = str(x.themeId);
      return themeId ? { action: { tool: "setTheme", themeId } } : { error: "setTheme: stile mancante" };
    }
    case "setRsvpQuestions": {
      const questionsJson = typeof x.questionsJson === "string" && x.questionsJson.length <= 4000 ? x.questionsJson : null;
      return questionsJson !== null ? { action: { tool: "setRsvpQuestions", questionsJson } } : { error: "setRsvpQuestions: domande mancanti" };
    }
    default:
      return { error: "azione sconosciuta" };
  }
}

// Valida le azioni in sequenza, su una copia della configurazione: ogni azione vede gli effetti di quelle prima.
// Le azioni accettate si restituiscono; quelle scartate portano il motivo. La configurazione d'ingresso non cambia.
export function validateActions(config: InviteConfig, raw: unknown[], ctx: ActionContext): ValidationResult {
  let current = config;
  const actions: Action[] = [];
  const rejected: Rejection[] = [];
  for (const item of raw) {
    const parsed = parseAction(item);
    if ("error" in parsed) {
      rejected.push({ action: item, reason: parsed.error });
      continue;
    }
    const next = applyAction(current, parsed.action, ctx);
    if ("error" in next) {
      rejected.push({ action: item, reason: next.error });
      continue;
    }
    current = next.config;
    actions.push(parsed.action);
  }
  return { config: current, actions, rejected };
}

function applyAction(config: InviteConfig, action: Action, ctx: ActionContext): { config: InviteConfig } | { error: string } {
  const features = activeFeatures(ctx.catalog, config.model, config.addons);
  switch (action.tool) {
    case "setEvent": {
      const field = EVENT_FIELDS.find((f) => f.key === action.key);
      if (!field) return { error: `campo dell'evento sconosciuto: ${action.key}` };
      if (field.key === "address" && action.value !== "" && ctx.placesAllowed && !ctx.placesAllowed.has(action.value)) {
        return { error: "indirizzo non verificato: cercalo con la ricerca luoghi e fai scegliere il cliente" };
      }
      const value = coerce(field, action.value);
      if (value === undefined) return { error: `valore non valido per ${field.label}` };
      const clean = sanitizeValues([field], { [field.key]: value }, features)[field.key];
      if (clean === emptyValue(field) && action.value !== "") return { error: `valore non valido per ${field.label}` };
      return { config: { ...config, event: { ...config.event, [field.key]: clean } } };
    }
    case "setBlockProp": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      const field = blockDef(block.type)?.fields.find((f) => f.key === action.key);
      if (!field) return { error: `campo sconosciuto per il blocco: ${action.key}` };
      if (NOT_SETTABLE.has(field.type)) return { error: `${field.label}: file ed elenchi si modificano a mano` };
      if (field.feature && !features.has(field.feature)) return { error: `${field.label}: funzione non attiva nell'invito` };
      const value = coerce(field, action.value);
      if (value === undefined) return { error: `valore non valido per ${field.label}` };
      const clean = sanitizeValues([field], { [field.key]: value }, features)[field.key];
      if (clean === emptyValue(field) && action.value !== "") return { error: `valore non valido per ${field.label}` };
      return {
        config: { ...config, blocks: config.blocks.map((b) => (b.id === block.id ? { ...b, props: { ...b.props, [field.key]: clean } } : b)) },
      };
    }
    case "addBlock": {
      const def = blockDef(action.type);
      if (!def) return { error: "tipo di blocco sconosciuto" };
      if (def.unique && config.blocks.some((b) => b.type === action.type)) return { error: `${def.label}: ce n'è già uno` };
      if (def.feature && !features.has(def.feature)) return { error: `${def.label}: funzione non attiva nell'invito` };
      if (config.blocks.length >= MAX_BLOCKS) return { error: `troppi blocchi (massimo ${MAX_BLOCKS})` };
      if (action.blockId && config.blocks.some((b) => b.id === action.blockId)) return { error: "id di blocco già usato" };
      const made = makeBlock(action.type, config.locale);
      const block = action.blockId ? { ...made, id: action.blockId } : made;
      return { config: { ...config, blocks: def.anchored ? [block, ...config.blocks] : [...config.blocks, block] } };
    }
    case "removeBlock": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      const def = blockDef(block.type);
      if (def?.locked) return { error: `${def.label}: è un blocco obbligatorio` };
      if (def?.feature && ctx.purchased.has(def.feature)) return { error: `${def.label}: funzione già attiva, si toglie a mano` };
      // Come il builder: se nessun altro blocco usa la funzione, la si toglie insieme al blocco (il prezzo scende).
      const blocks = config.blocks.filter((b) => b.id !== block.id);
      const feature = def?.feature;
      const stillUsed = !!feature && blocks.some((b) => blockDef(b.type)?.feature === feature);
      return { config: { ...config, blocks, addons: feature && !stillUsed ? config.addons.filter((a) => a !== feature) : config.addons } };
    }
    case "moveBlock": {
      const from = config.blocks.findIndex((b) => b.id === action.blockId);
      if (from < 0) return { error: "blocco inesistente" };
      const block = config.blocks[from];
      if (isFixedPosition(block.type)) return { error: `${blockDef(block.type)?.label ?? "blocco"}: non si sposta` };
      if (action.to < 0 || action.to >= config.blocks.length) return { error: "posizione fuori dall'elenco" };
      const list = [...config.blocks];
      list.splice(from, 1);
      list.splice(action.to, 0, block);
      // Un blocco fisso (copertina, principale) non cambia posizione: se lo spostamento la cambierebbe, si scarta.
      const moved = config.blocks.some((b, i) => isFixedPosition(b.type) && list[i]?.id !== b.id);
      if (moved) return { error: "lo spostamento cambierebbe la posizione di un blocco fisso" };
      return { config: { ...config, blocks: list } };
    }
    case "setBlockList": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      const field = blockDef(block.type)?.fields.find((f) => f.key === action.key && f.type === "list");
      if (!field) return { error: `elenco sconosciuto per il blocco: ${action.key}` };
      if (field.feature && !features.has(field.feature)) return { error: `${field.label}: funzione non attiva nell'invito` };
      const items = parseJsonArray(action.itemsJson);
      if (!items) return { error: `${field.label}: elenco non valido` };
      const clean = sanitizeValues([field], { [field.key]: items }, features)[field.key];
      return {
        config: { ...config, blocks: config.blocks.map((b) => (b.id === block.id ? { ...b, props: { ...b.props, [field.key]: clean } } : b)) },
      };
    }
    case "setRsvpQuestions": {
      if (!config.blocks.some((b) => b.type === "rsvp") || !features.has("rsvp")) return { error: "il modulo di conferma non è nell'invito" };
      const raw = parseJsonArray(action.questionsJson);
      if (!raw || raw.length === 0) return { error: "domande non valide" };
      // Gli identificativi li assegna il validatore: il modello non sceglie le chiavi delle risposte.
      const errors: string[] = [];
      const questions = sanitizeQuestions(raw.map((q, i) => (isRecord(q) ? { ...q, id: `q${i + 1}` } : q)), "domande", errors);
      if (errors.length > 0 || questions.length === 0) return { error: errors[0] ?? "nessuna domanda valida" };
      return { config: { ...config, rsvpQuestions: questions } };
    }
    case "setEventType": {
      return { config: { ...config, eventType: action.eventType } };
    }
    case "setBlockHidden": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      return { config: { ...config, blocks: config.blocks.map((b) => (b.id === block.id ? { ...b, hidden: action.hidden } : b)) } };
    }
    case "setBlockLook": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      const colors = { lookBg: action.lookBg, lookInk: action.lookInk, lookCover: action.lookCover };
      const props: Record<string, unknown> = { ...block.props };
      for (const [k, v] of Object.entries(colors)) {
        if (v === "") delete props[k];
        else if (HEX_COLOR.test(v)) props[k] = v.toLowerCase();
        else return { error: "colore non valido (serve #RRGGBB, o vuoto per tornare al template)" };
      }
      return { config: { ...config, blocks: config.blocks.map((b) => (b.id === block.id ? { ...b, props } : b)) } };
    }
    case "setBlockMedia": {
      const block = config.blocks.find((b) => b.id === action.blockId);
      if (!block) return { error: "blocco inesistente" };
      const field = blockDef(block.type)?.fields.find((f) => f.key === action.key);
      if (!field || !["photo", "photos", "video", "audio"].includes(field.type)) return { error: `campo file sconosciuto: ${action.key}` };
      if (field.feature && !features.has(field.feature)) return { error: `${field.label}: funzione non attiva nell'invito` };
      if (action.url !== "" && ctx.mediaAllowed && !ctx.mediaAllowed.has(action.url)) return { error: `${field.label}: file non disponibile, cercane un'altra` };
      // Una foto singola si sostituisce; un elenco di foto (galleria) riceve la nuova foto in coda.
      const current = block.props[field.key];
      const next = field.type === "photos"
        ? action.url === "" ? [] : galleryWith(Array.isArray(current) ? (current as string[]) : [], action.url)
        : action.url;
      const clean = sanitizeValues([field], { [field.key]: next }, features)[field.key];
      if (action.url !== "" && (field.type === "photos" ? !(clean as string[]).includes(action.url) : clean !== action.url)) return { error: `${field.label}: file non accettato (formato o dimensioni)` };
      return { config: { ...config, blocks: config.blocks.map((b) => (b.id === block.id ? { ...b, props: { ...b.props, [field.key]: clean } } : b)) } };
    }
    case "setTheme": {
      if (ctx.paid) return { error: "dopo l'acquisto il template non si cambia" };
      const theme = getTheme(ctx.catalog, action.themeId, config.model);
      if (!theme) return { error: "template non disponibile per questo modello" };
      // Come il builder: il cambio di stile tiene contenuto e blocchi, e riporta al template i colori dei blocchi.
      const blocks = config.blocks.map((b) => {
        const props = { ...b.props };
        delete props.lookBg;
        delete props.lookInk;
        delete props.lookCover;
        return { ...b, props };
      });
      return { config: { ...config, themeId: theme.id, blocks } };
    }
  }
}

// Il valore arriva come testo: si converte secondo il tipo del campo. undefined = non convertibile.
function coerce(field: FieldDef, value: string): unknown {
  switch (field.type) {
    case "toggle":
      return value === "true" ? true : value === "false" ? false : undefined;
    case "number": {
      const n = Number(value);
      return value.trim() !== "" && Number.isFinite(n) ? n : undefined;
    }
    default:
      return value;
  }
}

// Un elenco scritto dal modello (testo JSON): deve essere un array di oggetti. undefined = non valido.
function parseJsonArray(text: string): unknown[] | undefined {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) && v.every(isRecord) ? v : undefined;
  } catch {
    return undefined;
  }
}

// Una foto in coda alla galleria, senza duplicati.
function galleryWith(list: string[], url: string): string[] {
  return list.includes(url) ? list : [...list, url];
}
