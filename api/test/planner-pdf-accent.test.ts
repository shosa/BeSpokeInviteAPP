import { test } from "node:test";
import assert from "node:assert/strict";
import { readableAccent } from "../src/planner-pdf";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

test("l'accento del PDF raggiunge 4,5:1 sul bianco anche per temi chiari", () => {
  for (const theme of ["#f5e6a8", "#d9b070", "#ffffff", "#8a6427", "non-un-colore"]) {
    const out = readableAccent(theme);
    assert.match(out, /^#[0-9a-f]{6}$/);
    assert.ok(1.05 / (lum(out) + 0.05) >= 4.5, `${theme} -> ${out} troppo chiaro`);
  }
});

test("un accento già leggibile non viene cambiato", () => {
  assert.equal(readableAccent("#8a6427"), "#8a6427");
});
