import crypto from "crypto";
import { getShopifyIds, shopLinks, storefrontToken, webhookSecret, SHOPIFY_API_VERSION } from "./shopifySettings";

// Integrazione Shopify headless.
// - Con SHOPIFY_STORE_DOMAIN + SHOPIFY_STOREFRONT_TOKEN + SHOPIFY_VARIANT_ID: carrello reale e checkoutUrl Shopify.
// - Senza chiavi: nessun checkout reale. Il checkout di prova esiste solo se ALLOW_LOCAL_CHECKOUT o fuori produzione.
// Le conferme arrivano dal webhook orders/paid (firma HMAC verificata con SHOPIFY_WEBHOOK_SECRET).

export const shopifyConfigured = () => {
  const ids = getShopifyIds();
  return Boolean(ids.storeDomain && storefrontToken() && ids.variantId);
};

// Modalità demo: senza Shopify e con DEMO_MODE=true ogni acquisto va a buon fine (nessun pagamento reale).
// Con Shopify configurato la demo è sempre spenta: non può attivarsi per errore davanti a clienti veri.
export const demoMode = () => !shopifyConfigured() && process.env.DEMO_MODE === "true";

export const localCheckoutAllowed = () =>
  demoMode() || process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_CHECKOUT === "true";

// Due casi: invito già esistente (upgrade o bozza vecchia: invitationId) oppure acquisto prima dell'invito (orderId).
export type CheckoutInput = { invitationId?: string; orderId?: string; slug?: string; addons: string[]; totalCents: number; origin: string; kind?: "initial" | "upgrade"; tier?: string };

