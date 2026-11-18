// Icona del planner (barra laterale, riepilogo): il cliente la sceglie alla creazione e la cambia nelle impostazioni.
// Solo le chiavi e i nomi: il disegno sta nel web (lucide-react).
export const PLANNER_ICONS = [
  { key: "gem", it: "Anello", en: "Ring" },
  { key: "heart", it: "Cuore", en: "Heart" },
  { key: "heart-handshake", it: "Mani e cuore", en: "Hands and heart" },
  { key: "infinity", it: "Infinito", en: "Infinity" },
  { key: "church", it: "Chiesa", en: "Church" },
  { key: "flower", it: "Fiore", en: "Flower" },
  { key: "leaf", it: "Foglia", en: "Leaf" },
  { key: "feather", it: "Piuma", en: "Feather" },
  { key: "sparkles", it: "Scintille", en: "Sparkles" },
  { key: "star", it: "Stella", en: "Star" },
  { key: "crown", it: "Corona", en: "Crown" },
  { key: "diamond", it: "Diamante", en: "Diamond" },
  { key: "cake", it: "Torta", en: "Cake" },
  { key: "cake-slice", it: "Fetta di torta", en: "Slice of cake" },
  { key: "party-popper", it: "Festa", en: "Party" },
  { key: "balloon", it: "Palloncino", en: "Balloon" },
  { key: "gift", it: "Regalo", en: "Gift" },
  { key: "baby", it: "Bebè", en: "Baby" },
  { key: "rabbit", it: "Coniglietto", en: "Bunny" },
  { key: "bird", it: "Uccellino", en: "Bird" },
  { key: "graduation-cap", it: "Tocco di laurea", en: "Graduation cap" },
  { key: "book-open", it: "Libro", en: "Book" },
  { key: "trophy", it: "Coppa", en: "Trophy" },
  { key: "medal", it: "Medaglia", en: "Medal" },
  { key: "briefcase", it: "Valigetta", en: "Briefcase" },
  { key: "building", it: "Palazzo", en: "Building" },
  { key: "mic", it: "Microfono", en: "Microphone" },
  { key: "music", it: "Musica", en: "Music" },
  { key: "wine", it: "Calice", en: "Wine glass" },
  { key: "martini", it: "Cocktail", en: "Cocktail" },
  { key: "utensils", it: "Cena", en: "Dinner" },
  { key: "camera", it: "Fotocamera", en: "Camera" },
  { key: "plane", it: "Aereo", en: "Plane" },
  { key: "palm", it: "Palma", en: "Palm tree" },
  { key: "sun", it: "Sole", en: "Sun" },
  { key: "moon", it: "Luna", en: "Moon" },
  { key: "mountain", it: "Montagna", en: "Mountain" },
  { key: "anchor", it: "Ancora", en: "Anchor" },
  { key: "dog", it: "Cane", en: "Dog" },
  { key: "cat", it: "Gatto", en: "Cat" },
  { key: "rocket", it: "Razzo", en: "Rocket" },
] as const;
export type PlannerIcon = (typeof PLANNER_ICONS)[number]["key"];

export function isPlannerIcon(v: unknown): v is PlannerIcon {
  return typeof v === "string" && PLANNER_ICONS.some((i) => i.key === v);
}

// Icona di partenza per il tipo di evento, finché il cliente non ne sceglie un'altra.
export function defaultPlannerIcon(eventType?: string): PlannerIcon {
  return ({ wedding: "gem", birthday: "cake", baby: "baby", corporate: "briefcase", graduation: "graduation-cap" } as Record<string, PlannerIcon>)[eventType ?? ""] ?? "sparkles";
}
