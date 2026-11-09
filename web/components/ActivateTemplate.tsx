"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeManifest } from "@inviteme/shared";
import { TemplateCarousel } from "@/components/TemplateCarousel";
import { ThemePreview } from "@/components/ThemePreview";

// Attivazione di un acquisto: il cliente sceglie il template e il suo invito nasce con quello.
export function ActivateTemplate({ orderId, templates }: { orderId: string; templates: ThemeManifest[] }) {
  const router = useRouter();
  const [themeId, setThemeId] = useState(templates[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = templates.find((t) => t.id === themeId);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, themeId }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; invitationId?: string };
    if (!res.ok || !body.invitationId) {
      setBusy(false);
      return setError(body.error ?? "Non è stato possibile creare l'invito. Riprova.");
    }
    router.push(`/editor/${body.invitationId}`);
  }

  return (
    <div className="act">
      {templates.length > 0 ? (
        <TemplateCarousel templates={templates} selectedId={themeId} onSelect={setThemeId} label="Template" lang="it" size="lg" autoplay={false} />
      ) : (
        <p className="hint">Nessun template disponibile al momento.</p>
      )}
      <div className="act-bar">
        <div>
          <span className="act-kicker">Template scelto</span>
          <strong>{selected?.name ?? "—"}</strong>
        </div>
        <div className="act-actions">
          <button type="button" className="btn outline" disabled={!selected} onClick={() => setPreviewOpen(true)}>Anteprima</button>
          <button type="button" className="btn solid" disabled={busy || !themeId} onClick={create}>{busy ? "Creo il tuo invito…" : "Crea il tuo invito"}</button>
        </div>
      </div>
      <p className="hint act-hint-foot">Il template è solo il punto di partenza: testi, foto, colori e musica si cambiano nel builder.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {previewOpen && selected && <ThemePreview themeId={selected.id} themeName={selected.name} onClose={() => setPreviewOpen(false)} onChoose={() => setPreviewOpen(false)} />}
    </div>
  );
}
