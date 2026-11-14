import { BLOCK_TYPES, makeBlock, type BlockInstance, type BlockType } from "./blocks";
import { sanitizeQuestions, type RsvpQuestion } from "./engine/manifest";
import type { InviteConfig } from "./invitation";

// Wizard iniziale del builder (e del planner): i dati di base dell'invito, chiesti a passi.
// Dalle risposte si impostano i campi dell'evento e si aggiungono o tolgono i blocchi collegati:
// luogo → Location, indirizzo → Mappa, ringraziamento → Firma, conferma di presenza → Conferma con le sue domande.

export type SetupInput = {
  title: string;
  eventDate: string;
  venue: string;
  address: string;
  signature: string;
  rsvp: boolean;
  questions: RsvpQuestion[];
};

// Domande pronte da attivare nel wizard. Nome e presenza sono sempre incluse.
export type PresetQuestion = RsvpQuestion & { locked?: boolean; on?: boolean };
export function presetQuestions(locale: "it" | "en"): PresetQuestion[] {
  const en = locale === "en";
  return [
    { id: "name", label: en ? "Full name" : "Nome e cognome", type: "text", required: true, locked: true, on: true },
    { id: "attending", label: en ? "Will you attend?" : "Parteciperai?", type: "yes-no", required: true, yes: en ? "Yes, with pleasure" : "Sì, con piacere", no: en ? "Sorry, I cannot" : "Purtroppo non posso", locked: true, on: true },
    { id: "guests", label: en ? "Number of people (including you)" : "Numero di persone (compreso te)", type: "number", on: true },
    { id: "allergies", label: en ? "Allergies or intolerances" : "Allergie o intolleranze", type: "text" },
    { id: "lodging", label: en ? "Do you need accommodation?" : "Ti serve un alloggio?", type: "yes-no", yes: en ? "Yes" : "Sì", no: "No" },
    { id: "shuttle", label: en ? "Do you need the shuttle?" : "Ti serve la navetta?", type: "yes-no", yes: en ? "Yes" : "Sì", no: "No" },
    { id: "note", label: en ? "A message for the hosts" : "Un messaggio per gli sposi", type: "text", on: true },
  ];
}

const ORDER = BLOCK_TYPES as readonly string[];

// Inserisce un blocco al suo posto naturale (l'ordine del registro dei blocchi), se manca. Ritorna il blocco.
function ensure(blocks: BlockInstance[], type: BlockType, locale: "it" | "en"): BlockInstance {
  const found = blocks.find((b) => b.type === type);
  if (found) {
    found.hidden = false;
    return found;
  }
  const block = makeBlock(type, locale);
  const at = blocks.findIndex((b) => ORDER.indexOf(b.type) > ORDER.indexOf(type));
  if (at < 0) blocks.push(block);
  else blocks.splice(at, 0, block);
  return block;
}

const without = (blocks: BlockInstance[], type: BlockType) => blocks.filter((b) => b.type !== type);

// Applica le risposte del wizard alla configurazione. Non valida: il server passa il risultato da sanitizeConfig.
export function applySetup(config: InviteConfig, input: SetupInput): InviteConfig {
  const locale = config.locale === "en" ? "en" : "it";
  let blocks: BlockInstance[] = JSON.parse(JSON.stringify(config.blocks ?? []));
  const event = { ...(config.event ?? {}), title: input.title, eventDate: input.eventDate, venue: input.venue, address: input.address };

  if (input.venue) ensure(blocks, "venue", locale).props.venue = input.venue;
  else blocks = without(blocks, "venue");

  if (input.address) ensure(blocks, "map", locale);
  else blocks = without(blocks, "map");

  if (input.signature) ensure(blocks, "footer", locale).props.signature = input.signature;
  else blocks = without(blocks, "footer");

  let rsvpQuestions: RsvpQuestion[] = [];
  if (input.rsvp) {
    ensure(blocks, "rsvp", locale);
    rsvpQuestions = sanitizeQuestions(input.questions, "rsvpQuestions");
    // La domanda sulla presenza c'è sempre: senza, le risposte non dicono chi viene.
    if (!rsvpQuestions.some((q) => q.type === "yes-no" && q.id === "attending")) {
      const attending = presetQuestions(locale).find((q) => q.id === "attending")!;
      rsvpQuestions = [{ id: attending.id, label: attending.label, type: attending.type, required: true, yes: attending.yes, no: attending.no }, ...rsvpQuestions].slice(0, 8);
    }
  } else {
    blocks = without(blocks, "rsvp");
  }

  return { ...config, event, blocks, rsvpQuestions };
}

// Valori di partenza del wizard, letti dalla configurazione attuale.
export function setupDefaults(config: InviteConfig): SetupInput {
  const ev = (config.event ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const venueBlock = config.blocks?.find((b) => b.type === "venue");
  const footer = config.blocks?.find((b) => b.type === "footer");
  const hasRsvp = config.blocks?.some((b) => b.type === "rsvp") ?? false;
  return {
    title: str(ev.title),
    eventDate: str(ev.eventDate),
    venue: str(venueBlock?.props.venue) || str(ev.venue),
    address: str(ev.address),
    signature: str(footer?.props.signature),
    rsvp: hasRsvp,
    questions: hasRsvp ? config.rsvpQuestions ?? [] : [],
  };
}
