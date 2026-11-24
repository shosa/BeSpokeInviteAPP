import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// SEC-07 / NV-05: il limite di un link al minuto per indirizzo non si azzera riempiendo la mappa,
// e un account non riceve più di qualche link all'ora.
const app = await buildApp();
after(() => app.close());
const settle = () => new Promise((r) => setTimeout(r, 30));
const tokens = () => queries.filter((q) => /^INSERT INTO access_tokens/.test(q.sql)).length;
const request = (email: string) => app.inject({ method: "POST", url: "/api/auth/request", payload: { email } });

test("SEC-07: oltre il tetto orario per account non parte un altro link", async () => {
  setHandler((sql) => (/FROM users u WHERE u.email = \$1/.test(sql) ? { rows: [{ id: "u2", recent: 5 }] } : undefined));
  const r = await app.inject({ method: "POST", url: "/api/auth/request", payload: { email: "altro-utente@example.test" } });
  await settle();
  assert.equal(r.statusCode, 200);
  assert.equal(tokens(), 0);
});

test("SEC-07: vittima → 5001 indirizzi spazzatura → vittima nello stesso minuto: nessuna seconda email", async () => {
  setHandler((sql, p) => (/FROM users u WHERE u.email = \$1/.test(sql) ? { rows: p[0] === "vittima@example.test" ? [{ id: "u1", recent: 0 }] : [] } : undefined));
  assert.equal((await request("vittima@example.test")).statusCode, 200);
  await settle();
  assert.equal(tokens(), 1);
  for (let i = 0; i <= 5001; i++) await request(`spazzatura-${i}@example.test`);
  const again = await request("vittima@example.test");
  assert.ok(again.statusCode === 200 || again.statusCode === 429);
  await settle();
  assert.equal(tokens(), 1);
});