export async function createCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; source: "shopify" | "local" }> {
  if (!shopifyConfigured()) {
    const target = input.orderId ? `order=${input.orderId}` : `invitation=${input.invitationId}`;
    return { checkoutUrl: `${input.origin}/checkout/local?${target}`, source: "local" };
  }
  const ids = getShopifyIds();
  const domain = ids.storeDomain;
  const token = storefrontToken();
  // Il livello premium ha un prodotto suo, se configurato: il planner viene venduto a parte dalle funzioni.
  const variantId = input.tier === "premium" && ids.variantPremiumId ? ids.variantPremiumId : ids.variantId;

  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`;
  const attributes = [
    ...(input.orderId ? [{ key: "orderId", value: input.orderId }] : [{ key: "invitationId", value: input.invitationId ?? "" }]),
    { key: "slug", value: input.slug ?? "" },
    { key: "addons", value: input.addons.join(",") || "none" },
    { key: "totalCents", value: String(input.totalCents) },
    { key: "kind", value: input.kind ?? "initial" },
  ];
  const res = await fetch(`https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          lines: [{ merchandiseId: variantId, quantity: 1, attributes }],
          attributes: input.orderId ? [{ key: "orderId", value: input.orderId }] : [{ key: "invitationId", value: input.invitationId ?? "" }],
          note: `Bespoke Invites ${input.slug ?? input.orderId}`,
        },
      },
    }),
  });
  const json = (await res.json()) as {
    data?: { cartCreate?: { cart?: { checkoutUrl: string }; userErrors: { message: string }[] } };
    errors?: { message: string }[];
  };
  const url = json.data?.cartCreate?.cart?.checkoutUrl;
  if (!res.ok || !url) {
    const msg = json.errors?.[0]?.message ?? json.data?.cartCreate?.userErrors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Checkout Shopify non disponibile: ${msg}`);
  }
  return { checkoutUrl: url, source: "shopify" };
}

// Verifica X-Shopify-Hmac-Sha256 sul corpo grezzo, con confronto a tempo costante.
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | undefined): boolean {
  const secret = webhookSecret();
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Id invito dagli attributi dell'ordine (note_attributes o proprietà delle righe).
export function orderIdFromOrder(order: {
  note_attributes?: { name: string; value: string }[];
  line_items?: { properties?: { name: string; value: string }[] }[];
}): string | undefined {
  const fromNotes = order.note_attributes?.find((a) => a.name === "orderId")?.value;
  if (fromNotes) return fromNotes;
  for (const item of order.line_items ?? []) {
    const p = item.properties?.find((x) => x.name === "orderId")?.value;
    if (p) return p;
  }
  return undefined;
}

export function invitationIdFromOrder(order: {
  note_attributes?: { name: string; value: string }[];
  line_items?: { properties?: { name: string; value: string }[] }[];
}): string | undefined {
  const fromNotes = order.note_attributes?.find((a) => a.name === "invitationId")?.value;
  if (fromNotes) return fromNotes;
  for (const item of order.line_items ?? []) {
    const p = item.properties?.find((x) => x.name === "invitationId")?.value;
    if (p) return p;
  }
  return undefined;
}

// Ricarica dei crediti di BeSpoke AI: carrello con la variante dei crediti, legato all'invito.
// L'invito viaggia come attributo «aiCreditsFor» (non «invitationId», che il webhook usa per il pagamento dell'invito).
// Errore della ricarica con un messaggio da mostrare al cliente (e all'admin nei log).
export class CreditsCheckoutError extends Error {}

// La variante dei crediti: l'ID salvato può essere quello della variante o, per errore, quello del prodotto.
// Nel secondo caso si usa la prima variante del prodotto. Se l'API non vede nessuno dei due, il prodotto non è pubblicato
// nel canale di vendita collegato al token Storefront.
async function creditsMerchandise(domain: string, token: string, saved: string): Promise<string> {
  const num = saved.split("/").pop() ?? "";
  const res = await fetch(`https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({
      query: `query M($v: ID!, $p: ID!) { v: node(id: $v) { ... on ProductVariant { id availableForSale } } p: node(id: $p) { ... on Product { variants(first: 1) { nodes { id availableForSale } } } } }`,
      variables: { v: `gid://shopify/ProductVariant/${num}`, p: `gid://shopify/Product/${num}` },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const d = ((await res.json().catch(() => ({}))) as { data?: { v?: { id?: string; availableForSale?: boolean } | null; p?: { variants?: { nodes: { id: string; availableForSale: boolean }[] } } | null } }).data;
  const found = d?.v?.id ? d.v : d?.p?.variants?.nodes[0];
  if (!found?.id) throw new CreditsCheckoutError("Il prodotto dei crediti non è visibile al negozio: va pubblicato nel canale di vendita collegato al sito");
  if (found.availableForSale === false) throw new CreditsCheckoutError("I crediti non sono in vendita in questo momento");
  return found.id;
}

// Strada principale: il carrello del sito (Online Store), come per il planner. Il link /cart/<variante>:1 porta l'invito
// come attributo del carrello («aiCreditsFor»), che Shopify passa all'ordine e il webhook legge. La variante si ricava
// dall'elenco pubblico dei prodotti quando in console c'è l'ID del prodotto. Se il sito non lo trova, si prova la Storefront API.
export async function createAiCreditsCheckout(input: { invitationId: string; email?: string }): Promise<string> {
  const ids = getShopifyIds();
  if (!ids.variantAiCreditsId) throw new CreditsCheckoutError("Ricarica dei crediti non disponibile in questo momento");
  const { home } = await shopLinks();
  const savedNum = ids.variantAiCreditsId.split("/").pop() ?? "";
  const list = (await fetch(`${home}/products.json?limit=250`, { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as
    | { products?: { id: number; variants: { id: number; available: boolean }[] }[] }
    | null;
  const products = list?.products ?? [];
  const byProduct = products.find((p) => String(p.id) === savedNum);
  const byVariant = products.flatMap((p) => p.variants).find((v) => String(v.id) === savedNum);
  const variant = byVariant ?? byProduct?.variants.find((v) => v.available) ?? byProduct?.variants[0];
  if (variant) {
    if (variant.available === false) throw new CreditsCheckoutError("I crediti non sono in vendita in questo momento");
    const q = new URLSearchParams({ "attributes[aiCreditsFor]": input.invitationId, ...(input.email ? { "checkout[email]": input.email } : {}) });
    return `${home}/cart/${variant.id}:1?${q.toString()}`;
  }
  // Prodotto non pubblicato sul sito: ultima prova con la Storefront API (canale headless).
  const token = storefrontToken();
  if (!ids.storeDomain || !token) throw new CreditsCheckoutError("Il prodotto dei crediti non è visibile al negozio: va pubblicato nel canale di vendita collegato al sito");
  const merchandiseId = await creditsMerchandise(ids.storeDomain, token, ids.variantAiCreditsId);
  const res = await fetch(`https://${ids.storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({
      query: `mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { checkoutUrl } userErrors { message } } }`,
      variables: {
        input: {
          lines: [{ merchandiseId, quantity: 1, attributes: [{ key: "_aiCreditsFor", value: input.invitationId }] }],
          attributes: [{ key: "aiCreditsFor", value: input.invitationId }],
          ...(input.email ? { buyerIdentity: { email: input.email } } : {}),
          note: `Crediti BeSpoke AI · invito ${input.invitationId}`,
        },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { cartCreate?: { cart?: { checkoutUrl: string }; userErrors: { message: string }[] } }; errors?: { message: string }[] };
  const url = json.data?.cartCreate?.cart?.checkoutUrl;
  if (!res.ok || !url) throw new Error(json.errors?.[0]?.message ?? json.data?.cartCreate?.userErrors?.[0]?.message ?? `HTTP ${res.status}`);
  return url;
}
