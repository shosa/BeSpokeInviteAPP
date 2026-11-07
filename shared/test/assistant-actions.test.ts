import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATALOG, MODEL_ID, defaultConfig, makeBlock, validateActions, MAX_BLOCKS, type ActionContext, type BlockType, type Catalog, type InviteConfig, type ThemeManifest } from "../src/index";

// Catalogo di prova: "save-the-date" ha le funzioni solo come opzioni (non incluse), "invitation-rsvp" le ha tutte incluse.
const theme = (id: string): ThemeManifest => ({ engine: 2, id, name: id, description: "", models: [], themeColor: "#FFFFFF", fonts: [], demo: {} });
const catalog: Catalog = { ...DEFAULT_CATALOG, themes: [{ enabled: true, manifest: theme("tema-a") }, { enabled: true, manifest: theme("tema-b") }], music: [] };
const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({ catalog, paid: false, purchased: new Set(), ...over });

// Invito di partenza: copertina (ancorata in cima), principale (fisso), messaggio e galleria (funzione inclusa nel modello).
function base(model = MODEL_ID): InviteConfig {
  const c = defaultConfig(theme("tema-a"), model, "wedding", new Set(DEFAULT_CATALOG.models[0].included));
  return { ...c, blocks: [...c.blocks, makeBlock("message"), makeBlock("gallery")] };
}

const blockOf = (c: InviteConfig, type: string) => c.blocks.find((b) => b.type === type)!;

