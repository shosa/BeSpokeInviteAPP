import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// SEC-04 / NV-04: le bozze gratuite non danno richieste all'assistente e non si creano senza limite.
const USER = "66666666-6666-4666-8666-666666666666";
const DRAFT = "77777777-7777-4777-8777-777777777777";
const PAID = "88888888-8888-4888-8888-888888888888";

const app = await buildApp();
after(() => app.close());

function install(draftCount = 0) {
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [USER]: { email: "cliente@example.test" } });
    if (s) return s;
    if (/^SELECT \* FROM invitations i WHERE i.id = \$1/.test(sql)) {
      if (p[0] === DRAFT) return { rows: [{ id: DRAFT, user_id: USER, status: "draft", edit_count: 0, config: {}, assistant_calls: 0 }] };
      if (p[0] === PAID) return { rows: [{ id: PAID, user_id: USER, status: "paid", edit_count: 0, config: {}, assistant_calls: 0 }] };
    }
    if (/count\(\*\)::int AS n FROM invitations WHERE user_id = \$1 AND status <> 'paid'/.test(sql)) return { rows: [{ n: draftCount }] };
    return undefined;
  });
}
const ask = (id: string) => app.inject({ method: "POST", url: `/api/invitations/${id}/assistant`, headers: { cookie: sessionCookie(USER) }, payload: { messages: [{ role: "user", content: "ciao" }] } });

test("SEC-04: l'assistente non risponde su una bozza non pagata", async () => {
  install();
  delete process.env.ANTHROPIC_KEY;
  const res = await ask(DRAFT);
  assert.equal(res.statusCode, 404);
  // Invito pagato: supera il controllo (qui si ferma per la chiave mancante, senza chiamare il modello).
  const paid = await ask(PAID);
  assert.equal(paid.statusCode, 503);
});

test("NV-04: oltre 5 bozze non pagate non se ne creano altre", async () => {
  install(5);
  const res = await app.inject({ method: "POST", url: "/api/invitations", headers: { cookie: sessionCookie(USER) }, payload: { model: "invitation-rsvp" } });
  assert.equal(res.statusCode, 429);
  assert.ok(!queries.some((q) => /^INSERT INTO invitations/.test(q.sql)));
});

test("NV-04: in produzione un cliente non crea bozze senza acquisto", async () => {
  install(0);
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const res = await app.inject({ method: "POST", url: "/api/invitations", headers: { cookie: sessionCookie(USER) }, payload: { model: "invitation-rsvp" } });
    assert.equal(res.statusCode, 403);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
