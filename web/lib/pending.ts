// Acquisto pagato su Shopify da attivare: un invito (si sceglie il template) o un planner (si dà un nome all'evento).
// plan "base": invito base, con la scelta limitata ai template non Premium.
export type PendingPurchase = { id: string; product: "invitation" | "planner"; plan?: "base" | "full"; createdAt: string; statusUrl: string | null };
