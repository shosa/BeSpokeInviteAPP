"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MusicTrack } from "@inviteme/shared";
import { Switch } from "../ui/Switch";
import { Accordion } from "../ui/Accordion";
import { Checkbox } from "@/components/ui/Checkbox";

export function MusicLibrary({ tracks, onChange }: { tracks: MusicTrack[]; onChange: () => void }) {
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
    if (!rights) return setMsg({ kind: "err", text: "Conferma di avere i diritti del brano per caricarlo." });
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("rights", rights ? "true" : "false");
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/music", { method: "POST", body: data });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: out.error ?? "Caricamento non riuscito" });
    setMsg({ kind: "ok", text: "Brano caricato nella libreria." });
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
    if (!confirm("Eliminare questo brano dalla libreria? Gli inviti che lo usano smetteranno di riprodurlo.")) return;
    await fetch(`/api/admin/music/${id}`, { method: "DELETE" });
    load();
    onChange();
  }

  return (
    <div className="stack-lg">
      <Accordion title="Carica un brano" summary="MP3, M4A o OGG, massimo 15 MB">
      <form className="stack-lg" onSubmit={upload}>
        <p className="hint">MP3, M4A o OGG, massimo 15 MB. Carica solo brani di cui hai i diritti o che sono licenziati per questo uso.</p>
        <div className="form-grid">
          <Field label="File audio"><input type="file" name="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg" required /></Field>
          <Field label="Titolo"><input name="title" maxLength={120} required /></Field>
          <Field label="Artista"><input name="artist" maxLength={120} /></Field>
          <Field label="Licenza o fonte" wide><input name="license" maxLength={300} placeholder="Es. licenza Epidemic Sound, acquisto del 12/03/2026" /></Field>
        </div>
        <Checkbox checked={rights} onChange={setRights} label="Confermo di avere i diritti di questo brano per l'uso in un invito digitale." />
        <div className="actions">
          <button type="submit" className="btn solid" disabled={busy}>{busy ? "Caricamento…" : "Carica nella libreria"}</button>
        </div>
        {msg && <p className={msg.kind === "ok" ? "form-notice" : "form-error"} role="status">{msg.text}</p>}
      </form>
      </Accordion>

      <div className="card table-wrap">
        <h2>Libreria</h2>
        {all.length === 0 ? (
          <p className="hint">Nessun brano. Carica il primo sopra.</p>
        ) : (
          <div className="admin-scroll"><table className="admin-table">
            <thead><tr><th>Brano</th><th>Ascolta</th><th>Licenza</th><th>Visibile</th><th /></tr></thead>
            <tbody>
              {all.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.title}</b><small className="block-hint">{t.artist}</small></td>
                  <td><audio controls preload="none" src={t.url} /></td>
                  <td className="small">{t.license || "–"}</td>
                  <td><Switch checked={t.enabled} onChange={(v) => toggle(t.id, v)} label={`Visibile: ${t.title}`} /></td>
                  <td><button type="button" className="link danger" onClick={() => remove(t.id)}>Elimina</button></td>
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
