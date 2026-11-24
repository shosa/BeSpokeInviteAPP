import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// SEC-09: una risposta RSVP con una formula esce come testo nel CSV del proprietario.
const OWNER = "12121212-1212-4212-8212-121212121212";
const INV = "13131313-1313-4313-8313-131313131313";
const app = await buildApp();
after(() => app.close());

test("SEC-09: risposta =HYPERLINK(...) → cella \"'=HYPERLINK(...)\"", async () => {
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [OWNER]: { email: "sposi@example.test" } });
    if (s) return s;
    if (/^SELECT \* FROM invitations i WHERE i.id = \$1/.test(sql)) return { rows: [{ id: INV, slug: "anna-luca", user_id: OWNER, config: { rsvpQuestions: [{ id: "nome", label: "Nome", type: "text" }] } }] };
    if (/FROM rsvps WHERE invitation_id = \$1/.test(sql)) return { rows: [{ id: "r1", answers: { nome: '=HYPERLINK("http://evil.example","clic")' }, created_at: new Date().toISOString() }] };
    return undefined;
  });
  const res = await app.inject({ method: "GET", url: `/api/invitations/${INV}/rsvps?format=csv`, headers: { cookie: sessionCookie(OWNER) } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes(`"'=HYPERLINK(""http://evil.example"",""clic"")"`), res.body);
});
