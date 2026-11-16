import { pool } from "./db";

// Impostazioni Shopify modificabili dalla console. Gli ID del negozio e delle varianti (non segreti) si salvano
// nella tabella settings, chiave 'shopify'. I segreti (token Storefront, secret del webhook) restano solo nel file .env:
// la console ne mostra la presenza, mai il valore.
// Priorità: valore salvato dalla console, poi variabile d'ambiente.

export const SHOPIFY_API_VERSION = "2025-01";
const DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const VARIANT_RE = /^(gid:\/\/shopify\/ProductVariant\/)?(\d{1,20})$/;
const PRODUCT_RE = /^(gid:\/\/shopify\/Product\/)?(\d{1,20})$/;

// Il planner è un prodotto a sé nel negozio (come l'invito): si riconosce dal prodotto, qualunque variante si compri.
export type ShopifyIds = { storeDomain: string; variantId: string; variantPremiumId: string; plannerProductId: string };
export type ShopifySource = "console" | "ambiente" | "assente";

// Valori caricati dalla tabella settings. Vuoti finché non viene chiamato loadShopifySettings().
let stored: Partial<ShopifyIds> = {};

const fromEnv = (): ShopifyIds => ({
  storeDomain: (process.env.SHOPIFY_STORE_DOMAIN ?? "").trim().toLowerCase(),
  variantId: normalizeVariant(process.env.SHOPIFY_VARIANT_ID ?? "") ?? "",
  variantPremiumId: normalizeVariant(process.env.SHOPIFY_VARIANT_PREMIUM_ID ?? "") ?? "",
  plannerProductId: normalizeProduct(process.env.SHOPIFY_PLANNER_PRODUCT_ID ?? "") ?? "",
});

// Un ID di variante come gid completo. Accetta anche il solo numero, che è quello che si copia dall'admin di Shopify.
export function normalizeVariant(raw: string): string | null {
  const m = VARIANT_RE.exec(raw.trim());
  return m ? `gid://shopify/ProductVariant/${m[2]}` : null;
}

// Un ID di prodotto come gid completo. Accetta anche il solo numero dell'admin di Shopify.
export function normalizeProduct(raw: string): string | null {
  const m = PRODUCT_RE.exec(raw.trim());
  return m ? `gid://shopify/Product/${m[2]}` : null;
}

export function getShopifyIds(): ShopifyIds {
  const env = fromEnv();
  return {
    storeDomain: stored.storeDomain ?? env.storeDomain,
    variantId: stored.variantId ?? env.variantId,
    variantPremiumId: stored.variantPremiumId ?? env.variantPremiumId,
    plannerProductId: stored.plannerProductId ?? env.plannerProductId,
  };
}

export const storefrontToken = (): string => (process.env.SHOPIFY_STOREFRONT_TOKEN ?? "").trim();
export const webhookSecret = (): string => (process.env.SHOPIFY_WEBHOOK_SECRET ?? "").trim();

export async function loadShopifySettings(): Promise<void> {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'shopify'");
  const v = (rows[0]?.value ?? {}) as Partial<Record<keyof ShopifyIds, unknown>>;
  stored = {};
  if (typeof v.storeDomain === "string" && DOMAIN_RE.test(v.storeDomain)) stored.storeDomain = v.storeDomain;
  if (typeof v.variantId === "string" && normalizeVariant(v.variantId)) stored.variantId = normalizeVariant(v.variantId)!;
  if (typeof v.variantPremiumId === "string" && normalizeVariant(v.variantPremiumId)) stored.variantPremiumId = normalizeVariant(v.variantPremiumId)!;
  if (typeof v.plannerProductId === "string" && normalizeProduct(v.plannerProductId)) stored.plannerProductId = normalizeProduct(v.plannerProductId)!;
}

export type ValidationResult = { ok: true; value: ShopifyIds } | { ok: false; error: string };

