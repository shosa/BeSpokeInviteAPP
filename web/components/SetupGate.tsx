"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type SetupInfo = { title: string; eventDate: string; venue: string };

// Dati primari dell'invito: nomi o titolo, data e luogo. Si chiedono una volta, la prima volta che si apre
// il builder o il planner, e finché non sono salvati non si può proseguire. Niente chiusura: non si scappa.
export function SetupGate({ id, initial, setupDone, children }: { id: string; initial: SetupInfo; setupDone: boolean; children: ReactNode }) {
  const router = useRouter();
  const [done, setDone] = useState(setupDone);
  const [title, setTitle] = useState(initial.title);
  const [eventDate, setEventDate] = useState(initial.eventDate);
  const [venue, setVenue] = useState(initial.venue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${id}/setup`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, eventDate, venue }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Non è stato possibile salvare");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <>
      {children}
      {!done && (
        <div className="demo-backdrop setup-backdrop">
          <form className="demo-modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title" onSubmit={save}>
            <header className="demo-modal-head">
              <h2 id="setup-title">I dati del vostro invito</h2>
            </header>
            <p className="hint">Prima di cominciare: i nomi degli sposi o il titolo dell&apos;evento, la data e il luogo. Serviranno al builder, al planner e alla pagina per gli ospiti.</p>
            <label className="demo-field">
              <span>Nomi o titolo</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sara & Luca" required maxLength={120} disabled={busy} />
            </label>
            <label className="demo-field">
              <span>Data dell&apos;evento</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required disabled={busy} />
            </label>
            <label className="demo-field">
              <span>Luogo</span>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Villa Aurelia, Roma" maxLength={160} disabled={busy} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="demo-actions">
              <button type="submit" className="btn solid" disabled={busy}>{busy ? "…" : "Salva e continua"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
