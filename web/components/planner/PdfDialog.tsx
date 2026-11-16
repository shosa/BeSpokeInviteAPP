"use client";

import { useState } from "react";
import { FOLDER_GROUPS, FOLDER_GROUPS_EN } from "@inviteme/shared";
import { useLang } from "@/lib/lang";
import { Checkbox } from "@/components/ui/Checkbox";

// Crea PDF: si sceglie cosa includere, il server impagina il documento e il browser lo scarica.
const PARTS: { key: string; label: string; hint: string; en: [string, string] }[] = [
  { key: "riepilogo", label: "Riepilogo", hint: "I numeri principali del matrimonio", en: ["Overview", "The wedding's key numbers"] },
  { key: "budget", label: "Budget", hint: "Spese, scadenze e pagamenti", en: ["Budget", "Costs, due dates and payments"] },
  { key: "invitati", label: "Invitati", hint: "Gruppi, persone e risposte", en: ["Guests", "Groups, people and replies"] },
  { key: "tavoli", label: "Piano dei tavoli", hint: "Disegno dei tavoli con i posti", en: ["Seating plan", "Drawing of the tables with seats"] },
  { key: "attivita", label: "Attività", hint: "Le cose da fare, con le scadenze", en: ["To-do", "Things to do, with due dates"] },
  { key: "fornitori", label: "Fornitori", hint: "Contatti e stato dei contratti", en: ["Vendors", "Contacts and contract status"] },
];
const ALL = [...PARTS.map((p) => p.key), ...FOLDER_GROUPS.map((g) => `cartella:${g}`)];

export function PdfDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const lang = useLang();
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [picked, setPicked] = useState<Set<string>>(new Set(ALL));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/planners/${id}/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ include: [...picked], lang }),
      });
      if (!res.ok) {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(out.error ?? t("Non è stato possibile creare il PDF", "The PDF could not be created"));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = en ? "wedding-folder.pdf" : "cartella-matrimonio.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Errore", "Error"));
      setBusy(false);
    }
  }

  return (
    <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="demo-modal pdf-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-title">
        <header className="demo-modal-head">
          <h2 id="pdf-title">{t("Crea PDF", "Create PDF")}</h2>
          <button type="button" className="demo-close" aria-label={t("Chiudi", "Close")} onClick={onClose} disabled={busy}>×</button>
        </header>
        <p className="hint">{t("Scegliete cosa includere. Il documento ha copertina, indice con i numeri di pagina e una pagina per ogni parte.", "Choose what to include. The document has a cover, a contents page with page numbers and a page for each part.")}</p>

        <div className="pdf-parts">
          <span className="pp-kicker">{t("Organizzazione", "Planning")}</span>
          {PARTS.map((p) => (
            <Checkbox key={p.key} className="pdf-part" checked={picked.has(p.key)} onChange={() => toggle(p.key)} label={<span><strong>{en ? p.en[0] : p.label}</strong><small>{en ? p.en[1] : p.hint}</small></span>} />
          ))}
        </div>

        <div className="pdf-parts">
          <span className="pp-kicker">{t("Cartella", "Folder")}</span>
          {FOLDER_GROUPS.map((g) => (
            <Checkbox key={g} className="pdf-part" checked={picked.has(`cartella:${g}`)} onChange={() => toggle(`cartella:${g}`)} label={<strong>{en ? FOLDER_GROUPS_EN[g] : g}</strong>} />
          ))}
        </div>

        <div className="pdf-actions">
          <button type="button" className="pp-link" onClick={() => setPicked(picked.size === ALL.length ? new Set() : new Set(ALL))}>
            {picked.size === ALL.length ? t("Deseleziona tutto", "Deselect all") : t("Seleziona tutto", "Select all")}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="button" className="btn solid" disabled={busy || picked.size === 0} onClick={download}>{busy ? t("Preparo il PDF…", "Preparing the PDF…") : t("Scarica PDF", "Download PDF")}</button>
        </div>
      </div>
    </div>
  );
}