// Valida ciò che arriva dalla console. Una stringa vuota significa «togli il valore salvato», quindi torna quello d'ambiente.
export function validateShopifyIds(input: Partial<Record<keyof ShopifyIds, unknown>>): ValidationResult {
  const domain = typeof input.storeDomain === "string" ? input.storeDomain.trim().toLowerCase() : "";
  if (domain && !DOMAIN_RE.test(domain)) return { ok: false, error: "Il dominio del negozio deve essere del tipo nome-negozio.myshopify.com" };
  const base = typeof input.variantId === "string" ? input.variantId.trim() : "";
  const premium = typeof input.variantPremiumId === "string" ? input.variantPremiumId.trim() : "";
  const planner = typeof input.plannerProductId === "string" ? input.plannerProductId.trim() : "";
  if (base && !normalizeVariant(base)) return { ok: false, error: "L'ID della variante base non è valido: usa il numero della variante" };
  if (premium && !normalizeVariant(premium)) return { ok: false, error: "L'ID della variante del pacchetto non è valido: usa il numero della variante" };
  if (planner && !normalizeProduct(planner)) return { ok: false, error: "L'ID del prodotto planner non è valido: usa il numero del prodotto" };
  return {
    ok: true,
    value: {
      storeDomain: domain,
      variantId: normalizeVariant(base) ?? "",
      variantPremiumId: normalizeVariant(premium) ?? "",
      plannerProductId: normalizeProduct(planner) ?? "",
    },
  };
}

export async function saveShopifyIds(ids: ShopifyIds): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('shopify', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(ids)],
  );
  stored = { storeDomain: ids.storeDomain || undefined, variantId: ids.variantId || undefined, variantPremiumId: ids.variantPremiumId || undefined, plannerProductId: ids.plannerProductId || undefined };
  linksCache = null; // i link dei prodotti si ricalcolano con gli ID nuovi
}

// Stato di ogni voce per la console: da dove arriva il valore, senza mai restituire i segreti.
export type ShopifyItem = { key: string; label: string; required: boolean; source: ShopifySource; value: string | null; secret: boolean };

export function shopifyStatus(): ShopifyItem[] {
  const env = fromEnv();
  const ids = getShopifyIds();
  const srcOf = (saved: string | undefined, envValue: string): ShopifySource => (saved ? "console" : envValue ? "ambiente" : "assente");
  const token = storefrontToken();
  const secret = webhookSecret();
  return [
    { key: "storeDomain", label: "Dominio del negozio", required: true, source: srcOf(stored.storeDomain, env.storeDomain), value: ids.storeDomain || null, secret: false },
    { key: "variantId", label: "Variante dell'invito", required: true, source: srcOf(stored.variantId, env.variantId), value: ids.variantId || null, secret: false },
    { key: "plannerProductId", label: "Prodotto planner (venduto a parte)", required: false, source: srcOf(stored.plannerProductId, env.plannerProductId), value: ids.plannerProductId || null, secret: false },
    { key: "variantPremiumId", label: "Variante del pacchetto invito + planner", required: false, source: srcOf(stored.variantPremiumId, env.variantPremiumId), value: ids.variantPremiumId || null, secret: false },
    { key: "storefrontToken", label: "Token Storefront API", required: true, source: token ? "ambiente" : "assente", value: token ? "impostato nel .env" : null, secret: true },
    { key: "webhookSecret", label: "Segreto del webhook orders/paid", required: true, source: secret ? "ambiente" : "assente", value: secret ? "impostato nel .env" : null, secret: true },
  ];
}

export type ShopifyTest = { ok: boolean; shopName?: string; variantTitle?: string; productTitle?: string; price?: string; premiumTitle?: string; plannerTitle?: string; error?: string };

