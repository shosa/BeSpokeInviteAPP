"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, CheckSquare, Film, Globe, Mail, Music, PencilLine, Square, Trash2 } from "lucide-react";
import { useLang } from "@/lib/lang";
import { CopyId } from "./CopyId";
import type { Go } from "./types";

// File caricati dai clienti: dove è usato ognuno (invito online o in bozza, planner, libreria), quali sono orfani,
// eliminazione di uno, di quelli scelti o di tutti gli orfani. Il server ricontrolla l'uso prima di eliminare.
type Use =
  | { kind: "invito"; id: string; title: string; slug: string; draft: boolean; live: boolean }
  | { kind: "planner"; id: string; title: string }
  | { kind: "musica"; id: string; title: string };
type MediaFile = { name: string; kind: "foto" | "video" | "audio"; bytes: number; createdAt: string; uses: Use[]; useCount: number; orphan: boolean; deletable: boolean; ageHours: number };
type Listing = { files: MediaFile[]; totals: { count: number; bytes: number; live: number; orphans: number; orphanBytes: number; orphansOlderThanGrace: number; deletableBytes: number } };
type Filter = "tutti" | "uso" | "eliminabili" | "recenti";

const mb = (bytes: number) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);
const ago = (hours: number, en: boolean) => (hours < 48 ? (en ? `${hours} h ago` : `${hours} h fa`) : en ? `${Math.round(hours / 24)} days ago` : `${Math.round(hours / 24)} giorni fa`);
const KIND_EN: Record<string, string> = { foto: "photo", video: "video", audio: "audio" };

