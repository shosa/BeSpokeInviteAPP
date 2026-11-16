"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Film, Music, Trash2, Image as ImageIcon } from "lucide-react";
import { useLang } from "@/lib/lang";

// File caricati dai clienti: quali sono in uso, quali sono orfani, eliminazione degli orfani.
type MediaFile = { name: string; kind: "foto" | "video" | "audio"; bytes: number; createdAt: string; invitations: number; music: number; orphan: boolean; ageHours: number };
type Listing = { files: MediaFile[]; totals: { count: number; bytes: number; orphans: number; orphanBytes: number; orphansOlderThanGrace: number } };

const mb = (bytes: number) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const ago = (hours: number, en: boolean) => (hours < 48 ? (en ? `${hours} h ago` : `${hours} h fa`) : en ? `${Math.round(hours / 24)} days ago` : `${Math.round(hours / 24)} giorni fa`);
const KIND_EN: Record<string, string> = { foto: "photo", video: "video", audio: "audio" };

export function AdminMedia() {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [data, setData] = useState<Listing | null>(null);
  const [filter, setFilter] = useState<"tutti" | "uso" | "orfani">("tutti");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/media");
    if (res.ok) setData((await res.json()) as Listing);
    else toast.error(t("Elenco dei file non disponibile", "File list not available"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeOne(name: string) {
    setBusy(name);
    const res = await fetch(`/api/admin/media/${encodeURIComponent(name)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? t("Eliminazione non riuscita", "Delete failed"));
    toast.success(t("File eliminato.", "File deleted."));
    load();
  }

  async function cleanup() {
    setBusy("cleanup");
    const res = await fetch("/api/admin/media/cleanup", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { removed?: number; bytes?: number };
    setBusy(null);
    if (!res.ok) return toast.error(t("Pulizia non riuscita", "Cleanup failed"));
    toast.success(t(`Pulizia fatta: ${body.removed ?? 0} file, ${mb(body.bytes ?? 0)} liberati.`, `Cleanup done: ${body.removed ?? 0} files, ${mb(body.bytes ?? 0)} freed.`));
    load();
  }

  if (!data) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;
  const shown = data.files.filter((f) => filter === "tutti" || (filter === "orfani" ? f.orphan : !f.orphan));

  return (
    <div className="adm-stack">
      <div className="kpis">
        <div className="adm-kpi"><span>{t("File", "Files")}</span><b>{data.totals.count}</b><small>{mb(data.totals.bytes)} {t("in totale", "in total")}</small></div>
        <div className="adm-kpi"><span>{t("In uso", "In use")}</span><b>{data.totals.count - data.totals.orphans}</b><small>{t("da inviti o dalla libreria", "by invitations or the library")}</small></div>
        <div className="adm-kpi is-warn"><span>{t("Orfani", "Orphans")}</span><b>{data.totals.orphans}</b><small>{mb(data.totals.orphanBytes)} {t("non più usati", "no longer used")}</small></div>
      </div>

      <div className="adm-toolbar">
        <div className="adm-seg" role="group" aria-label={t("Filtro file", "File filter")}>
          {([["tutti", "Tutti", "All"], ["uso", "In uso", "In use"], ["orfani", "Orfani", "Orphans"]] as const).map(([v, label, eng]) => (
            <button key={v} type="button" className={filter === v ? "is-on" : ""} aria-pressed={filter === v} onClick={() => setFilter(v)}>{t(label, eng)}</button>
          ))}
        </div>
        <button type="button" className="btn solid small" disabled={busy !== null || data.totals.orphansOlderThanGrace === 0} onClick={cleanup}>
          <Trash2 size={15} aria-hidden="true" /> {t("Pulisci gli orfani", "Clean up orphans")} ({data.totals.orphansOlderThanGrace})
        </button>
      </div>
      <p className="hint">{t("La pulizia elimina solo gli orfani più vecchi di 24 ore: un caricamento appena fatto non viene toccato finché non si salva nell'invito.", "Cleanup only deletes orphans older than 24 hours: a fresh upload is left alone until it's saved in the invitation.")}</p>

      <div className="adm-media-grid">
        {shown.map((f) => (
          <article key={f.name} className={`adm-media${f.orphan ? " is-orphan" : ""}`}>
            <div className="adm-media-thumb">
              {f.kind === "foto" ? <img src={`/api/media/${f.name}`} alt="" loading="lazy" /> : f.kind === "video" ? <Film size={30} aria-hidden="true" /> : <Music size={30} aria-hidden="true" />}
            </div>
            <div className="adm-media-meta">
              <code title={f.name}>{f.name.slice(0, 8)}…</code>
              <span>{f.kind === "foto" && <ImageIcon size={13} aria-hidden="true" />} {en ? KIND_EN[f.kind] ?? f.kind : f.kind} · {mb(f.bytes)} · {ago(f.ageHours, en)}</span>
              <span className={`adm-pill ${f.orphan ? "is-warn" : "is-paid"}`}>
                {f.orphan ? t("Orfano", "Orphan") : en ? `In use · ${f.invitations + f.music} ${f.invitations + f.music === 1 ? "use" : "uses"}` : `In uso · ${f.invitations + f.music} ${f.invitations + f.music === 1 ? "uso" : "usi"}`}
              </span>
            </div>
            {f.orphan && (
              <button type="button" className="btn outline small adm-media-del" disabled={busy !== null} onClick={() => removeOne(f.name)}>
                <Trash2 size={14} aria-hidden="true" /> {busy === f.name ? t("Elimino…", "Deleting…") : t("Elimina", "Delete")}
              </button>
            )}
          </article>
        ))}
        {shown.length === 0 && <p className="adm-empty">{t("Nessun file in questa vista.", "No files in this view.")}</p>}
      </div>
    </div>
  );
}
