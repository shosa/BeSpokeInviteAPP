// Acquisto pagato su Shopify da attivare: un invito (si sceglie il template) o un planner (si dà un nome all'evento).
export type PendingPurchase = { id: string; product: "invitation" | "planner"; createdAt: string; statusUrl: string | null };
