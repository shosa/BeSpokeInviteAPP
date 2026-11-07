import crypto from "crypto";
import { getShopifyIds, storefrontToken, webhookSecret, SHOPIFY_API_VERSION } from "./shopifySettings";

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
