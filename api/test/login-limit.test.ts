import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { hashPassword } from "../src/auth";

// SEC-06: tentativi falliti di altri (anche 300 e più) non bloccano il login corretto di un'altra persona.
const app = await buildApp();
after(() => app.close());

test("SEC-06: 300 login falliti con email diverse → il login corretto non riceve 429", async () => {
  const hash = await hashPassword("password-giusta");
  setHandler((sql, p) => {
    if (/FROM users WHERE email = \$1/.test(sql)) return { rows: p[0] === "vittima@example.test" ? [{ id: "u1", email: "vittima@example.test", name: "V", role: "user", password_hash: hash }] : [] };
    return undefined;
  });
  for (let i = 0; i < 301; i++) {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: `spazzatura-${i}@example.test`, password: "x" } });
    assert.equal(r.statusCode, 401);
  }
  const ok = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "vittima@example.test", password: "password-giusta" } });
  assert.equal(ok.statusCode, 200);
});

test("SEC-06: il limite per email resta (6 tentativi)", async () => {
  setHandler(() => undefined);
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "bersaglio@example.test", password: "x" } })).statusCode);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 401, 429]);
});
