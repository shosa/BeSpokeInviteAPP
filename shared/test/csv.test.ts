import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvRow } from "../src/csv";

// SEC-09 / NV-06: le risposte degli ospiti e i nomi dei clienti non diventano formule nel foglio di calcolo.
test("i valori che iniziano come una formula restano testo", () => {
  assert.equal(csvCell('=HYPERLINK("http://x","clic")'), `"'=HYPERLINK(""http://x"",""clic"")"`);
  for (const v of ["+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) assert.ok(csvCell(v).startsWith(`"'`), v);
});

test("i valori normali restano uguali, quotati", () => {
  assert.equal(csvCell("Anna e Luca"), '"Anna e Luca"');
  assert.equal(csvCell(3), '"3"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvRow(["a", "b"], ";"), '"a";"b"');
});
