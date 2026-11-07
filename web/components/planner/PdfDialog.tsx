"use client";

import { useState } from "react";
import { FOLDER_GROUPS } from "@inviteme/shared";
import { Checkbox } from "@/components/ui/Checkbox";

// Crea PDF: si sceglie cosa includere, il server impagina il documento e il browser lo scarica.
const PARTS: { key: string; label: string; hint: string }[] = [
  { key: "riepilogo", label: "Riepilogo", hint: "I numeri principali del matrimonio" },
  { key: "budget", label: "Budget", hint: "Spese, scadenze e pagamenti" },
  { key: "invitati", label: "Invitati", hint: "Gruppi, persone e risposte" },
  { key: "tavoli", label: "Piano dei tavoli", hint: "Disegno dei tavoli con i posti" },
  { key: "attivita", label: "Attività", hint: "Le cose da fare, con le scadenze" },
  { key: "fornitori", label: "Fornitori", hint: "Contatti e stato dei contratti" },
];
const ALL = [...PARTS.map((p) => p.key), ...FOLDER_GROUPS.map((g) => `cartella:${g}`)];

export function PdfDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(ALL));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${id}/planner/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ include: [...picked] }),
      });
      if (!res.ok) {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(out.error ?? "Non è stato possibile creare il PDF");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "cartella-matrimonio.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="demo-modal pdf-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-title">
        <header className="demo-modal-head">
          <h2 id="pdf-title">Crea PDF</h2>
          <button type="button" className="demo-close" aria-label="Chiudi" onClick={onClose} disabled={busy}>×</button>
        </header>
        <p className="hint">Scegliete cosa includere. Il documento ha copertina, indice con i numeri di pagina e una pagina per ogni parte.</p>

        <div className="pdf-parts">
          <span className="pp-kicker">Organizzazione</span>
          {PARTS.map((p) => (
            <Checkbox key={p.key} className="pdf-part" checked={picked.has(p.key)} onChange={() => toggle(p.key)} label={<span><strong>{p.label}</strong><small>{p.hint}</small></span>} />
          ))}
        </div>

        <div className="pdf-parts">
          <span className="pp-kicker">Cartella</span>
          {FOLDER_GROUPS.map((g) => (
            <Checkbox key={g} className="pdf-part" checked={picked.has(`cartella:${g}`)} onChange={() => toggle(`cartella:${g}`)} label={<strong>{g}</strong>} />
          ))}
        </div>

        <div className="pdf-actions">
          <button type="button" className="pp-link" onClick={() => setPicked(picked.size === ALL.length ? new Set() : new Set(ALL))}>
            {picked.size === ALL.length ? "Deseleziona tutto" : "Seleziona tutto"}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn solid" disabled={busy || picked.size === 0} onClick={download}>{busy ? "Preparo il PDF…" : "Scarica PDF"}</button>
        </div>
      </div>
    </div>
  );
}
