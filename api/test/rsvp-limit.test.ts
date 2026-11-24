import { test, after } from "node:test";
import assert from "node:assert/strict";
import { enabledThemes } from "@inviteme/shared";
import { setHandler, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { loadCatalog } from "../src/catalog";

// NV-02: le risposte anonime a un invito hanno un tetto, e il proprietario non riceve un'email per ognuna.
const INV = "7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a";
const app = await buildApp();
after(() => app.close());

test("NV-02: oltre 60 risposte in 10 minuti → 429; al massimo 20 email al proprietario", async () => {
  setHandler(() => undefined);
  const c = await loadCatalog();
  const model = c.models[0].id;
  const themeId = enabledThemes(c, model)[0].id;
  const config = { themeId, model, addons: ["rsvp"], blocks: [{ id: "b1", type: "rsvp", props: {} }], rsvpQuestions: [], event: { title: "Anna e Luca" } };
  setHandler((sql, p) => {
    if (/FROM invitations i JOIN users u ON u.id = i.user_id\s+WHERE i.slug = \$1/.test(sql)) return { rows: p[0] === "anna-luca" ? [{ id: INV, config, owner_email: "sposi@example.test" }] : [] };
    return undefined;
  });
  const codes: number[] = [];
  for (let i = 0; i < 61; i++) codes.push((await app.inject({ method: "POST", url: "/api/rsvp", payload: { slug: "anna-luca", answers: {} } })).statusCode);
  assert.ok(codes.slice(0, 60).every((c) => c === 201), JSON.stringify(codes));
  assert.equal(codes[60], 429);
  assert.equal(queries.filter((q) => /^INSERT INTO rsvps/.test(q.sql)).length, 60);
  assert.equal(queries.filter((q) => /^INSERT INTO outbox/.test(q.sql)).length, 20);
});

test("hardening: l'RSVP valida le domande della versione pubblicata, non della bozza", async () => {
  setHandler(() => undefined);
  const c = await loadCatalog();
  const model = c.models[0].id;
  const themeId = enabledThemes(c, model)[0].id;
  const base = { themeId, model, addons: ["rsvp"], blocks: [{ id: "b1", type: "rsvp", props: {} }], event: { title: "Anna e Luca" } };
  // In bozza c'è una domanda obbligatoria nuova che gli ospiti non vedono ancora.
  const draft = { ...base, rsvpQuestions: [{ id: "nuova", label: "Domanda in bozza", type: "text", required: true }] };
  const live = { ...base, rsvpQuestions: [{ id: "nome", label: "Nome", type: "text", required: true }] };
  setHandler((sql, p) => {
    if (/WHERE i.slug = \$1 AND i.status = 'paid'/.test(sql)) return { rows: p[0] === "altro-invito" ? [{ id: "8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8b8b", config: draft, published_config: live, owner_email: "sposi@example.test" }] : [] };
    return undefined;
  });
  const res = await app.inject({ method: "POST", url: "/api/rsvp", payload: { slug: "altro-invito", answers: { nome: "Marta" } } });
  assert.equal(res.statusCode, 201);
  const saved = queries.find((q) => /^INSERT INTO rsvps/.test(q.sql));
  assert.deepEqual(JSON.parse(String(saved?.params[2])), { nome: "Marta" });
});