// Verifica reale: il token risponde, il negozio esiste e le varianti configurate sono vendibili.
export async function testShopify(): Promise<ShopifyTest> {
  const ids = getShopifyIds();
  const token = storefrontToken();
  if (!ids.storeDomain || !token) return { ok: false, error: "Mancano il dominio del negozio o il token Storefront" };
  const gql = async (query: string, variables: Record<string, unknown> = {}) => {
    const res = await fetch(`https://${ids.storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; errors?: { message: string }[] };
    if (!res.ok || json.errors?.length) throw new Error(json.errors?.[0]?.message ?? `HTTP ${res.status}`);
    return json.data ?? {};
  };
  const variantQuery = `query Variant($id: ID!) { node(id: $id) { ... on ProductVariant { title price { amount currencyCode } product { title } } } }`;
  try {
    const shop = (await gql("{ shop { name } }")).shop as { name?: string } | undefined;
    const out: ShopifyTest = { ok: true, shopName: shop?.name };
    if (ids.variantId) {
      const node = (await gql(variantQuery, { id: ids.variantId })).node as { title?: string; price?: { amount: string; currencyCode: string }; product?: { title: string } } | null;
      if (!node) return { ...out, ok: false, error: "La variante base non esiste in questo negozio" };
      out.variantTitle = node.title;
      out.productTitle = node.product?.title;
      out.price = node.price ? `${node.price.amount} ${node.price.currencyCode}` : undefined;
    }
    if (ids.variantPremiumId) {
      const node = (await gql(variantQuery, { id: ids.variantPremiumId })).node as { title?: string; product?: { title: string } } | null;
      if (!node) return { ...out, ok: false, error: "La variante del pacchetto non esiste in questo negozio" };
      out.premiumTitle = node.product?.title ?? node.title;
    }
    if (ids.plannerProductId) {
      const node = (await gql(`query Product($id: ID!) { node(id: $id) { ... on Product { title availableForSale } } }`, { id: ids.plannerProductId })).node as { title?: string } | null;
      if (!node?.title) return { ...out, ok: false, error: "Il prodotto planner non esiste in questo negozio" };
      out.plannerTitle = node.title;
    }
    return out;
  } catch (e) {
    return { ok: false, error: `Shopify non risponde correttamente: ${(e as Error).message}` };
  }
}

// Pagine prodotto del negozio, ricavate dagli ID della console: invito (dalla sua variante), planner (dal prodotto),
// pacchetto (pagina del prodotto con la variante scelta). Il planner può non essere visibile alla Storefront API:
// allora si cerca il suo handle nell'elenco pubblico dei prodotti del sito. Risultato in memoria per un'ora.
export type ShopLinks = { home: string; invitation: string | null; planner: string | null; bundle: string | null };
let linksCache: { at: number; value: ShopLinks } | null = null;

export async function shopLinks(): Promise<ShopLinks> {
  if (linksCache && Date.now() - linksCache.at < 3_600_000) return linksCache.value;
  const ids = getShopifyIds();
  const token = storefrontToken();
  const fallback: ShopLinks = { home: "https://www.thebespokeinvite.com", invitation: null, planner: null, bundle: null };
  if (!ids.storeDomain || !token) return fallback;
  try {
    const res = await fetch(`https://${ids.storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
      body: JSON.stringify({
        query: `query Links($v: ID!, $b: ID!) { shop { primaryDomain { url } } v: node(id: $v) { ... on ProductVariant { product { onlineStoreUrl } } } b: node(id: $b) { ... on ProductVariant { product { onlineStoreUrl } } } }`,
        variables: { v: ids.variantId || "gid://shopify/ProductVariant/0", b: ids.variantPremiumId || "gid://shopify/ProductVariant/0" },
      }),
      signal: AbortSignal.timeout(6000),
    });
    const d = ((await res.json()) as { data?: { shop?: { primaryDomain?: { url?: string } }; v?: { product?: { onlineStoreUrl?: string | null } } | null; b?: { product?: { onlineStoreUrl?: string | null } } | null } }).data;
    const home = (d?.shop?.primaryDomain?.url ?? fallback.home).replace(/\/$/, "");
    const value: ShopLinks = { home, invitation: d?.v?.product?.onlineStoreUrl ?? null, planner: null, bundle: null };
    const bundleProduct = d?.b?.product?.onlineStoreUrl;
    const bundleVariant = ids.variantPremiumId.split("/").pop();
    if (bundleProduct && bundleVariant) value.bundle = `${bundleProduct}?variant=${bundleVariant}`;
    const plannerId = ids.plannerProductId.split("/").pop();
    if (plannerId) {
      const list = await fetch(`${home}/products.json?limit=250`, { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { products?: { id: number; handle: string }[] } | null;
      const p = list?.products?.find((x) => String(x.id) === plannerId);
      if (p) value.planner = `${home}/products/${p.handle}`;
    }
    linksCache = { at: Date.now(), value };
    return value;
  } catch {
    return fallback;
  }
}
