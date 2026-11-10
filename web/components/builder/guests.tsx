"use client";

import { useEffect, useState } from "react";
import type { RsvpQuestion } from "@inviteme/shared";
import { ui, type Lang } from "@/lib/ui";
import { Send } from "lucide-react";

export type RsvpSummary = {
  total: number;
  attending: number;
  declined: number;
  guests: number;
  questions: RsvpQuestion[];
  rsvps: { id: string; createdAt: string; answers: Record<string, string | number | boolean> }[];
};

// Pannello Ospiti del builder: le risposte alla conferma di presenza. L'invito si condivide con il suo link.
export function GuestsPanel({ invitationId, paid, hasRsvp, lang = "it" }: { invitationId: string; paid: boolean; hasRsvp: boolean; lang?: Lang }) {
  const L = ui(lang).builder;
  const [summary, setSummary] = useState<RsvpSummary | null>(null);

  useEffect(() => {
    if (!hasRsvp || !paid) return;
    let alive = true;
    const load = () =>
      fetch(`/api/invitations/${invitationId}/rsvps`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: RsvpSummary | null) => alive && d && setSummary(d))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [hasRsvp, paid, invitationId]);

  if (!paid) return (
    <div className="guests-empty" role="status">
      <span className="guests-empty-ico" aria-hidden="true"><Send size={22} /></span>
      <p>{L.guestsNone}</p>
    </div>
  );

  return (
    <div className="stack">
      {hasRsvp && (
        <section className="block">
          <h3>{L.guestsRsvp}</h3>
          {!summary ? (
            <p className="hint">{L.guestsLoading}</p>
          ) : (
            <>
              <div className="sum">
                <div><span>{L.guestsTotal}</span><strong>{summary.total}</strong></div>
                <div><span>{L.guestsPresent}</span><strong>{summary.attending}</strong></div>
                <div><span>{L.guestsPeople}</span><strong>{summary.guests}</strong></div>
              </div>
              <a className="btn outline small" href={`/api/invitations/${invitationId}/rsvps?format=csv`}>{L.guestsCsv}</a>
              {summary.rsvps.length === 0 ? (
                <p className="hint">{L.guestsNoReplies}</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{L.guestsReceived}</th>{summary.questions.map((q) => <th key={q.id}>{q.label}</th>)}</tr></thead>
                    <tbody>
                      {summary.rsvps.map((r) => (
                        <tr key={r.id}>
                          <td>{new Date(r.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td>
                          {summary.questions.map((q) => {
                            const a = r.answers[q.id];
                            return <td key={q.id}>{q.type === "yes-no" ? (a === true ? L.guestsYes : a === false ? "No" : "–") : String(a ?? "–")}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

