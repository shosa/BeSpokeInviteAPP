import { test } from "node:test";
import assert from "node:assert/strict";
import { localRedirect, safePath } from "../../web/lib/redirect";

// Hardening redirect (web): solo percorsi dello stesso sito, Location relativa (niente Host / X-Forwarded-Host).
test("safePath accetta solo percorsi locali", () => {
  assert.equal(safePath("/account?x=1"), "/account?x=1");
  assert.equal(safePath("//evil.example/x"), "/");
  assert.equal(safePath("/\\evil.example"), "/");
  assert.equal(safePath("https://evil.example"), "/");
  assert.equal(safePath(null), "/");
});

test("localRedirect usa una Location relativa", () => {
  const r = localRedirect("/account");
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/account");
});

test("hardening: i parametri di percorso delle pagine devono essere UUID", async () => {
  const { isUuid } = await import("../../web/lib/ids");
  assert.equal(isUuid("1e1e1e1e-1e1e-4e1e-8e1e-1e1e1e1e1e1e"), true);
  assert.equal(isUuid("..%2Fadmin%2Fusers"), false);
  assert.equal(isUuid("../admin"), false);
});
