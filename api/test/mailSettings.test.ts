import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMailSettings, fromAddress, MAIL_DEFAULTS } from "../src/mailSettings";

test("il mittente accetta nome ed email validi e normalizza l'email", () => {
  const r = validateMailSettings({ fromName: " Bespoke Invites ", fromEmail: " Ciao@Dominio.it ", replyTo: "", sendInvites: true, notifyRsvp: false, orderConfirm: true });
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.fromName, "Bespoke Invites");
  assert.equal(r.ok && r.value.fromEmail, "ciao@dominio.it");
  assert.equal(r.ok && r.value.notifyRsvp, false);
});

test("nome o indirizzi non validi vengono rifiutati", () => {
  assert.equal(validateMailSettings({ fromName: "" }).ok, false);
  assert.equal(validateMailSettings({ fromName: "Evil <x@y.it>" }).ok, false);
  assert.equal(validateMailSettings({ fromName: "Ok", fromEmail: "non-una-email" }).ok, false);
  assert.equal(validateMailSettings({ fromName: "Ok", replyTo: "a@b" }).ok, false);
});

test("gli interruttori sono attivi solo se vale true", () => {
  const r = validateMailSettings({ fromName: "Ok", sendInvites: "yes", notifyRsvp: 1 });
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.sendInvites, false);
  assert.equal(r.ok && r.value.notifyRsvp, false);
  assert.equal(r.ok && r.value.orderConfirm, false);
});

test("il mittente senza impostazioni usa il valore di prova di Resend", () => {
  assert.equal(MAIL_DEFAULTS.fromEmail, "");
  assert.match(fromAddress(), /onboarding@resend\.dev|<.+@.+>/);
});
