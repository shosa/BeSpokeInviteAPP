// Tipi condivisi della console admin.
export type Tab = "ordini" | "clienti" | "inviti" | "template" | "musica" | "file" | "shopify" | "email" | "assistente";
export type OrderRow = { id: string; title: string | null; email: string | null; amount_cents: number; source: string; status: string; created_at: string };
export type ShopifyState = { configured: boolean; demo: boolean };
