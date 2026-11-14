"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, ExternalLink, Eye, Users } from "lucide-react";
import { ShareInvite } from "../planner/ShareInvite";

// Vista dell'editor per un invito già pubblicato: niente assistente, blocchi o proprietà (non si modifica più).
// Solo ciò che serve: il link da condividere, l'invito da aprire, le risposte e il planner.
type Summary = { total: number; attending: number; declined: number; guests: number };

export function PublishedPanel({ id, slug, title, lang, onPreview }: { id: string; slug: string; title: string; lang: "it" | "en"; onPreview?: () => void }) {
  const en = lang === "en";
  const [summary, setSummary] = useState<Summary | null>(null);
  // Il dominio si legge nel browser dopo il montaggio: scritto subito, il server e il browser darebbero testi diversi.
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/invitations/${id}/rsvps`)
      .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
      .then((d) => { if (alive && d) setSummary(d); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="pub">
      <p className="pub-kicker"><span className="pub-dot" aria-hidden="true" />{en ? "Published" : "Pubblicato"}</p>
      <h2 className="pub-title">{en ? "Your invitation is online" : "Il tuo invito è online"}</h2>
      <p className="pub-hint">{en ? "The edit is confirmed: texts and photos no longer change. Share the link with your guests." : "La modifica è confermata: testi e foto non cambiano più. Condividi il link con i tuoi ospiti."}</p>

      <div className="pub-link">
        <span className="pub-url">{host}/i/{slug}</span>
        <ShareInvite path={`/i/${slug}`} title={title} editHref={`/editor/${id}`} lang={lang} />
      </div>

      {onPreview && (
        <button type="button" className="pub-action is-main" onClick={onPreview}>
          <Eye size={18} aria-hidden="true" />{en ? "View the invitation" : "Guarda l'invito"}
        </button>
      )}
      <a className="pub-action" href={`/i/${slug}`} target="_blank" rel="noreferrer">
        <ExternalLink size={18} aria-hidden="true" />{en ? "Open as a guest" : "Apri come un ospite"}
      </a>

      <section className="pub-card" aria-label={en ? "Replies" : "Risposte"}>
        <div className="pub-stats">
          <div><strong>{summary ? summary.total : "–"}</strong><span>{en ? "replies" : "risposte"}</span></div>
          <div><strong>{summary ? summary.attending : "–"}</strong><span>{en ? "attending" : "presenti"}</span></div>
          <div><strong>{summary ? summary.guests : "–"}</strong><span>{en ? "people" : "persone"}</span></div>
        </div>
        <a className="pub-action" href={`/planner/${id}`}>
          <CalendarHeart size={18} aria-hidden="true" />{en ? "Go to the planner" : "Vai al planner"}
        </a>
        <p className="pub-note"><Users size={14} aria-hidden="true" />{en ? "Replies, statistics and export are in the planner." : "Risposte, statistiche ed esportazione sono nel planner."}</p>
      </section>
    </div>
  );
}
