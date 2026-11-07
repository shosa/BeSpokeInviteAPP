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
