import { test } from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, validateMailTemplate, MAIL_TEMPLATE_DEFAULTS, MAIL_KINDS } from "../src/mailTemplates";
import { renderMail } from "../src/mail";

test("le variabili si sostituiscono e quelle mancanti diventano vuote", () => {
  assert.equal(fillTemplate("Ciao {{title}}, {{missing}}!", { title: "Anna e Luca" }), "Ciao Anna e Luca, !");
});

test("ogni tipo di email ha un modello predefinito valido", () => {
  for (const kind of MAIL_KINDS) {
    const r = validateMailTemplate(MAIL_TEMPLATE_DEFAULTS[kind]);
    assert.ok(r.ok, kind);
  }
});

test("un modello con script o con campi troppo lunghi viene rifiutato", () => {
  const base = MAIL_TEMPLATE_DEFAULTS.rsvp;
  assert.equal(validateMailTemplate({ ...base, body: "<script>alert(1)</script>" }).ok, false);
  assert.equal(validateMailTemplate({ ...base, subject: "x".repeat(151) }).ok, false);
  assert.equal(validateMailTemplate({ ...base, button: "" }).ok, false);
});

test("il testo scritto dalla console viene escapato nell'HTML", () => {
  const m = renderMail("rsvp", { ...MAIL_TEMPLATE_DEFAULTS.rsvp, body: "Ciao <b>Anna</b> & Luca" }, { link: "https://x.test/i/a", title: "T", verdict: "parteciperà" });
  assert.match(m.html, /Ciao &lt;b&gt;Anna&lt;\/b&gt; &amp; Luca/);
  assert.doesNotMatch(m.html, /<b>Anna/);
});