export function AdminMedia({ go }: { go?: Go }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [data, setData] = useState<Listing | null>(null);
  const [filter, setFilter] = useState<Filter>("tutti");
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/media");
    if (res.ok) {
      const next = (await res.json()) as Listing;
      setData(next);
      // La selezione tiene solo i file ancora eliminabili.
      const ok = new Set(next.files.filter((f) => f.deletable).map((f) => f.name));
      setPicked((p) => new Set([...p].filter((n) => ok.has(n))));
    } else toast.error(en ? "File list not available" : "Elenco dei file non disponibile");
  }, [en]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (data?.files ?? []).filter((f) => filter === "tutti" || (filter === "uso" ? !f.orphan : filter === "eliminabili" ? f.deletable : f.orphan && !f.deletable)),
    [data, filter],
  );
  const pickedBytes = useMemo(() => (data?.files ?? []).filter((f) => picked.has(f.name)).reduce((s, f) => s + f.bytes, 0), [data, picked]);
  const shownDeletable = shown.filter((f) => f.deletable);
  const allShownPicked = shownDeletable.length > 0 && shownDeletable.every((f) => picked.has(f.name));

  function toggle(name: string) {
    setConfirming(false);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }
  function toggleAllShown() {
    setConfirming(false);
    setPicked((p) => {
      const n = new Set(p);
      if (allShownPicked) shownDeletable.forEach((f) => n.delete(f.name));
      else shownDeletable.forEach((f) => n.add(f.name));
      return n;
    });
  }

  async function removeOne(name: string) {
    setBusy(name);
    const res = await fetch(`/api/admin/media/${encodeURIComponent(name)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? t("Eliminazione non riuscita", "Delete failed"));
    toast.success(t("File eliminato.", "File deleted."));
    load();
  }

  async function removePicked() {
    if (!confirming) return setConfirming(true);
    setBusy("bulk");
    setConfirming(false);
    const res = await fetch("/api/admin/media/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: [...picked] }) });
    const body = (await res.json().catch(() => ({}))) as { removed?: number; skipped?: number; bytes?: number; error?: string };
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? t("Eliminazione non riuscita", "Delete failed"));
    const skipped = body.skipped ? t(` ${body.skipped} saltati perché ora in uso o recenti.`, ` ${body.skipped} skipped because now in use or recent.`) : "";
    toast.success(t(`Eliminati ${body.removed ?? 0} file, ${mb(body.bytes ?? 0)} liberati.`, `Deleted ${body.removed ?? 0} files, ${mb(body.bytes ?? 0)} freed.`) + skipped);
    setPicked(new Set());
    load();
  }

  if (!data) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;
  const recent = data.totals.orphans - data.totals.orphansOlderThanGrace;

  return (
    <div className="adm-stack">
      <div className="kpis">
        <div className="adm-kpi"><span>{t("File", "Files")}</span><b>{data.totals.count}</b><small>{mb(data.totals.bytes)} {t("in totale", "in total")}</small></div>
        <div className="adm-kpi"><span>{t("In uso", "In use")}</span><b>{data.totals.count - data.totals.orphans}</b><small>{data.totals.live} {t("su inviti online", "on live invitations")}</small></div>
        <div className="adm-kpi is-warn"><span>{t("Eliminabili", "Deletable")}</span><b>{data.totals.orphansOlderThanGrace}</b><small>{mb(data.totals.deletableBytes)} {t("da liberare", "to free")}</small></div>
        <div className="adm-kpi"><span>{t("Recenti", "Recent")}</span><b>{recent}</b><small>{t("orfani di meno di 24 h", "orphans under 24 h")}</small></div>
      </div>

      <div className="adm-media-help">
        <p><b>{t("In uso", "In use")}</b> — {t("lo usa un invito (online o in bozza), un planner o la libreria musicale. Non si può eliminare.", "used by an invitation (live or draft), a planner or the music library. It can't be deleted.")}</p>
        <p><b>{t("Eliminabile", "Deletable")}</b> — {t("nessuno lo usa più da oltre 24 ore: di solito una foto sostituita, un caricamento abbandonato o una foto della ricerca non usata. Si può eliminare senza conseguenze.", "nobody has used it for over 24 hours: usually a replaced photo, an abandoned upload or an unused search photo. Safe to delete.")}</p>
        <p><b>{t("Recente", "Recent")}</b> — {t("orfano da meno di 24 ore: può essere un caricamento in corso, si lascia stare.", "orphan for less than 24 hours: it may be an upload in progress, leave it.")}</p>
      </div>

      <div className="adm-toolbar">
        <div className="adm-seg" role="group" aria-label={t("Filtro file", "File filter")}>
          {([["tutti", "Tutti", "All", data.totals.count], ["uso", "In uso", "In use", data.totals.count - data.totals.orphans], ["eliminabili", "Eliminabili", "Deletable", data.totals.orphansOlderThanGrace], ["recenti", "Recenti", "Recent", recent]] as const).map(([v, label, eng, n]) => (
            <button key={v} type="button" className={filter === v ? "is-on" : ""} aria-pressed={filter === v} onClick={() => { setFilter(v); setConfirming(false); }}>{t(label, eng)} · {n}</button>
          ))}
        </div>
        {shownDeletable.length > 0 && (
          <button type="button" className="btn outline small adm-media-pickall" disabled={busy !== null} onClick={toggleAllShown}>
            {allShownPicked ? <CheckSquare size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
            {allShownPicked ? t("Deseleziona", "Deselect") : t(`Seleziona gli eliminabili (${shownDeletable.length})`, `Select deletable (${shownDeletable.length})`)}
          </button>
        )}
      </div>

      {picked.size > 0 && (
        <div className="adm-media-bulk" role="region" aria-label={t("File selezionati", "Selected files")}>
          <span>{t(`${picked.size} selezionati · ${mb(pickedBytes)}`, `${picked.size} selected · ${mb(pickedBytes)}`)}</span>
          <div>
            <button type="button" className="btn ghost small" disabled={busy !== null} onClick={() => { setPicked(new Set()); setConfirming(false); }}>{t("Annulla", "Cancel")}</button>
            <button type="button" className={`btn small ${confirming ? "danger" : "solid"}`} disabled={busy !== null} onClick={removePicked}>
              <Trash2 size={15} aria-hidden="true" /> {busy === "bulk" ? t("Elimino…", "Deleting…") : confirming ? t(`Confermi? Elimina ${picked.size} file`, `Confirm: delete ${picked.size} files`) : t("Elimina selezionati", "Delete selected")}
            </button>
          </div>
        </div>
      )}

      <div className="adm-media-grid">
        {shown.map((f) => {
          const state = !f.orphan ? "uso" : f.deletable ? "eliminabile" : "recente";
          const on = picked.has(f.name);
          return (
            <article key={f.name} className={`adm-media is-${state}${on ? " is-picked" : ""}`}>
              <div className="adm-media-thumb">
                {f.deletable && (
                  <label className="adm-media-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={on} onChange={() => toggle(f.name)} aria-label={t(`Seleziona ${f.name}`, `Select ${f.name}`)} />
                  </label>
                )}
                <a href={`/api/media/${f.name}`} target="_blank" rel="noreferrer" aria-label={t("Apri il file", "Open the file")}>
                  {f.kind === "foto" ? <img src={`/api/media/${f.name}`} alt="" loading="lazy" /> : f.kind === "video" ? <Film size={30} aria-hidden="true" /> : <Music size={30} aria-hidden="true" />}
                </a>
              </div>
              <div className="adm-media-meta">
                <CopyId value={f.name} keep={8} />
                <span>{en ? KIND_EN[f.kind] ?? f.kind : f.kind} · {mb(f.bytes)} · {ago(f.ageHours, en)}</span>
                <span className={`adm-pill ${state === "uso" ? "is-paid" : state === "eliminabile" ? "is-warn" : ""}`}>
                  {state === "uso" ? t("In uso", "In use") : state === "eliminabile" ? t("Eliminabile", "Deletable") : t("Recente · attendi 24 h", "Recent · wait 24 h")}
                </span>
                {f.uses.length > 0 && (
                  <ul className="adm-media-uses">
                    {f.uses.map((u) => (
                      <li key={`${u.kind}-${u.id}`}>
                        {u.kind === "invito" ? (
                          <button type="button" className="link" onClick={() => go?.("inviti", { invitationId: u.id })} title={`/i/${u.slug}`}>
                            <Mail size={12} aria-hidden="true" /> {u.title}
                            {u.live && <em className="is-live"><Globe size={11} aria-hidden="true" /> {t("online", "live")}</em>}
                            {u.draft && !u.live && <em><PencilLine size={11} aria-hidden="true" /> {t("bozza", "draft")}</em>}
                          </button>
                        ) : u.kind === "planner" ? (
                          <a className="link" href={`/admin/planner/${u.id}`}><BookOpen size={12} aria-hidden="true" /> {u.title}</a>
                        ) : (
                          <span><Music size={12} aria-hidden="true" /> {t("Libreria", "Library")}: {u.title}</span>
                        )}
                      </li>
                    ))}
                    {f.useCount > f.uses.length && <li className="hint">+{f.useCount - f.uses.length}</li>}
                  </ul>
                )}
              </div>
              {f.orphan && (
                <button type="button" className="btn outline small adm-media-del" disabled={busy !== null} onClick={() => removeOne(f.name)}>
                  <Trash2 size={14} aria-hidden="true" /> {busy === f.name ? t("Elimino…", "Deleting…") : t("Elimina", "Delete")}
                </button>
              )}
            </article>
          );
        })}
        {shown.length === 0 && <p className="adm-empty">{t("Nessun file in questa vista.", "No files in this view.")}</p>}
      </div>
    </div>
  );
}
