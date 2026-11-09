// Acquisto pagato su Shopify che aspetta il template: lo restituisce l'API /api/account/pending.
export type PendingPurchase = { id: string; tier: "rsvp" | "premium"; createdAt: string; statusUrl: string | null };
