import { test, after } from "node:test";
import assert from "node:assert/strict";
import { enabledThemes } from "@inviteme/shared";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { loadCatalog } from "../src/catalog";

// SEC-03: più richieste insieme sullo stesso acquisto pagato devono creare un solo invito.
const USER = "44444444-4444-4444-8444-444444444444";
const ORDER = "55555555-5555-4555-8555-555555555555";

const app = await buildApp();
after(() => app.close());

test("SEC-03: 3 claim concorrenti sullo stesso ordine → una 200, due 404, un solo invito", async () => {
  setHandler(() => undefined);
  const c = await loadCatalog();
  const themeId = enabledThemes(c, c.models[0].id)[0]?.id;
  assert.ok(themeId, "serve almeno un tema attivo nel repository");
  // Ordine pagato da attivare. La lettura senza lock lo vede sempre libero (READ COMMITTED, richieste parallele);
  // il blocco FOR UPDATE lo concede a una sola transazione, poi l'ordine risulta attivato.
  let taken = false;
  setHandler(async (sql, p) => {
    await new Promise((r) => setTimeout(r, 2));
    const s = sessionUser(sql, p, { [USER]: { email: "coppia@example.test" } });
    if (s) return s;
    if (/^SELECT id, user_id, draft, amount_cents, pro_client_id FROM orders/.test(sql)) return { rows: [{ id: ORDER, user_id: USER, draft: { model: c.models[0].id, themeId: "", eventType: "wedding", addons: [] }, amount_cents: 9900, pro_client_id: null }] };
    if (/FROM orders WHERE id = \$1 AND invitation_id IS NULL .*FOR UPDATE/.test(sql)) {
      if (taken || p[0] !== ORDER || p[1] !== USER) return { rows: [] };
      taken = true;
      return { rows: [{ id: ORDER }] };
    }
    return undefined;
  });
  const claim = () => app.inject({ method: "POST", url: "/api/account/claim", headers: { cookie: sessionCookie(USER) }, payload: { orderId: ORDER, themeId } });
  const res = await Promise.all([claim(), claim(), claim()]);
  const codes = res.map((r) => r.statusCode).sort();
  assert.deepEqual(codes, [200, 404, 404]);
  assert.equal(queries.filter((q) => /^INSERT INTO invitations/.test(q.sql)).length, 1);
});
