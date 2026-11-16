"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { useT } from "@/lib/lang";

// Testata del planner: il cliente sceglie una foto per lo sfondo (banner) e una per l'arco, o torna a quelle del tema.
type Slot = "banner" | "arch";

export function HeroImages({ id, banner, arch }: { id: string; banner: string | null; arch: string | null }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = { banner: useRef<HTMLInputElement>(null), arch: useRef<HTMLInputElement>(null) };
  const box = useRef<HTMLDivElement>(null);

  // Si chiude con Esc o con un clic fuori.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  async function upload(slot: Slot, file: File) {
    setBusy(slot);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/planners/${id}/image/${slot}`, { method: "POST", body });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setError(out.error ?? t("Caricamento non riuscito", "Upload failed"));
    router.refresh();
  }

  async function reset(slot: Slot) {
    setBusy(slot);
    setError(null);
    const res = await fetch(`/api/planners/${id}/image/${slot}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError(t("Operazione non riuscita", "Something went wrong"));
    router.refresh();
  }

  const rows: { slot: Slot; label: string; hint: string; current: string | null }[] = [
    { slot: "banner", label: t("Sfondo della testata", "Header background"), hint: t("Una foto larga, orizzontale", "A wide, landscape photo"), current: banner },
    { slot: "arch", label: t("Foto nell'arco", "Photo in the arch"), hint: t("Meglio verticale, con i soggetti al centro", "Portrait works best, subject in the centre"), current: arch },
  ];

  return (
    <div className="hi" ref={box}>
      <button type="button" className="hi-toggle" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <ImagePlus size={16} aria-hidden="true" />
        <span>{t("Personalizza testata", "Customise header")}</span>
      </button>
      {open && (
        <div className="hi-panel" role="dialog" aria-label={t("Immagini della testata", "Header images")}>
          <div className="hi-head"><strong>{t("Immagini della testata", "Header images")}</strong><button type="button" className="hi-close" aria-label={t("Chiudi", "Close")} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button></div>
          {rows.map((r) => (
            <div key={r.slot} className="hi-row">
              <span className={`hi-thumb${r.slot === "arch" ? " is-arch" : ""}`}>{r.current ? <img src={r.current} alt="" /> : <ImagePlus size={18} aria-hidden="true" />}</span>
              <span className="hi-text"><b>{r.label}</b><small>{r.current ? t("Foto tua", "Your photo") : r.hint}</small></span>
              <span className="hi-acts">
                <button type="button" className="btn solid small" disabled={busy !== null} onClick={() => inputs[r.slot].current?.click()}>
                  {busy === r.slot ? <Loader2 size={14} className="as-spin" aria-hidden="true" /> : null}
                  {r.current ? t("Cambia", "Change") : t("Carica", "Upload")}
                </button>
                {r.current && <button type="button" className="hi-reset" disabled={busy !== null} onClick={() => reset(r.slot)} aria-label={t("Torna all'immagine del tema", "Back to the theme image")} title={t("Torna all'immagine del tema", "Back to the theme image")}><RotateCcw size={15} aria-hidden="true" /></button>}
              </span>
              <input ref={inputs[r.slot]} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(r.slot, f); }} />
            </div>
          ))}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
