import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTranslations, cleanExtraLocales, translatableTexts, type InviteConfig } from "../src/index";

// Testi da tradurre: blocchi (anche nelle liste), riga di apertura, domande. Non i nomi, il luogo, gli orari.
describe("testi traducibili", () => {
  const config = {
    themeId: "a", model: "m", addons: [], eventType: "wedding", locale: "it",
    event: { title: "Giulia & Matteo", hosts: "Con le loro famiglie", venue: "Villa Rosa", address: "Via Roma 1" },
    blocks: [
      { id: "c", type: "cover", props: { topText: "Per voi", sealText: "G·M" } },
      { id: "v", type: "venue", props: { heading: "Dove", venue: "Villa Rosa" } },
      { id: "p", type: "program", props: { heading: "Programma", items: [{ time: "17:30", label: "Cerimonia" }] } },
    ],
    rsvpQuestions: [{ id: "attending", label: "Ci sarai?", type: "yes-no", yes: "Sì", no: "No" }, { id: "menu", label: "Menu", type: "choice", options: ["Carne", "Pesce"] }],
  } as unknown as InviteConfig;

  it("raccoglie solo i testi da tradurre", () => {
    const t = translatableTexts(config);
    for (const x of ["Con le loro famiglie", "Per voi", "Dove", "Programma", "Cerimonia", "Ci sarai?", "Carne", "Pesce"]) assert.ok(t.includes(x), x);
    for (const x of ["Giulia & Matteo", "Villa Rosa", "G·M", "17:30", "Via Roma 1"]) assert.ok(!t.includes(x), x);
  });

  it("applica le traduzioni senza toccare nomi, orari e id", () => {
    const out = applyTranslations(config, { "Cerimonia": "Ceremony", "Carne": "Meat", "Ci sarai?": "Will you come?" });
    const items = out.blocks[2].props.items as { time: string; label: string }[];
    assert.deepEqual(items[0], { time: "17:30", label: "Ceremony" });
    assert.equal(out.rsvpQuestions[0].label, "Will you come?");
    assert.equal(out.rsvpQuestions[0].id, "attending");
    assert.deepEqual(out.rsvpQuestions[1].options, ["Meat", "Pesce"]);
    assert.equal(out.event.title, "Giulia & Matteo");
    assert.equal(out.blocks[0].props.sealText, "G·M");
  });

  it("le lingue in più escludono la principale e i valori non validi", () => {
    assert.deepEqual(cleanExtraLocales("it", ["fr", "it", "xx", "en", "fr"]), ["en", "fr"]);
  });
});
