// Livelli del prodotto venduto da Shopify: il planner è solo nel livello premium (RSVP premium).
export const INVITE_TIERS = ["save_the_date", "rsvp", "premium"] as const;
export type InviteTier = (typeof INVITE_TIERS)[number];

export const isInviteTier = (v: unknown): v is InviteTier => typeof v === "string" && (INVITE_TIERS as readonly string[]).includes(v);

// Il planner (budget, pagamenti, invitati, attività, cartella, meteo) si apre solo con il livello premium.
export const hasPlanner = (tier: string | null | undefined): boolean => tier === "premium";

// Stati degli elementi del planner.
export const CONTRACT_STATUSES = ["unsigned", "signed"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const RSVP_STATUSES = ["pending", "yes", "no"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

// Budget del planner: categorie di spesa con la quota consigliata del budget totale (in percentuale).
// Le quote sono un'indicazione di partenza nostra, non un dato di mercato: servono a vedere a colpo d'occhio
// se una voce sta pesando più del previsto. Sommano 100.
export const BUDGET_CATEGORIES = [
  { key: "location", it: "Location e ricevimento", en: "Venue and reception", share: 48 },
  { key: "abiti", it: "Abiti e bellezza", en: "Attire and beauty", share: 10 },
  { key: "foto", it: "Foto e video", en: "Photo and video", share: 8 },
  { key: "fiori", it: "Fiori e allestimenti", en: "Flowers and styling", share: 7 },
  { key: "musica", it: "Musica e intrattenimento", en: "Music and entertainment", share: 5 },
  { key: "fedi", it: "Fedi e gioielli", en: "Rings and jewellery", share: 4 },
  { key: "inviti", it: "Inviti e stampati", en: "Invitations and stationery", share: 2 },
  { key: "bomboniere", it: "Bomboniere e regali", en: "Favours and gifts", share: 3 },
  { key: "trasporti", it: "Trasporti e alloggi", en: "Transport and lodging", share: 4 },
  { key: "cerimonia", it: "Cerimonia", en: "Ceremony", share: 2 },
  { key: "imprevisti", it: "Imprevisti", en: "Contingency", share: 7 },
] as const;
export type BudgetCategoryKey = (typeof BUDGET_CATEGORIES)[number]["key"] | "altro";
export const BUDGET_CATEGORY_KEYS = [...BUDGET_CATEGORIES.map((c) => c.key), "altro"] as const;
