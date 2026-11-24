import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { hashToken } from "../src/auth";

// Hardening: cambiando password si chiudono le altre sessioni e si revocano i link di accesso.
const USER = "3e3e3e3e-3e3e-4e3e-8e3e-3e3e3e3e3e3e";
const app = await buildApp();
after(() => app.close());

test("cambio password: altre sessioni chiuse, link revocati, sessione attuale salva", async () => {
  setHandler((sql, p) => sessionUser(sql, p, { [USER]: { email: "cliente@example.test" } }) ?? undefined);
  const res = await app.inject({ method: "POST", url: "/api/auth/password", headers: { cookie: sessionCookie(USER) }, payload: { password: "una-password-nuova" } });
  assert.equal(res.statusCode, 200);
  const del = queries.find((q) => /^DELETE FROM sessions WHERE user_id = \$1 AND token_hash <> \$2/.test(q.sql));
  assert.ok(del);
  assert.deepEqual(del!.params, [USER, hashToken(`tok-${USER}`)]);
  assert.ok(queries.some((q) => /^UPDATE access_tokens SET revoked_at = now\(\) WHERE user_id = \$1/.test(q.sql) && q.params[0] === USER));
});
