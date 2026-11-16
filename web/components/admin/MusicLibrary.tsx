"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MusicTrack } from "@inviteme/shared";
import { Switch } from "../ui/Switch";
import { Accordion } from "../ui/Accordion";
import { Checkbox } from "@/components/ui/Checkbox";
import { useT } from "@/lib/lang";

export function MusicLibrary({ tracks, onChange }: { tracks: MusicTrack[]; onChange: () => void }) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rights, setRights] = useState(false);
  const [all, setAll] = useState<(MusicTrack & { created_at?: string })[]>([]);
  const load = () => fetch("/api/admin/music").then((r) => (r.ok ? r.json() : [])).then(setAll).catch(() => setAll([]));
  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rights) return setMsg({ kind: "err", text: tr("Conferma di avere i diritti del brano per caricarlo.", "Confirm that you hold the rights to the track to upload it.") });
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("rights", rights ? "true" : "false");
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/music", { method: "POST", body: data });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? tr("Caricamento non riuscito", "Upload failed") });
    setMsg({ kind: "ok", text: tr("Brano caricato nella libreria.", "Track uploaded to the library.") });
    form.reset();
    setRights(false);
    load();
    onChange();
  }
  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/admin/music/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    load();
    onChange();
  }
  async function remove(id: string) {
    if (!confirm(tr("Eliminare questo brano dalla libreria? Gli inviti che lo usano smetteranno di riprodurlo.", "Delete this track from the library? Invitations using it will stop playing it."))) return;
    await fetch(`/api/admin/music/${id}`, { method: "DELETE" });
    load();
    onChange();
  }

  return (
    <div className="stack-lg">
      <Accordion title={tr("Carica un brano", "Upload a track")} summary={tr("MP3, M4A o OGG, massimo 15 MB", "MP3, M4A or OGG, up to 15 MB")}>
      <form className="stack-lg" onSubmit={upload}>
        <p className="hint">{tr("MP3, M4A o OGG, massimo 15 MB. Carica solo brani di cui hai i diritti o che sono licenziati per questo uso.", "MP3, M4A or OGG, up to 15 MB. Only upload tracks you hold the rights to or that are licensed for this use.")}</p>
        <div className="form-grid">
          <Field label={tr("File audio", "Audio file")}><input type="file" name="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg" required /></Field>
          <Field label={tr("Titolo", "Title")}><input name="title" maxLength={120} required /></Field>
          <Field label={tr("Artista", "Artist")}><input name="artist" maxLength={120} /></Field>
          <Field label={tr("Licenza o fonte", "Licence or source")} wide><input name="license" maxLength={300} placeholder={tr("Es. licenza Epidemic Sound, acquisto del 12/03/2026", "E.g. Epidemic Sound licence, purchased 12/03/2026")} /></Field>
        </div>
        <Checkbox checked={rights} onChange={setRights} label={tr("Confermo di avere i diritti di questo brano per l'uso in un invito digitale.", "I confirm I hold the rights to this track for use in a digital invitation.")} />
        <div className="actions">
          <button type="submit" className="btn solid" disabled={busy}>{busy ? tr("Caricamento…", "Uploading…") : tr("Carica nella libreria", "Upload to the library")}</button>
        </div>
        {msg && <p className={msg.kind === "ok" ? "form-notice" : "form-error"} role="status">{msg.text}</p>}
      </form>
      </Accordion>

      <div className="card table-wrap">
        <h2>{tr("Libreria", "Library")}</h2>
        {all.length === 0 ? (
          <p className="hint">{tr("Nessun brano. Carica il primo sopra.", "No tracks yet. Upload the first one above.")}</p>
        ) : (
          <div className="admin-scroll"><table className="admin-table">
            <thead><tr><th>{tr("Brano", "Track")}</th><th>{tr("Ascolta", "Listen")}</th><th>{tr("Licenza", "Licence")}</th><th>{tr("Visibile", "Visible")}</th><th /></tr></thead>
            <tbody>
              {all.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.title}</b><small className="block-hint">{t.artist}</small></td>
                  <td><audio controls preload="none" src={t.url} /></td>
                  <td className="small">{t.license || "–"}</td>
                  <td><Switch checked={t.enabled} onChange={(v) => toggle(t.id, v)} label={`${tr("Visibile", "Visible")}: ${t.title}`} /></td>
                  <td><button type="button" className="link danger" onClick={() => remove(t.id)}>{tr("Elimina", "Delete")}</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
