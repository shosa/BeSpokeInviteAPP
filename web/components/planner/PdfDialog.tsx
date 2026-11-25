"use client";

import { useEffect, useState } from "react";
import { FOLDER_GROUPS, FOLDER_GROUPS_EN, plannerPdfName } from "@inviteme/shared";
import { useLang } from "@/lib/lang";
import { Checkbox } from "@/components/ui/Checkbox";

// Crea PDF: si sceglie cosa includere, il server impagina il documento e il browser lo scarica.
const PARTS: { key: string; label: string; hint: string; en: [string, string] }[] = [
  { key: "riepilogo", label: "Riepilogo", hint: "I numeri principali dell'evento", en: ["Overview", "The event's key numbers"] },
  { key: "budget", label: "Budget", hint: "Spese, scadenze e pagamenti", en: ["Budget", "Costs, due dates and payments"] },
  { key: "invitati", label: "Invitati", hint: "Gruppi, persone e risposte", en: ["Guests", "Groups, people and replies"] },
  { key: "tavoli", label: "Piano dei tavoli", hint: "Disegno dei tavoli con i posti", en: ["Seating plan", "Drawing of the tables with seats"] },
  { key: "attivita", label: "Attività", hint: "Le cose da fare, con le scadenze", en: ["To-do", "Things to do, with due dates"] },
  { key: "fornitori", label: "Fornitori", hint: "Contatti e stato dei contratti", en: ["Vendors", "Contacts and contract status"] },
];
const ALL = [...PARTS.map((p) => p.key), ...FOLDER_GROUPS.map((g) => `cartella:${g}`)];

// demoData: nella demo il planner non è salvato, quindi il PDF si crea dai dati che la pagina ha in memoria.
export function PdfDialog({ id, onClose, title = "", eventType, demoData }: { id: string; onClose: () => void; title?: string; eventType?: string; demoData?: unknown }) {
  const lang = useLang();
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [picked, setPicked] = useState<Set<string>>(new Set(ALL));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  async function download() {
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch(demoData ? "/api/demo/planner-pdf" : `/api/planners/${id}/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(demoData ? { include: [...picked], lang, data: demoData } : { include: [...picked], lang }),
      });
      if (!res.ok) {
        const out = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(out.error ?? t("Non è stato possibile creare il PDF", "The PDF could not be created"));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = plannerPdfName(eventType, title, en ? "en" : "it");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      // La barra arriva in fondo e resta un attimo su «Pronto», poi si torna alla scelta.
      setDone(true);
      setTimeout(() => { setBusy(false); setDone(false); }, 1600);
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
        {busy ? <PdfProgress done={done} parts={picked.size} en={en} /> : <>
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
          <button type="button" className="btn solid" disabled={busy || picked.size === 0} onClick={download}>{t("Scarica PDF", "Download PDF")}</button>
        </div>
        </>}
      </div>
    </div>
  );
}

// Attesa durante la creazione: documento con le pagine che si impilano, passi, barra e tempo trascorso.
// La barra avanza a tempo fino al 92% (il server non manda avanzamenti) e arriva a 100% quando il file è pronto.
function PdfProgress({ done, parts, en }: { done: boolean; parts: number; en: boolean }) {
  const t = (it: string, eng: string) => (en ? eng : it);
  const steps = [
    t("Preparo copertina e indice", "Preparing the cover and contents"),
    t("Impagino riepilogo, budget e invitati", "Laying out overview, budget and guests"),
    t("Disegno i tavoli e la cartella", "Drawing the tables and the folder"),
    t("Numero le pagine e chiudo il file", "Numbering pages and finishing the file"),
  ];
  const [pct, setPct] = useState(3);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (done) { setPct(100); return; }
    const bar = setInterval(() => setPct((p) => (p < 92 ? p + Math.max(0.5, (92 - p) * 0.05) : p)), 200);
    const clock = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { clearInterval(bar); clearInterval(clock); };
  }, [done]);
  const step = done ? steps.length - 1 : Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length));
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="pdfp" role="status" aria-live="polite">
      <div className={`pdfp-doc${done ? " is-done" : ""}`} aria-hidden="true">
        <span className="pdfp-page p3" /><span className="pdfp-page p2" />
        <span className="pdfp-page p1"><i /><i /><i /><i /></span>
        <span className="pdfp-check">✓</span>
      </div>
      <h3 className="pdfp-title">{done ? t("PDF pronto: scaricamento avviato", "PDF ready: download started") : t("Sto creando il tuo PDF", "Creating your PDF")}</h3>
      <p className="pdfp-step">{done ? t("Lo trovi nei download del browser.", "You'll find it in your browser downloads.") : `${steps[step]}…`}</p>
      <div className="pdfp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t("Avanzamento", "Progress")}><span style={{ width: `${pct}%` }} /></div>
      <div className="pdfp-meta"><span>{Math.round(pct)}%</span><span>{t(`${parts} parti`, `${parts} parts`)} · <span className="tn">{time}</span></span></div>
    </div>
  );
}
