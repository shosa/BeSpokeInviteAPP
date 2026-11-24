import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// SEC-01: uno studio Pro non deve mai ricevere il link di accesso di un account che esisteva già.
const STUDIO = "aaaaaaaa-0000-4000-8000-000000000001";
const STUDIO_B = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000003";
const CUSTOMER = "aaaaaaaa-0000-4000-8000-000000000004";
const CLIENT = "bbbbbbbb-0000-4000-8000-000000000001";

const app = await buildApp();
after(() => app.close());

function install() {
  const users = new Map<string, { id: string; role: string }>([
    ["studio@example.test", { id: STUDIO, role: "user" }],
    ["studio-b@example.test", { id: STUDIO_B, role: "user" }],
    ["boss@example.test", { id: ADMIN, role: "admin" }],
    ["cliente@example.test", { id: CUSTOMER, role: "user" }],
  ]);
  const studios = new Set([STUDIO, STUDIO_B]);
  const tokens: string[] = [];
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [STUDIO]: { email: "studio@example.test" } });
    if (s) return s;
    if (/FROM pro_studios WHERE user_id = \$1/.test(sql) && p[0] === STUDIO) return { rows: [{ user_id: STUDIO, name: "Studio A", active: true }] };
    if (/FROM pro_clients WHERE id = \$1 AND studio_id = \$2/.test(sql)) return p[0] === CLIENT && p[1] === STUDIO ? { rows: [{ id: CLIENT, name: "Anna e Luca", email: "" }] } : { rows: [] };
    if (/^INSERT INTO users/.test(sql)) {
      const email = String(p[1]);
      if (users.has(email)) return /DO NOTHING/.test(sql) ? { rows: [] } : { rows: [{ id: users.get(email)!.id }] };
      users.set(email, { id: String(p[0]), role: "user" });
      return { rows: [{ id: p[0] }] };
    }
    if (/FROM users u WHERE u\.email = \$1/.test(sql)) {
      const u = users.get(String(p[0]));
      return { rows: u ? [{ id: u.id, role: u.role, studio: studios.has(u.id) }] : [] };
    }
    if (/^INSERT INTO access_tokens/.test(sql)) tokens.push(String(p[1]));
    return undefined;
  });
  return { tokens };
}

const grant = (email: string) =>
  app.inject({ method: "POST", url: `/api/pro/clients/${CLIENT}/access`, headers: { cookie: sessionCookie(STUDIO) }, payload: { email, send: true } });

test("SEC-01: email di un admin → 400, nessun token creato", async () => {
  const { tokens } = install();
  const res = await grant("boss@example.test");
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "Email non utilizzabile");
  assert.equal(tokens.length, 0);
  assert.ok(!queries.some((q) => /INSERT INTO pro_access/.test(q.sql)));
});

test("SEC-01: email di un altro studio → 400, nessun token creato", async () => {
  const { tokens } = install();
  const res = await grant("studio-b@example.test");
  assert.equal(res.statusCode, 400);
  assert.equal(tokens.length, 0);
});

test("SEC-01: email dello studio stesso → 400", async () => {
  install();
  const res = await grant("studio@example.test");
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "Questa è l'email dello studio");
});

test("SEC-01: cliente già esistente → 200 senza link (solo email al cliente)", async () => {
  const { tokens } = install();
  const res = await grant("cliente@example.test");
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.link, undefined);
  assert.equal(tokens.length, 1);
  // Il link è andato solo all'indirizzo del cliente (outbox, senza Resend).
  assert.ok(queries.some((q) => /INSERT INTO outbox/.test(q.sql) && q.params[0] === "cliente@example.test"));
});

test("SEC-01: email nuova → 200 con link", async () => {
  install();
  const res = await grant("nuova-coppia@example.test");
  assert.equal(res.statusCode, 200);
  assert.match(String(res.json().link), /\/accesso\//);
});

test("SEC-01: la revoca toglie i link degli account creati dallo studio", async () => {
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [STUDIO]: { email: "studio@example.test" } });
    if (s) return s;
    // Studio sospeso: la revoca vale lo stesso.
    if (/FROM pro_studios WHERE user_id = \$1/.test(sql)) return { rows: [{ user_id: STUDIO, name: "Studio A", active: false }] };
    if (/FROM pro_clients WHERE id = \$1 AND studio_id = \$2/.test(sql)) return { rows: [{ id: CLIENT, name: "Anna e Luca", email: "" }] };
    if (/^DELETE FROM pro_access/.test(sql)) return { rows: [{ user_id: CUSTOMER, created_user: true }] };
    return undefined;
  });
  const res = await app.inject({ method: "DELETE", url: `/api/pro/clients/${CLIENT}/access?email=cliente@example.test`, headers: { cookie: sessionCookie(STUDIO) } });
  assert.equal(res.statusCode, 200);
  assert.ok(queries.some((q) => /UPDATE access_tokens SET revoked_at = now\(\)/.test(q.sql) && q.params[0] === CUSTOMER));
});
