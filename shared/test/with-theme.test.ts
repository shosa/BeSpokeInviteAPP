import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTheme, type InviteConfig } from "../src/index";

// Cambio di template: contenuto e blocchi restano, si tolgono solo i colori personalizzati dei blocchi.
describe("withTheme", () => {
  const config = {
    themeId: "a",
    model: "m",
    addons: [],
    eventType: "wedding",
    locale: "it",
    event: { title: "Anna e Luca" },
    blocks: [
      { id: "b1", type: "hero", props: { title: "Ciao", lookBg: "#000", lookInk: "#fff", lookCover: "x" } },
      { id: "b2", type: "message", hidden: true, props: { text: "Testo" } },
    ],
    rsvpQuestions: [],
  } as unknown as InviteConfig;

  it("cambia il template e tiene contenuto, ordine e blocchi nascosti", () => {
    const out = withTheme(config, "b");
    assert.equal(out.themeId, "b");
    assert.deepEqual(out.event, config.event);
    assert.deepEqual(out.blocks.map((b) => b.id), ["b1", "b2"]);
    assert.equal(out.blocks[0].props.title, "Ciao");
    assert.equal(out.blocks[1].hidden, true);
  });

  it("toglie i colori personalizzati senza toccare la configurazione di partenza", () => {
    const out = withTheme(config, "b");
    assert.equal("lookBg" in out.blocks[0].props, false);
    assert.equal("lookInk" in out.blocks[0].props, false);
    assert.equal("lookCover" in out.blocks[0].props, false);
    assert.equal(config.blocks[0].props.lookBg, "#000");
  });
});
