import { test, after } from "node:test";
import assert from "node:assert/strict";
import { defaultConfig, enabledThemes } from "@inviteme/shared";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { loadCatalog } from "../src/catalog";

// Hardening: il wizard su un invito già online cambia solo la bozza, non la pagina degli ospiti.
const OWNER = "9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c9c";
const INV = "9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d9d";
const app = await buildApp();
after(() => app.close());

async function run(editCount: number) {
  setHandler(() => undefined);
  const c = await loadCatalog();
  const model = c.models[0].id;
  const theme = enabledThemes(c, model)[0];
  const config = defaultConfig(theme, model, "wedding", new Set(["rsvp"]));
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [OWNER]: { email: "sposi@example.test" } });
    if (s) return s;
    if (/^SELECT \* FROM invitations i WHERE i.id = \$1/.test(sql)) return { rows: [{ id: INV, user_id: OWNER, status: "paid", edit_count: editCount, config, planner: {} }] };
    return undefined;
  });
  const res = await app.inject({ method: "PUT", url: `/api/invitations/${INV}/setup`, headers: { cookie: sessionCookie(OWNER) }, payload: { title: "Anna e Luca", eventDate: "2027-06-12", venue: "Villa" } });
  return { res, update: queries.find((q) => /^UPDATE invitations SET config = \$2/.test(q.sql)) };
}

test("invito già pubblicato: published_config non cambia", async () => {
  const { res, update } = await run(1);
  assert.equal(res.statusCode, 200, res.body);
  assert.ok(update && !/published_config/.test(update.sql));
});

test("invito mai pubblicato: bozza e versione pubblicata restano allineate", async () => {
  const { res, update } = await run(0);
  assert.equal(res.statusCode, 200, res.body);
  assert.ok(update && /published_config = \$2/.test(update.sql));
});
