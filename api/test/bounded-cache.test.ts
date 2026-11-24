import { test } from "node:test";
import assert from "node:assert/strict";
import { BoundedCache } from "../src/boundedCache";

// Hardening: le cache delle ricerche (indirizzi, meteo) non crescono senza limite.
test("oltre il massimo si tolgono le voci più vecchie", () => {
  const c = new BoundedCache<number>(60_000, 3);
  for (let i = 0; i < 10; i++) c.set(`k${i}`, i);
  assert.equal(c.size, 3);
  assert.equal(c.get("k0"), undefined);
  assert.equal(c.get("k9"), 9);
});

test("le voci scadute non tornano", () => {
  const c = new BoundedCache<string>(-1, 10);
  c.set("a", "x");
  assert.equal(c.get("a"), undefined);
});
