import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// Hardening: in produzione un errore 5xx non rivela il messaggio interno (es. di PostgreSQL).
const app = await buildApp();
app.get("/__boom", async () => {
  throw new Error('relation "segreta" does not exist');
});
after(() => app.close());

test("5xx in produzione: messaggio generico", async () => {
  setHandler(() => undefined);
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const res = await app.inject({ method: "GET", url: "/__boom" });
    assert.equal(res.statusCode, 500);
    assert.ok(!res.body.includes("segreta"));
    assert.equal(res.json().error, "Errore interno: riprova tra poco");
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("4xx: il messaggio resta", async () => {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", headers: { "content-type": "text/xml" }, payload: "<x/>" });
  assert.equal(res.statusCode, 415);
  assert.equal(res.json().error, "Unsupported Media Type");
  assert.match(res.json().message, /Unsupported Media Type/i);
});
