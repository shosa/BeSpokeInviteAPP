// Tipi condivisi della console admin.
export type Tab = "panoramica" | "ordini" | "clienti" | "inviti" | "planner" | "template" | "musica" | "file" | "shopify" | "email" | "assistente";
export type OrderRow = { id: string; title: string | null; email: string | null; amount_cents: number; source: string; status: string; created_at: string };
export type ShopifyState = { configured: boolean; demo: boolean };
// Apertura di un elemento da un'altra sezione (panoramica, ricerca): scheda cliente, invito o planner.
export type Go = (tab: Tab, target?: { userId?: string; invitationId?: string }) => void;