describe("azioni dell'assistente: validatore", () => {
  it("accetta una modifica valida dei dati dell'evento", () => {
    const c = base();
    const before = JSON.stringify(c);
    const r = validateActions(c, [{ tool: "setEvent", key: "address", value: "Via Roma 1" }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.equal(r.config.event.address, "Via Roma 1");
    assert.equal(JSON.stringify(c), before, "la configurazione d'ingresso non cambia");
  });

  it("scarta una chiave di evento sconosciuta", () => {
    const r = validateActions(base(), [{ tool: "setEvent", key: "venue", value: "x" }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /sconosciuto/);
  });

  it("scarta un id di blocco inesistente", () => {
    const r = validateActions(base(), [{ tool: "setBlockProp", blockId: "non-esiste", key: "heading", value: "ciao" }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /inesistente/);
  });

  it("taglia un testo oltre il massimo invece di rifiutare l'azione", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const r = validateActions(c, [{ tool: "setBlockProp", blockId: msg.id, key: "body", value: "a".repeat(5000) }], ctx());
    assert.equal(r.rejected.length, 0, "il testo lungo non è un errore");
    const saved = String(r.config.blocks.find((b) => b.id === msg.id)!.props.body);
    assert.ok(saved.length > 0 && saved.length < 5000, "il testo è tagliato");
  });

  it("non tocca i file: un campo foto non si cambia dall'assistente", () => {
    const c = base();
    const img = blockOf(c, "hero");
    const r = validateActions(c, [{ tool: "setBlockProp", blockId: img.id, key: "couplePhoto", value: "https://evil.example/x.jpg" }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /a mano/);
  });

  it("aggiunge un blocco con funzione attiva", () => {
    const c = base();
    const r = validateActions(c, [{ tool: "addBlock", type: "gallery" }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.equal(r.config.blocks.at(-1)!.type, "gallery");
  });

  it("scarta un blocco unico già presente", () => {
    const c = base();
    const r = validateActions(c, [{ tool: "addBlock", type: "hero" }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /già/);
  });

  it("scarta l'aggiunta oltre MAX_BLOCKS", () => {
    const c = base();
    const full = { ...c, blocks: Array.from({ length: MAX_BLOCKS }, (_, i) => ({ id: `b${i}`, type: "message" as const, props: {} })) };
    const r = validateActions(full, [{ tool: "addBlock", type: "gallery" }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /troppi blocchi/);
  });

  it("non rimuove un blocco obbligatorio", () => {
    const c = base();
    const hero = blockOf(c, "hero");
    const r = validateActions(c, [{ tool: "removeBlock", blockId: hero.id }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /obbligatorio/);
  });

  it("rimuove un blocco normale", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const r = validateActions(c, [{ tool: "removeBlock", blockId: msg.id }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.ok(!r.config.blocks.some((b) => b.id === msg.id));
  });

  it("non sposta un blocco ancorato in cima e non fa scendere quello fisso", () => {
    const c = base();
    const cover = blockOf(c, "cover");
    const r = validateActions(c, [{ tool: "moveBlock", blockId: cover.id, to: 3 }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /non si sposta/);
    const other = blockOf(c, "message");
    const r2 = validateActions(c, [{ tool: "moveBlock", blockId: other.id, to: 0 }], ctx());
    assert.equal(r2.actions.length, 0, "spostare in cima spingerebbe giù il blocco fisso");
    assert.match(r2.rejected[0].reason, /fisso/);
  });

  it("sposta un blocco normale in una posizione valida", () => {
    const c = base();
    const from = c.blocks.findIndex((b) => b.type === "message");
    const to = from + 1;
    const r = validateActions(c, [{ tool: "moveBlock", blockId: c.blocks[from].id, to }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.equal(r.config.blocks[to].type, "message");
  });

  it("non cambia il tema a invito pagato", () => {
    const r = validateActions(base(), [{ tool: "setTheme", themeId: "tema-b" }], ctx({ paid: true }));
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /non si cambia/);
  });

  it("cambia il tema a invito in bozza", () => {
    const r = validateActions(base(), [{ tool: "setTheme", themeId: "tema-b" }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.equal(r.config.themeId, "tema-b");
  });

  it("scarta un'azione con un tipo inventato", () => {
    const r = validateActions(base(), [{ tool: "runShell", command: "rm -rf /" }, "testo libero", null], ctx());
    assert.equal(r.actions.length, 0);
    assert.equal(r.rejected.length, 3);
  });

  it("valida in sequenza: l'azione successiva vede l'effetto della precedente", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const r = validateActions(c, [{ tool: "removeBlock", blockId: msg.id }, { tool: "setBlockProp", blockId: msg.id, key: "body", value: "x" }], ctx());
    assert.equal(r.actions.length, 1);
    assert.equal(r.rejected.length, 1, "il blocco rimosso non si modifica più");
  });
});

describe("azioni dell'assistente: effetti come nel builder", () => {
  it("cambiare stile riporta al template i colori personalizzati dei blocchi", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const colored = { ...c, blocks: c.blocks.map((b) => (b.id === msg.id ? { ...b, props: { ...b.props, lookBg: "#112233" } } : b)) };
    const r = validateActions(colored, [{ tool: "setTheme", themeId: "tema-b" }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.equal(r.config.blocks.find((b) => b.id === msg.id)!.props.lookBg, undefined);
  });

  it("togliere l'ultimo blocco di una funzione la toglie anche dalle funzioni dell'invito", () => {
    // base() ha già una sola galleria: è l'unico blocco che usa la funzione.
    const c = { ...base("save-the-date"), addons: ["gallery" as const] };
    const g = blockOf(c, "gallery");
    const r = validateActions(c, [{ tool: "removeBlock", blockId: g.id }], ctx());
    assert.equal(r.rejected.length, 0);
    assert.deepEqual(r.config.addons, []);
  });
});

describe("azioni dell'assistente: domande del modulo e liste", () => {
  const withRsvp = () => ({ ...base(), blocks: [...base().blocks, makeBlock("rsvp")] });
  const questions = JSON.stringify([
    { label: "Quante persone saranno presenti?", type: "number" },
    { label: "Ci sono allergie o intolleranze?", type: "text" },
    { label: "Serve un seggiolone per bambini?", type: "yes-no", yes: "Sì", no: "No" },
  ]);

  it("sostituisce le domande del modulo con quelle del cliente, con identificativi assegnati dal validatore", () => {
    const r = validateActions(withRsvp(), [{ tool: "setRsvpQuestions", questionsJson: questions }], ctx());
    assert.equal(r.rejected.length, 0, JSON.stringify(r.rejected));
    assert.deepEqual(r.config.rsvpQuestions.map((q) => [q.id, q.type]), [["q1", "number"], ["q2", "text"], ["q3", "yes-no"]]);
    assert.equal(r.config.rsvpQuestions[2].yes, "Sì");
  });

  it("scarta le domande se il modulo non c'è nell'invito", () => {
    const r = validateActions(base(), [{ tool: "setRsvpQuestions", questionsJson: questions }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /non è nell'invito/);
  });

  it("scarta un JSON non valido e una domanda senza testo", () => {
    const bad = validateActions(withRsvp(), [{ tool: "setRsvpQuestions", questionsJson: "non è json" }], ctx());
    assert.equal(bad.actions.length, 0);
    const empty = validateActions(withRsvp(), [{ tool: "setRsvpQuestions", questionsJson: "[]" }], ctx());
    assert.equal(empty.actions.length, 0);
  });

  it("sostituisce i colori del dress code con un elenco validato", () => {
    const c = { ...base(), blocks: [...base().blocks, makeBlock("dresscode")] };
    const dress = blockOf(c, "dresscode");
    const colors = JSON.stringify([{ hex: "#A9B29B", name: "Salvia" }, { hex: "#7A1F2B", name: "Borgogna" }]);
    const r = validateActions(c, [{ tool: "setBlockList", blockId: dress.id, key: "colors", itemsJson: colors }], ctx());
    assert.equal(r.rejected.length, 0, JSON.stringify(r.rejected));
    const saved = r.config.blocks.find((b) => b.id === dress.id)!.props.colors as { hex: string; name: string }[];
    assert.deepEqual(saved.map((x) => x.name), ["Salvia", "Borgogna"]);
  });

  it("un elenco che non è una lista di oggetti viene scartato", () => {
    const c = { ...base(), blocks: [...base().blocks, makeBlock("dresscode")] };
    const dress = blockOf(c, "dresscode");
    const r = validateActions(c, [{ tool: "setBlockList", blockId: dress.id, key: "colors", itemsJson: '"salvia"' }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /non valido/);
  });
});

describe("azioni dell'assistente: id dei blocchi nuovi", () => {
  it("un blocco aggiunto prende l'id assegnato dal server, così lo spostamento lo ritrova", () => {
    const c = base();
    const r = validateActions(c, [{ tool: "addBlock", type: "dresscode", blockId: "blk-new-1" }], ctx());
    assert.equal(r.rejected.length, 0, JSON.stringify(r.rejected));
    assert.equal(r.config.blocks.at(-1)!.id, "blk-new-1");
    const m = validateActions(r.config, [{ tool: "moveBlock", blockId: "blk-new-1", to: 2 }], ctx());
    assert.equal(m.rejected.length, 0, JSON.stringify(m.rejected));
    assert.equal(m.config.blocks[2].id, "blk-new-1");
  });

  it("scarta un id di blocco già usato", () => {
    const c = base();
    const existing = c.blocks[2].id;
    const r = validateActions(c, [{ tool: "addBlock", type: "dresscode", blockId: existing }], ctx());
    assert.equal(r.actions.length, 0);
    assert.match(r.rejected[0].reason, /già usato/);
  });
});

describe("azioni dell'assistente: sfondo, tipo di evento, blocchi e immagini", () => {
  const URL_A = "/api/media/11111111-2222-3333-4444-555555555555.jpg";
  const URL_B = "/api/media/66666666-7777-8888-9999-000000000000.jpg";

  it("cambia lo sfondo animato e il tipo di evento", () => {
    const r = validateActions(base(), [{ tool: "setBackground", kind: "petals", color: "#C8A2C8" }, { tool: "setEventType", eventType: "birthday" }], ctx());
    assert.equal(r.rejected.length, 0, JSON.stringify(r.rejected));
    assert.deepEqual(r.config.background, { kind: "petals", color: "#c8a2c8" });
    assert.equal(r.config.eventType, "birthday");
  });

  it("nasconde e mostra un blocco", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const r = validateActions(c, [{ tool: "setBlockHidden", blockId: msg.id, hidden: true }], ctx());
    assert.equal(r.config.blocks.find((b) => b.id === msg.id)!.hidden, true);
  });

  it("imposta i colori del blocco e li toglie con stringa vuota; scarta un colore non esadecimale", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const set = validateActions(c, [{ tool: "setBlockLook", blockId: msg.id, lookBg: "#112233", lookInk: "", lookCover: "" }], ctx());
    assert.equal(set.config.blocks.find((b) => b.id === msg.id)!.props.lookBg, "#112233");
    const bad = validateActions(c, [{ tool: "setBlockLook", blockId: msg.id, lookBg: "rosso", lookInk: "", lookCover: "" }], ctx());
    assert.equal(bad.actions.length, 0);
    const cleared = validateActions(set.config, [{ tool: "setBlockLook", blockId: msg.id, lookBg: "", lookInk: "", lookCover: "" }], ctx());
    assert.equal(cleared.config.blocks.find((b) => b.id === msg.id)!.props.lookBg, undefined);
  });

  it("mette una foto singola solo se il file è tra quelli ammessi", () => {
    const c = base();
    const hero = blockOf(c, "hero");
    const ok = validateActions(c, [{ tool: "setBlockMedia", blockId: hero.id, key: "couplePhoto", url: URL_A }], ctx({ mediaAllowed: new Set([URL_A]) }));
    assert.equal(ok.rejected.length, 0, JSON.stringify(ok.rejected));
    assert.equal(ok.config.blocks.find((b) => b.id === hero.id)!.props.couplePhoto, URL_A);
    const no = validateActions(c, [{ tool: "setBlockMedia", blockId: hero.id, key: "couplePhoto", url: URL_B }], ctx({ mediaAllowed: new Set([URL_A]) }));
    assert.equal(no.actions.length, 0);
    assert.match(no.rejected[0].reason, /non disponibile/);
  });

  it("aggiunge una foto alla galleria in coda, senza duplicati", () => {
    const c = base();
    const gal = blockOf(c, "gallery");
    const r = validateActions(c, [
      { tool: "setBlockMedia", blockId: gal.id, key: "photos", url: URL_A },
      { tool: "setBlockMedia", blockId: gal.id, key: "photos", url: URL_A },
    ], ctx({ mediaAllowed: new Set([URL_A]) }));
    assert.deepEqual(r.config.blocks.find((b) => b.id === gal.id)!.props.photos, [URL_A]);
  });

  it("un campo che non è un file non accetta immagini", () => {
    const c = base();
    const msg = blockOf(c, "message");
    const r = validateActions(c, [{ tool: "setBlockMedia", blockId: msg.id, key: "body", url: URL_A }], ctx({ mediaAllowed: new Set([URL_A]) }));
    assert.equal(r.actions.length, 0);
  });
});

describe("azioni dell'assistente: indirizzo verificato", () => {
  it("salva l'indirizzo solo se è tra i risultati della ricerca", () => {
    const c = base();
    const ok = validateActions(c, [{ tool: "setEvent", key: "address", value: "Via Roma 1, Maglie" }], ctx({ placesAllowed: new Set(["Via Roma 1, Maglie"]) }));
    assert.equal(ok.rejected.length, 0);
    assert.equal(ok.config.event.address, "Via Roma 1, Maglie");
    const no = validateActions(c, [{ tool: "setEvent", key: "address", value: "Via Inventata 9" }], ctx({ placesAllowed: new Set(["Via Roma 1, Maglie"]) }));
    assert.equal(no.actions.length, 0);
    assert.match(no.rejected[0].reason, /non verificato/);
  });
});
