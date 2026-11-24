import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CATALOG, defaultConfig, type Catalog, type ThemeManifest } from "@inviteme/shared";
import { handleAssistant, type AssistantDeps, type ModelCall, type OwnedInvitation } from "../src/assistant";

// SEC-05: con una sola richiesta rimasta, richieste parallele non superano il limite.
const theme: ThemeManifest = { engine: 2, id: "tema-a", name: "tema-a", description: "", models: [], themeColor: "#FFFFFF", fonts: [], demo: {} };
const catalog: Catalog = { ...DEFAULT_CATALOG, themes: [{ enabled: true, manifest: theme }], music: [] };
const INV = "99999999-9999-4999-8999-999999999999";
const USER = "11111111-1111-4111-8111-111111111111";

function setup(opts: { fail?: boolean } = {}) {
  const row = { calls: 39 };
  let modelCalls = 0;
  const call: ModelCall = async () => {
    modelCalls++;
    await new Promise((r) => setTimeout(r, 5));
    if (opts.fail) throw Object.assign(new Error("giù"), { status: 500 });
    return { content: [{ type: "text", text: "Fatto." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } } as never;
  };
  const inv = (): OwnedInvitation => ({ id: INV, status: "paid", edit_count: 0, config: defaultConfig(theme, "invitation-rsvp", "wedding", new Set()), assistant_calls: row.calls, assistant_asked: false, assistant_free_run: 0, purchased_addons: null });
  const deps: AssistantDeps = {
    findOwned: async () => {
      await new Promise((r) => setTimeout(r, 1));
      return inv();
    },
    loadCatalog: async () => catalog,
    apiKey: "chiave-finta",
    loadSettings: async () => ({ model: "m", effort: "medium", callLimit: 40 }),
    makeCall: () => call,
    // Come l'UPDATE … WHERE assistant_calls < limite: atomico.
    reserveCall: async (_id, limit) => (row.calls < limit ? (row.calls++, true) : false),
    releaseCall: async () => {
      row.calls = Math.max(0, row.calls - 1);
    },
    recordUsage: async (_id, _m, _u, _a, state) => {
      row.calls += state.reserved ? (state.counted ? 0 : -1) : state.counted ? 1 : 0;
    },
  };
  return { deps, row, modelCalls: () => modelCalls };
}

const body = { messages: [{ role: "user", content: "ciao" }] };

test("SEC-05: 5 richieste parallele con 1 rimasta → 1×200, 4×409, modello chiamato una volta", async () => {
  const { deps, row, modelCalls } = setup();
  const out = await Promise.all(Array.from({ length: 5 }, () => handleAssistant(deps, { id: INV, userId: USER, body })));
  assert.deepEqual(out.map((o) => o.status).sort(), [200, 409, 409, 409, 409]);
  assert.equal(modelCalls(), 1);
  assert.equal(row.calls, 40);
});

test("SEC-05: se il modello non risponde la richiesta prenotata torna disponibile", async () => {
  const { deps, row } = setup({ fail: true });
  const out = await handleAssistant(deps, { id: INV, userId: USER, body });
  assert.equal(out.status, 502);
  assert.equal(row.calls, 39);
});
