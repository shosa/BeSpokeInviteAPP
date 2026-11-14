import { test } from "node:test";
import assert from "node:assert/strict";
import { applySetup, setupDefaults, makeBlock, type InviteConfig } from "../src/index";

const base = (): InviteConfig => ({
  themeId: "t", model: "m", addons: [], eventType: "wedding", locale: "it", event: { title: "", eventDate: "" },
  blocks: [makeBlock("cover"), makeBlock("hero"), makeBlock("message"), makeBlock("venue"), makeBlock("map"), makeBlock("rsvp"), makeBlock("footer")],
  rsvpQuestions: [],
});
const types = (c: InviteConfig) => c.blocks.map((b) => b.type);

test("le risposte vuote tolgono Location, Mappa, Firma e Conferma", () => {
  const c = applySetup(base(), { title: "A & B", eventDate: "2027-06-12", venue: "", address: "", signature: "", rsvp: false, questions: [] });
  assert.deepEqual(types(c), ["cover", "hero", "message"]);
  assert.deepEqual(c.rsvpQuestions, []);
});

test("le risposte compilate aggiungono i blocchi al loro posto e impostano i testi", () => {
  const start = base();
  start.blocks = start.blocks.filter((b) => ["cover", "hero", "message"].includes(b.type));
  const c = applySetup(start, { title: "A & B", eventDate: "2027-06-12", venue: "Villa Aurelia", address: "Via X 1, Roma", signature: "Grazie!", rsvp: true, questions: [{ id: "name", label: "Nome", type: "text", required: true }] });
  assert.deepEqual(types(c), ["cover", "hero", "message", "venue", "map", "rsvp", "footer"]);
  assert.equal(c.blocks.find((b) => b.type === "venue")!.props.venue, "Villa Aurelia");
  assert.equal(c.blocks.find((b) => b.type === "footer")!.props.signature, "Grazie!");
  assert.equal(c.event.address, "Via X 1, Roma");
  // La domanda sulla presenza viene aggiunta se manca.
  assert.ok(c.rsvpQuestions.some((q) => q.id === "attending" && q.type === "yes-no"));
});

test("i valori di partenza si leggono dalla configurazione", () => {
  const c = base();
  c.blocks.find((b) => b.type === "venue")!.props.venue = "Villa";
  c.blocks.find((b) => b.type === "footer")!.props.signature = "Ciao";
  const d = setupDefaults(c);
  assert.equal(d.venue, "Villa");
  assert.equal(d.signature, "Ciao");
  assert.equal(d.rsvp, true);
});
