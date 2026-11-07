import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDocs, sanitizeItem } from "../src/planner";

test("un invitato richiede il nome e accetta solo risposte ammesse", () => {
  assert.equal(sanitizeItem("guests", { group_name: "Famiglia" }, false).ok, false);
  const ok = sanitizeItem("guests", { name: "  Anna  ", response: "yes", party_size: 2 }, false);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.values, { name: "Anna", response: "yes", party_size: 2 });
  assert.equal(sanitizeItem("guests", { name: "Anna", response: "forse" }, false).ok, false);
});

test("le modifiche parziali accettano solo i campi presenti", () => {
  const r = sanitizeItem("budget", { paid: true }, true);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.values, { paid: true });
  assert.equal(sanitizeItem("budget", {}, true).ok, false);
});

test("le date vanno in formato AAAA-MM-GG e il vuoto le annulla", () => {
  assert.equal(sanitizeItem("budget", { label: "Fiori", due_date: "2027-03-01" }, false).ok, true);
  assert.equal(sanitizeItem("budget", { label: "Fiori", due_date: "01/03/2027" }, false).ok, false);
  const cleared = sanitizeItem("budget", { due_date: null }, true);
  assert.equal(cleared.ok, true);
  if (cleared.ok) assert.deepEqual(cleared.values, { due_date: null });
});

test("importi e giorni sono numeri non negativi entro il limite", () => {
  const r = sanitizeItem("budget", { label: "Musica", amount_cents: -500 }, false);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.values.amount_cents, 0);
  assert.equal(sanitizeItem("tasks", { title: "Prenotare", days_before: "abc" }, false).ok, false);
});

test("il contratto dei fornitori ha solo due stati", () => {
  assert.equal(sanitizeItem("vendors", { name: "Fiorista", contract_status: "signed" }, false).ok, true);
  assert.equal(sanitizeItem("vendors", { name: "Fiorista", contract_status: "bozza" }, false).ok, false);
});

test("la cartella accetta solo sezioni note: testi e righe tipizzate, con un limite", () => {
  const docs = sanitizeDocs({ "programma-generale": { items: [{ time: "10:00", item: "Cerimonia", extra: "x" }, { time: "", item: "" }] }, "palette": "Blu e avorio", "chiave-finta": "x", "chi-chiamare": "testo al posto di righe" }) ?? {};
  assert.deepEqual(docs, { "programma-generale": { items: [{ time: "10:00", item: "Cerimonia" }] }, palette: "Blu e avorio" });
  assert.equal(sanitizeDocs("stringa"), null);
  const many = { "programma-generale": { items: Array.from({ length: 120 }, (_, i) => ({ time: "10:00", item: "voce " + i })) } };
  assert.equal(sanitizeDocs(many)?.["programma-generale"] && (sanitizeDocs(many)!["programma-generale"] as { items: unknown[] }).items.length, 80);
});
