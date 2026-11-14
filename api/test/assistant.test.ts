import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATALOG, defaultConfig, makeBlock, type Catalog, type InviteConfig, type ThemeManifest } from "@inviteme/shared";
import { handleAssistant, type AssistantDeps, type ChatMessage, type ModelCall, type OwnedInvitation } from "../src/assistant";
import type { AssistantSettings } from "../src/assistantSettings";

const SETTINGS: AssistantSettings = { model: "claude-opus-5-5", effort: "medium", callLimit: 40 };

// Nessun test tocca la rete: il modello è una funzione finta che restituisce risposte preparate.
const theme = (id: string): ThemeManifest => ({ engine: 2, id, name: id, description: "", models: [], themeColor: "#FFFFFF", fonts: [], demo: {} });
const catalog: Catalog = { ...DEFAULT_CATALOG, themes: [{ enabled: true, manifest: theme("tema-a") }, { enabled: true, manifest: theme("tema-b") }], music: [] };
const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const INV_ID = "33333333-3333-3333-3333-333333333333";

function config(): InviteConfig {
  const c = defaultConfig(theme("tema-a"), "invitation-rsvp", "wedding", new Set(DEFAULT_CATALOG.models[0].included));
  return { ...c, blocks: [...c.blocks, makeBlock("message")] };
}

function invitation(over: Partial<OwnedInvitation> = {}): OwnedInvitation {
  return { id: INV_ID, status: "draft", edit_count: 0, config: config(), assistant_calls: 0, purchased_addons: null, ...over };
}

type Scripted = { content: unknown[]; stop_reason: string };
const usage = (i: number, o: number, read = 0, write = 0) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: read, cache_creation_input_tokens: write });

// Risposta finta con la forma che serve al modulo: testo, strumenti, motivo di stop e conteggi.
function fakeModel(script: Scripted[]) {
  const calls: Array<Record<string, any>> = [];
  let i = 0;
  const call: ModelCall = async (params) => {
    calls.push(JSON.parse(JSON.stringify(params)));
    const step = script[Math.min(i++, script.length - 1)];
    return { ...step, usage: usage(100, 20, i > 1 ? 50 : 0, i === 1 ? 80 : 0) } as any;
  };
  return { call, calls };
}

function deps(over: Partial<AssistantDeps> & { model?: ReturnType<typeof fakeModel> } = {}) {
  const recorded: Array<{ id: string; actions: number }> = [];
  const model = over.model ?? fakeModel([{ content: [{ type: "text", text: "Fatto." }], stop_reason: "end_turn" }]);
  const d: AssistantDeps = {
    findOwned: async (id, userId) => (userId === OWNER && id === INV_ID ? invitation() : null),
    loadCatalog: async () => catalog,
    apiKey: "test-key-non-reale",
    loadSettings: async () => SETTINGS,
    makeCall: () => model.call,
    recordUsage: async (id, _m, _u, actions) => {
      recorded.push({ id, actions });
    },
    ...over,
  };
  return { d, recorded, model };
}

const chat = { messages: [{ role: "user", content: "metti il dress code elegante" }] };

