import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADDON_KEYS, DEFAULT_CATALOG, sanitizeConfig } from "@inviteme/shared";
import { loadThemes, sampleConfig } from "../src/engine/themes";
import { renderInvitePage } from "../src/engine/page";

// Lo sfondo animato è stato tolto: niente canvas nella pagina, niente sfondo salvato nell'invito,
// anche se un vecchio invito lo aveva o se il theme.json ha ancora la chiave «background».
const runtime = "/* runtime di test */";
const features = new Set(ADDON_KEYS);

describe("sfondo animato rimosso", () => {
  const theme = loadThemes().themes[0];

  it("la pagina non ha il canvas nemmeno con un vecchio sfondo salvato", () => {
    const config = { ...sampleConfig(theme.manifest), background: { kind: "confetti", color: "#b8924a" } };
    const html = renderInvitePage({ theme, config, slug: "x", features, runtime, preview: false });
    assert.doesNotMatch(html, /bg-fx|data-bg=/);
  });

  it("la chiave background del tema viene ignorata", () => {
    const withDefault = { ...theme, manifest: { ...theme.manifest, background: { kind: "waves" as const } } };
    const html = renderInvitePage({ theme: withDefault, config: sampleConfig(theme.manifest), slug: "x", features, runtime, preview: false });
    assert.doesNotMatch(html, /bg-fx|data-bg=/);
  });

  it("salvando l'invito lo sfondo vecchio sparisce", () => {
    const catalog = { ...DEFAULT_CATALOG, themes: [{ enabled: true, manifest: theme.manifest }], music: [] };
    const clean = sanitizeConfig(catalog, { ...sampleConfig(theme.manifest), background: { kind: "snow" } }) as Record<string, unknown> | null;
    assert.ok(clean);
    assert.equal("background" in clean!, false);
  });
});
