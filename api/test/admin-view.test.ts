import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// Hardening: l'anteprima admin cerca un UUID solo per id, il resto solo per slug.
const app = await buildApp();
after(() => app.close());

test("UUID → ricerca per id; slug → ricerca per slug", async () => {
  setHandler(() => undefined);
  await app.inject({ method: "GET", url: "/api/admin/invitations/1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e/view" });
  assert.ok(queries.some((q) => /FROM invitations WHERE id = \$1$/.test(q.sql)));
  assert.ok(!queries.some((q) => /slug = \$1 OR id::text/.test(q.sql)));
  setHandler(() => undefined);
  await app.inject({ method: "GET", url: "/api/admin/invitations/anna-luca/view" });
  assert.ok(queries.some((q) => /FROM invitations WHERE slug = \$1$/.test(q.sql)));
});