describe("assistente: risposte del modello", () => {
  it("risponde 404 a un invito di un altro utente, senza chiamare il modello", async () => {
    const { d, model } = deps();
    const out = await handleAssistant(d, { id: INV_ID, userId: OTHER, body: chat });
    assert.equal(out.status, 404);
    assert.equal(model.calls.length, 0);
  });

  it("risponde 503 senza chiave del modello", async () => {
    const { d, model } = deps({ apiKey: undefined });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 503);
    assert.equal(model.calls.length, 0);
  });

  it("risponde 409 oltre il tetto di richieste, senza chiamare il modello", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "x" }], stop_reason: "end_turn" }]);
    const { d } = deps({ model, findOwned: async () => invitation({ assistant_calls: SETTINGS.callLimit }) });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 409);
    assert.equal(model.calls.length, 0);
  });

  it("risponde 400 se l'ultimo messaggio non è del cliente o è vuoto", async () => {
    const { d } = deps();
    assert.equal((await handleAssistant(d, { id: INV_ID, userId: OWNER, body: { messages: [{ role: "assistant", content: "ciao" }] } })).status, 400);
    assert.equal((await handleAssistant(d, { id: INV_ID, userId: OWNER, body: { messages: [{ role: "user", content: "  " }] } })).status, 400);
    assert.equal((await handleAssistant(d, { id: INV_ID, userId: OWNER, body: null })).status, 400);
  });

  it("applica le azioni valide del modello e scarta quelle inventate", async () => {
    const model = fakeModel([
      {
        content: [
          { type: "tool_use", id: "t1", name: "setEvent", input: { key: "title", value: "Marco & Anna" } },
          { type: "tool_use", id: "t2", name: "runShell", input: { command: "rm -rf /" } },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "Ho messo l'indirizzo." }], stop_reason: "end_turn" },
    ]);
    const { d, recorded } = deps({ model });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 200);
    const body = out.body as { reply: string; actions: unknown[]; usage: { input: number } };
    assert.equal(body.reply, "Ho messo l'indirizzo.");
    assert.deepEqual(body.actions, [{ tool: "setEvent", key: "title", value: "Marco & Anna" }]);
    // Il secondo strumento torna al modello come errore, con il motivo.
    const sent = model.calls[1].messages.at(-1).content as Array<{ is_error: boolean; content: string }>;
    assert.equal(sent[1].is_error, true);
    assert.match(sent[1].content, /sconosciuta/);
    assert.equal(recorded[0].actions, 1);
    assert.equal(body.usage.input, 200, "i conteggi dei due giri si sommano");
  });

  it("a invito pagato il cambio di stile viene rifiutato, anche se il modello lo propone", async () => {
    const model = fakeModel([
      { content: [{ type: "tool_use", id: "t1", name: "setTheme", input: { themeId: "tema-b" } }], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "Il template non si cambia dopo l'acquisto." }], stop_reason: "end_turn" },
    ]);
    const { d } = deps({ model, findOwned: async () => invitation({ status: "paid", edit_count: 0 }) });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { actions: unknown[] };
    assert.equal(body.actions.length, 0);
    const sent = model.calls[1].messages.at(-1).content as Array<{ is_error: boolean }>;
    assert.equal(sent[0].is_error, true);
  });

  it("a invito confermato l'assistente risponde ma non propone modifiche", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "Posso solo rispondere." }], stop_reason: "end_turn" }]);
    const { d } = deps({ model, findOwned: async () => invitation({ status: "paid", edit_count: 1 }) });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 200);
    assert.equal(model.calls[0].tools, undefined, "nessuno strumento in sola lettura");
    assert.deepEqual((out.body as { actions: unknown[] }).actions, []);
  });

  it("un rifiuto del modello non applica nulla e mostra un messaggio gentile", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "..." }], stop_reason: "refusal" }]);
    const { d } = deps({ model });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { reply: string; actions: unknown[] };
    assert.equal(body.actions.length, 0);
    assert.match(body.reply, /riformularla/);
  });

  it("un errore del servizio dà 502 senza dettagli e non conta la richiesta", async () => {
    const failing: ModelCall = async () => {
      throw new Error("connessione rifiutata verso api.anthropic.com con chiave test-key-non-reale");
    };
    const { d, recorded } = deps({ makeCall: () => failing });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 502);
    assert.ok(!JSON.stringify(out.body).includes("test-key"), "la chiave non esce nella risposta");
    assert.equal(recorded.length, 0);
  });

  it("manda al modello la configurazione nell'ultimo messaggio, non nel prompt di sistema, e mai dati di ospiti", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }]);
    const inv = invitation({ config: { ...config(), event: { ...config().event, title: "Sara e Luca" } } });
    const { d } = deps({ model, findOwned: async () => ({ ...inv, guests: [{ email: "ospite@example.com" }] } as any) });
    await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const sent = model.calls[0];
    const system = sent.system as Array<{ text: string; cache_control?: { type: string } }>;
    assert.equal(system.at(-1)!.cache_control?.type, "ephemeral", "il prompt di sistema è in cache");
    assert.ok(!system.some((b) => b.text.includes("Sara e Luca")), "la configurazione non sta nel prompt di sistema");
    const last = sent.messages.at(-1).content as Array<{ text: string }>;
    assert.match(last[0].text, /Sara e Luca/);
    assert.ok(!JSON.stringify(sent).includes("ospite@example.com"), "nessun dato di ospiti va al modello");
    assert.equal(sent.output_config.effort, "medium");
    assert.equal(sent.max_tokens, 8000);
    assert.ok(!("thinking" in sent) && !("temperature" in sent), "niente parametri rifiutati dal modello");
  });

  it("gli strumenti sono in schema stretto, senza campi in più", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }]);
    const { d } = deps({ model });
    await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const tools = model.calls[0].tools as Array<{ name: string; strict: boolean; input_schema: { additionalProperties: boolean; required: string[]; properties: object } }>;
    assert.equal(tools.length, 19);
    for (const t of tools) {
      assert.equal(t.strict, true, t.name);
      assert.equal(t.input_schema.additionalProperties, false, t.name);
      assert.deepEqual(t.input_schema.required.sort(), Object.keys(t.input_schema.properties).sort(), t.name);
    }
  });

  it("aggiunge un blocco, legge il suo id dal risultato e lo sposta nel giro successivo", async () => {
    const seen: any[] = [];
    const call: ModelCall = async (params) => {
      seen.push(JSON.parse(JSON.stringify(params)));
      if (seen.length === 1) return { content: [{ type: "tool_use", id: "t1", name: "addBlock", input: { type: "dresscode" } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      // Il modello legge l'id dal risultato del giro precedente, come farebbe con il testo ricevuto.
      const result = (seen[1].messages.at(-1).content as Array<{ content: string }>)[0].content;
      const id = /id del blocco: (\S+)/.exec(result)?.[1] ?? "";
      if (seen.length === 2) return { content: [{ type: "tool_use", id: "t2", name: "moveBlock", input: { blockId: id, to: 2 } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      return { content: [{ type: "text", text: "Ho aggiunto la data da grattare sotto l'intestazione." }], stop_reason: "end_turn", usage: usage(10, 5) } as any;
    };
    const { d } = deps({ makeCall: () => call });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { actions: Array<{ tool: string; blockId?: string; to?: number }>; reply: string };
    assert.equal(body.actions.length, 2, JSON.stringify(body.actions));
    assert.equal(body.actions[0].tool, "addBlock");
    assert.equal(body.actions[1].tool, "moveBlock");
    assert.equal(body.actions[1].blockId, body.actions[0].blockId);
    const second = (seen[1].messages.at(-1).content as Array<{ content: string; is_error: boolean }>)[0];
    assert.match(second.content, /id del blocco: /);
    assert.equal(second.is_error, false);
  });

  it("cerca una foto, la importa e la mette nel campo del blocco", async () => {
    const shared = invitation();
    const hero = shared.config.blocks.find((b) => b.type === "hero")!;
    const imported: number[] = [];
    const URL = "/api/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
    const seen: any[] = [];
    const call: ModelCall = async (params) => {
      seen.push(JSON.parse(JSON.stringify(params)));
      if (seen.length === 1) return { content: [{ type: "tool_use", id: "s1", name: "searchPhotos", input: { query: "sea sunset" } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      if (seen.length === 2) return { content: [{ type: "tool_use", id: "u1", name: "usePhoto", input: { stockId: 42, blockId: hero.id, key: "couplePhoto" } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      return { content: [{ type: "text", text: "Ho messo la foto." }], stop_reason: "end_turn", usage: usage(10, 5) } as any;
    };
    const { d } = deps({
      makeCall: () => call,
      findOwned: async () => shared,
      stock: {
        search: async () => [{ id: 42, tags: "sea, sunset" }],
        import: async (id) => { imported.push(id); return { url: URL }; },
      },
    });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { actions: any[]; mediaAllowed: string[] };
    assert.deepEqual(imported, [42]);
    assert.equal(body.actions.length, 1, JSON.stringify(body.actions));
    assert.deepEqual(body.actions[0], { tool: "setBlockMedia", blockId: hero.id, key: "couplePhoto", url: URL });
    assert.ok(body.mediaAllowed.includes(URL));
    const found = (seen[1].messages.at(-1).content as Array<{ content: string }>)[0].content;
    assert.match(found, /id 42/);
  });

  it("propone le foto con le anteprime, così la persona le vede", async () => {
    const shared = invitation();
    const PREVIEW = "https://cdn.pixabay.com/photo/2026/01/01/mare_150.jpg";
    let n = 0;
    const call: ModelCall = async () => {
      n += 1;
      if (n === 1) return { content: [{ type: "tool_use", id: "s1", name: "searchPhotos", input: { query: "mare" } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      if (n === 2) return { content: [{ type: "tool_use", id: "a1", name: "askPhoto", input: { question: "Quale ti piace?", captions: ["Mare al tramonto", "Spiaggia"] } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      return { content: [{ type: "text", text: "Scegli tu." }], stop_reason: "end_turn", usage: usage(10, 5) } as any;
    };
    const { d } = deps({
      makeCall: () => call,
      findOwned: async () => shared,
      stock: {
        search: async () => [{ id: 1, tags: "mare", preview: PREVIEW }, { id: 2, tags: "spiaggia", preview: "javascript:alert(1)" }],
        import: async () => ({ url: "/api/media/x.jpg" }),
      },
    });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { choice?: { options: string[]; photos?: string[] }; photosOffered: { id: number; preview?: string }[] };
    assert.deepEqual(body.choice?.options, ["Mare al tramonto", "Spiaggia"]);
    // Solo le anteprime di Pixabay passano: l'indirizzo non valido diventa vuoto.
    assert.deepEqual(body.choice?.photos, [PREVIEW, ""]);
    assert.equal(body.photosOffered.find((p) => p.id === 1)?.preview, PREVIEW);
    assert.equal(body.photosOffered.find((p) => p.id === 2)?.preview, undefined);
  });

  it("non importa una foto che non è nell'ultima ricerca", async () => {
    const shared = invitation();
    const hero = shared.config.blocks.find((b) => b.type === "hero")!;
    const imported: number[] = [];
    const call: ModelCall = async (params) => {
      const n = (params.messages as unknown[]).length;
      if (n === 1) return { content: [{ type: "tool_use", id: "u1", name: "usePhoto", input: { stockId: 999, blockId: hero.id, key: "couplePhoto" } }], stop_reason: "tool_use", usage: usage(10, 5) } as any;
      return { content: [{ type: "text", text: "Non trovo quella foto." }], stop_reason: "end_turn", usage: usage(10, 5) } as any;
    };
    const { d } = deps({
      makeCall: () => call,
      findOwned: async () => shared,
      stock: { search: async () => [], import: async (id) => { imported.push(id); return { url: "/api/media/x.jpg" }; } },
    });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.deepEqual(imported, []);
    assert.equal((out.body as { actions: unknown[] }).actions.length, 0);
  });
});

describe("assistente: cronologia lunga", () => {
  it("con più di dodici messaggi la conversazione inviata al modello comincia sempre dal cliente", async () => {
    const shared = invitation();
    const history: ChatMessage[] = [];
    for (let i = 0; i < 14; i++) history.push({ role: i % 2 === 0 ? "user" : "assistant", content: `messaggio ${i}` });
    history.push({ role: "user", content: "ultima domanda" });
    const model = fakeModel([{ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }]);
    const { d } = deps({ model, findOwned: async () => shared });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: { messages: history.map((m) => ({ role: m.role, content: m.content })) } });
    assert.equal(out.status, 200);
    assert.equal(model.calls[0].messages[0].role, "user");
  });
});

describe("assistente: risposte a una domanda non contano", () => {
  it("dopo una domanda la risposta è gratuita anche a limite raggiunto, e non consuma richieste", async () => {
    const shared = { ...invitation(), assistant_calls: SETTINGS.callLimit, assistant_asked: true, assistant_free_run: 0 };
    const model = fakeModel([{ content: [{ type: "text", text: "Ok, scelta registrata." }], stop_reason: "end_turn" }]);
    const { d, recorded } = deps({ model, findOwned: async () => shared });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 200);
    assert.equal((out.body as { counted: boolean }).counted, false);
    assert.equal(recorded.length, 1);
  });

  it("dopo cinque risposte gratuite di fila torna a contare, e a limite raggiunto si ferma", async () => {
    const shared = { ...invitation(), assistant_calls: SETTINGS.callLimit, assistant_asked: true, assistant_free_run: 5 };
    const model = fakeModel([{ content: [{ type: "text", text: "x" }], stop_reason: "end_turn" }]);
    const { d } = deps({ model, findOwned: async () => shared });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    assert.equal(out.status, 409);
    assert.equal(model.calls.length, 0);
  });
});

describe("assistente: campo di ricerca luoghi", () => {
  it("con askPlace chiude il giro, non applica modifiche e manda il campo al cliente", async () => {
    const model = fakeModel([{ content: [{ type: "tool_use", id: "p1", name: "askPlace", input: { question: "Dove si svolge la festa?" } }], stop_reason: "tool_use" }]);
    const { d } = deps({ model });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: chat });
    const body = out.body as { placeAsk?: { question: string }; actions: unknown[] };
    assert.equal(body.placeAsk?.question, "Dove si svolge la festa?");
    assert.equal(body.actions.length, 0);
    assert.equal(model.calls.length, 1);
  });
});

describe("assistente: risposte vuote nella cronologia", () => {
  it("una risposta dell'assistente senza testo (solo scelta) non fa fallire la richiesta", async () => {
    const model = fakeModel([{ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }]);
    const { d } = deps({ model });
    const out = await handleAssistant(d, { id: INV_ID, userId: OWNER, body: { messages: [
      { role: "user", content: "una foto del mare" },
      { role: "assistant", content: "" },
      { role: "user", content: "la seconda" },
    ] } });
    assert.equal(out.status, 200);
  });
});
