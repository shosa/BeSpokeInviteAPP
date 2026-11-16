"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useLang } from "@/lib/lang";
import { fmtDate } from "./format";
import type { Go } from "./types";

type Row = { id: string; title: string; event_date: string | null; venue: string; created_at: string; invitation_id: string | null; invitation_title: string | null; user_id: string; name: string; email: string; guests: number; tasks: number; tasks_done: number };

// Planner dei clienti: evento, invito collegato, avanzamento delle attività.
export function AdminPlanners({ go }: { go: Go }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/admin/planners${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`).then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <p className="hint">{rows ? `${rows.length} planner` : ""}</p>
        <input className="ac-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca per evento, nome o email", "Search by event, name or email")} aria-label={t("Cerca planner", "Search planners")} />
      </div>
      {rows === null ? <p className="hint">{t("Caricamento…", "Loading…")}</p> : rows.length === 0 ? (
        <div className="ac-card"><p className="hint">{t("Nessun planner.", "No planners.")}</p></div>
      ) : (
        <div className="pl-admin-grid">
          {rows.map((p) => {
            const pct = p.tasks ? Math.round((p.tasks_done / p.tasks) * 100) : 0;
            return (
              <article key={p.id} className="ac-card pl-admin">
                <div className="pl-admin-top"><span className="ac-kicker">{p.event_date ?? t("Data da definire", "Date to be set")}</span>{p.invitation_id && <span className="chip-ok"><Link2 size={12} aria-hidden="true" />{t("Invito collegato", "Invitation linked")}</span>}</div>
                <h3>{p.title || t("Senza titolo", "Untitled")}</h3>
                <button type="button" className="pl-admin-who" onClick={() => go("clienti", { userId: p.user_id })}>{p.name || p.email}</button>
                <small className="hint">{[p.venue, `${p.guests} ${t("invitati", "guests")}`, t(`creato il ${fmtDate(p.created_at)}`, `created ${fmtDate(p.created_at)}`)].filter(Boolean).join(" · ")}</small>
                <div className="pl-admin-bar" role="img" aria-label={t(`${p.tasks_done} attività su ${p.tasks}`, `${p.tasks_done} of ${p.tasks} tasks`)}><i style={{ width: `${pct}%` }} /></div>
                <div className="pl-admin-foot"><small>{t(`${p.tasks_done}/${p.tasks} attività`, `${p.tasks_done}/${p.tasks} tasks`)}</small><a href={`/planner/${p.id}`} target="_blank" rel="noopener">{t("Apri", "Open")} →</a></div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
