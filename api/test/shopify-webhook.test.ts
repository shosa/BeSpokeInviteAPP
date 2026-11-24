import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { setHandler, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { loadShopifySettings } from "../src/shopifySettings";

// SEC-02: gli attributi del carrello (invitationId / orderId) li sceglie chi compra: senza una variante dell'invito
// e un importo coerente non devono segnare pagato nulla.
const SECRET = "segreto-di-prova-non-reale";
process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
const INVITE_VARIANT = 111111;
const CREDITS_VARIANT = 777777;
const DRAFT = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";

const app = await buildApp();
after(() => app.close());
before(async () => {
  setHandler((sql) => (/FROM settings WHERE key = 'shopify'/.test(sql) ? { rows: [{ value: { variantId: String(INVITE_VARIANT), variantAiCreditsId: String(CREDITS_VARIANT), aiCreditsPerPack: "20" } }] } : undefined));
  await loadShopifySettings();
});

type Inv = { status: string; bonus: number };
function install(opts: { pendingCents?: number } = {}) {
  const inv: Inv = { status: "draft", bonus: 0 };
  setHandler((sql, p) => {
    if (/^UPDATE invitations SET status = 'paid'/.test(sql) && p[0] === DRAFT) inv.status = "paid";
    if (/^UPDATE invitations SET assistant_bonus/.test(sql) && p[0] === DRAFT) inv.bonus += Number(p[1]);
    if (/^INSERT INTO orders/.test(sql) && /FROM invitations i WHERE i.id = \$2/.test(sql)) return { rowCount: p[1] === DRAFT ? 1 : 0 };
    if (/FROM orders o JOIN invitations i ON i.id = o.invitation_id WHERE o.invitation_id = \$1 AND o.status = 'pending'/.test(sql)) {
      return opts.pendingCents !== undefined && p[0] === DRAFT ? { rows: [{ id: "ord-1", kind: "initial", addons: null, amount_cents: opts.pendingCents, currency: "EUR", status: inv.status }] } : { rows: [] };
    }
    if (/^SELECT id, status FROM invitations WHERE id = \$1/.test(sql)) return { rows: p[0] === DRAFT ? [{ id: DRAFT, status: inv.status }] : [] };
    if (/FROM invitations i JOIN users u/.test(sql)) return { rows: [{ slug: DRAFT, config: { event: {} }, email: "owner@example.test" }] };
    if (/^INSERT INTO users/.test(sql)) return { rows: [{ id: OWNER }] };
    return undefined;
  });
  return inv;
}

function send(body: unknown) {
  const raw = JSON.stringify(body);
  const hmac = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("base64");
  return app.inject({ method: "POST", url: "/api/webhooks/shopify", headers: { "content-type": "application/json", "x-shopify-hmac-sha256": hmac, "x-shopify-topic": "orders/paid" }, payload: raw });
}

const order = (over: Record<string, unknown>) => ({ id: 555001, name: "#9001", email: "buyer@example.test", total_price: "0.50", currency: "EUR", note_attributes: [{ name: "invitationId", value: DRAFT }], ...over });

test("SEC-02: variante estranea + invitationId di una bozza → la bozza resta draft", async () => {
  const inv = install({ pendingCents: 9900 });
  const res = await send(order({ line_items: [{ variant_id: 999999, product_id: 888888, quantity: 1 }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(inv.status, "draft");
});

test("SEC-02: crediti AI + invitationId → solo crediti, invito non pagato", async () => {
  const inv = install({ pendingCents: 9900 });
  const res = await send(order({ id: 555002, total_price: "4.90", note_attributes: [{ name: "invitationId", value: DRAFT }, { name: "aiCreditsFor", value: DRAFT }], line_items: [{ variant_id: CREDITS_VARIANT, quantity: 1 }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(inv.status, "draft");
  assert.equal(inv.bonus, 20);
});

test("SEC-02: variante invito ma nessun pagamento in attesa per quell'invito → non pagato", async () => {
  const inv = install();
  await send(order({ id: 555003, total_price: "99.00", line_items: [{ variant_id: INVITE_VARIANT, quantity: 1 }] }));
  assert.equal(inv.status, "draft");
});

test("SEC-02: variante invito con importo inferiore all'ordine in attesa → non pagato", async () => {
  const inv = install({ pendingCents: 9900 });
  await send(order({ id: 555004, total_price: "1.00", line_items: [{ variant_id: INVITE_VARIANT, quantity: 1 }] }));
  assert.equal(inv.status, "draft");
});

test("SEC-02: variante invito e importo giusto → pagato", async () => {
  const inv = install({ pendingCents: 9900 });
  const res = await send(order({ id: 555005, total_price: "99.00", line_items: [{ variant_id: INVITE_VARIANT, quantity: 1 }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(inv.status, "paid");
});

test("SEC-02: ordine pending (orderId) con importo inferiore → nessun invito creato", async () => {
  install();
  setHandler((sql, p) => {
    if (/FROM orders WHERE id = \$1 AND status = 'pending' AND draft IS NOT NULL/.test(sql) && p[0] === "ord-x") return { rows: [{ id: "ord-x", user_id: OWNER, draft: { model: "invitation-rsvp", themeId: "", eventType: "wedding", addons: [] }, amount_cents: 9900, currency: "EUR", invitation_id: null }] };
    if (/^INSERT INTO users/.test(sql)) return { rows: [{ id: OWNER }] };
    return undefined;
  });
  const res = await send(order({ id: 555006, total_price: "1.00", note_attributes: [{ name: "orderId", value: "ord-x" }], line_items: [{ variant_id: INVITE_VARIANT, quantity: 1 }] }));
  assert.equal(res.statusCode, 200);
  assert.ok(!queries.some((q) => /^INSERT INTO invitations/.test(q.sql)));
});
