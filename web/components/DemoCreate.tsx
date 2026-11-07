"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type DemoTheme = { id: string; name: string; models: string[] };

// Modalità demo (DEMO_MODE=true senza Shopify): il pulsante apre una finestra per scegliere il template
// e creare un invito di prova, senza pagamento.
export function DemoCreate({ label, themes, models }: { label: string; themes: DemoTheme[]; models: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [themeId, setThemeId] = useState(themes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = themes.find((t) => t.id === themeId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function create() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    // Il modello è il primo compatibile con il template scelto; senza vincoli, il primo del catalogo.
    const model = chosen.models[0] ?? models[0];
    try {
      const res = await fetch("/api/demo/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, themeId: chosen.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { invitationId?: string; error?: string };
      if (!res.ok || !data.invitationId) throw new Error(data.error ?? "Non è stato possibile creare l'invito di prova");
      router.push(`/editor/${data.invitationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setBusy(false);
    }
  }

  if (themes.length === 0) return <p className="hint">Nessun template è attivo al momento.</p>;

  return (
    <>
      <button type="button" className="btn solid" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
            <header className="demo-modal-head">
              <h2 id="demo-title">{label}</h2>
              <button type="button" className="demo-close" aria-label="Chiudi" onClick={() => setOpen(false)} disabled={busy}>×</button>
            </header>
            <p className="hint">Scegli il template: l&apos;invito di prova parte con gli stessi blocchi e le stesse immagini dello stile.</p>
            <label className="demo-field">
              <span>Template</span>
              <select value={themeId} onChange={(e) => setThemeId(e.target.value)} disabled={busy}>
                {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="demo-actions">
              {chosen && <a className="btn outline small" href={`/api/themes/${chosen.id}/anteprima`} target="_blank" rel="noreferrer">Anteprima</a>}
              <button type="button" className="btn solid" disabled={busy || !chosen} onClick={create}>{busy ? "…" : "Crea invito"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
