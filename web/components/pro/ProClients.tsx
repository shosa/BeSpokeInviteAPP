"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_LABEL, fmtDate } from "./format";
import { initials, type ProClientRow } from "./types";

// Clienti dello studio: filtro (tutti, in corso, conclusi), ricerca e una riga per cliente con invito, planner,
// risposte e accesso della coppia. Una riga apre la scheda del cliente.
export function ProClients({ clients, lang, title, limit }: { clients: ProClientRow[]; lang: "it" | "en"; title?: string; limit?: number }) {
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const done = (c: ProClientRow) => c.archived || (!!c.eventDate && c.eventDate < today);
  const [view, setView] = useState<"all" | "open" | "done">("all");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients
      .filter((c) => (view === "open" ? !done(c) : view === "done" ? done(c) : true))
      .filter((c) => !s || [c.name, c.email, c.venue].some((x) => x.toLowerCase().includes(s)))
      .slice(0, limit ?? Infinity);
  }, [clients, view, q, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = clients.filter((c) => !done(c)).length;

  const inv = (c: ProClientRow) =>
    c.invitation ? (c.invitation.published ? <span className="pro-chip is-ok">{t("Online", "Online")}</span> : <span className="pro-chip is-draft">{t("Bozza", "Draft")}</span>)
      : c.pendingOrder ? <span className="pro-chip is-todo">{t("Scegli template", "Pick a template")}</span>
      : <span className="pro-chip is-none">—</span>;

  return (
    <section className="pro-card pro-table-card" aria-labelledby="pro-clients-t">
      <div className="pro-table-top">
        <h2 id="pro-clients-t">{title ?? t("Clienti", "Clients")}</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
          <label className="pro-search" style={{ minHeight: 42 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca un cliente…", "Search a client…")} aria-label={t("Cerca", "Search")} />
          </label>
          <div className="pro-seg" role="tablist" aria-label={t("Filtra clienti", "Filter clients")}>
            {([["all", t("Tutti", "All"), clients.length], ["open", t("In corso", "Ongoing"), open], ["done", t("Conclusi", "Past"), clients.length - open]] as const).map(([v, label, n]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>{label} {n}</button>
            ))}
          </div>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="pro-empty">
          <p style={{ margin: 0 }}>{clients.length ? t("Nessun cliente con questo filtro.", "No clients match this filter.") : t("Ancora nessun cliente: crea il primo evento.", "No clients yet: create your first event.")}</p>
          {!clients.length && <a className="pro-btn is-brass is-sm" href="/pro/nuovo">{t("Nuovo evento", "New event")}</a>}
        </div>
      ) : (
        <table className="pro-table">
          <thead>
            <tr>
              <th scope="col">{t("Cliente", "Client")}</th>
              <th scope="col">{t("Evento", "Event")}</th>
              <th scope="col">{t("Invito", "Invitation")}</th>
              <th scope="col">Planner</th>
              <th scope="col">{t("Risposte", "Replies")}</th>
              <th scope="col">{t("Accesso coppia", "Couple access")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="is-link" onClick={() => router.push(`/pro/clienti/${c.id}`)}>
                <td>
                  <a className="pro-who" href={`/pro/clienti/${c.id}`} onClick={(e) => e.stopPropagation()}>
                    <span className="pro-avatar" aria-hidden="true">{initials(c.name)}</span>
                    <span><strong>{c.name}</strong><small>{c.email || c.phone || "—"}</small></span>
                  </a>
                </td>
                <td data-k={t("Evento", "Event")}><span className="pro-cell"><span>{EVENT_LABEL[c.eventType]?.[lang] ?? c.eventType}</span><small>{c.eventDate ? fmtDate(c.eventDate, en) : t("Data da fissare", "Date to set")}</small></span></td>
                <td data-k={t("Invito", "Invitation")}>{inv(c)}</td>
                <td data-k="Planner">{c.plannerId ? <span className="pro-chip is-ok">{t("Attivo", "Active")}</span> : <span className="pro-chip is-none">—</span>}</td>
                <td data-k={t("Risposte", "Replies")} style={{ whiteSpace: "nowrap" }}>{c.invitation ? (c.guests ? `${c.invitation.rsvps} / ${c.guests}` : String(c.invitation.rsvps)) : "—"}</td>
                <td data-k={t("Accesso", "Access")} style={{ whiteSpace: "nowrap", color: "var(--pro-soft)" }}>{c.access ? t("Link inviato", "Link sent") : t("Solo studio", "Studio only")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
