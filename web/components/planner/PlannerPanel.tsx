"use client";

import { useState, type ReactNode } from "react";
import type { Catalog, InviteConfig, RsvpQuestion } from "@inviteme/shared";
import { BarChart3, CalendarDays, Check, Clock, Eye, Pencil, Share2, StickyNote, Users } from "lucide-react";
import { CopyLink } from "../CopyLink";
import { RsvpStats, RsvpTable, rsvpCopy } from "./RsvpInsights";
import { ui, type Lang } from "@/lib/ui";

export type PlannerData = {
  manage: { id: string; slug: string; status: "draft" | "paid"; config: InviteConfig; guests: { email: string; sentAt: string }[]; planner: { notes: string; countdownNote: string }; editCount?: number; catalog?: Catalog };
  summary: { total: number; attending: number; declined: number; guests: number; questions: RsvpQuestion[]; rsvps: { id: string; createdAt: string; answers: Record<string, string | number | boolean> }[] };
};

// Giorni che mancano alla data dell'evento (negativo se è passata).
function daysUntil(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const target = new Date(`${iso}T12:00:00`).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  return Math.round((target - today) / 86_400_000);
}

// Sezione con intestazione colorata: stesso linguaggio della dashboard, angoli morbidi.
function Panel({ icon, title, action, children, id, className = "" }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode; id: string; className?: string }) {
  return (
    <section className={`pl-panel ${className}`} aria-labelledby={id}>
      <header className="pl-panel-head">
        <span className="pl-bubble" aria-hidden="true">{icon}</span>
        <h2 id={id}>{title}</h2>
        {action && <div className="pl-panel-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function PlannerPanel({ data, lang = "it" }: { data: PlannerData; lang?: Lang }) {
  const { manage, summary } = data;
  const L = ui(lang).planner;
  const T = lang === "en"
    ? { quick: "Quick actions", share: "Share", view: "Open invitation", edit: "Edit", search: "Search name or answer", all: "All", yes: "Attending", no: "Not attending", noMatch: "No result for this search", progress: "Replies received", of: "of", guestsSearch: "Search guest", whatsapp: "WhatsApp", count: "Countdown", remind: "Reminder" }
    : { quick: "Azioni rapide", share: "Condividi", view: "Apri invito", edit: "Modifica", search: "Cerca nome o risposta", all: "Tutti", yes: "Presenti", no: "Assenti", noMatch: "Nessun risultato per questa ricerca", progress: "Risposte ricevute", of: "su", guestsSearch: "Cerca ospite", whatsapp: "WhatsApp", count: "Conto alla rovescia", remind: "Promemoria" };
  const title = String(manage.config.event.title ?? "Il tuo invito");
  const eventDate = String(manage.config.event.eventDate ?? "");
  const eventTime = String(manage.config.event.eventTime ?? "");
  const days = daysUntil(eventDate);
  const [notes, setNotes] = useState(manage.planner.notes ?? "");
  const [countdownNote, setCountdownNote] = useState(manage.planner.countdownNote ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const R = rsvpCopy(lang);
  const shareHref = `/i/${manage.slug}`;
  const shareText = `${lang === "en" ? "You're invited! All the details here" : "Vi invitiamo! Trovate tutti i dettagli qui"}: ${typeof window === "undefined" ? shareHref : window.location.origin + shareHref}`;
  const yesPct = summary.total > 0 ? Math.round((summary.attending / summary.total) * 100) : 0;

  async function save() {
    setSaved("saving");
    const res = await fetch(`/api/invitations/${manage.id}/planner`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, countdownNote }) });
    setSaved(res.ok ? "ok" : "error");
    setTimeout(() => setSaved("idle"), 2400);
  }

  return (
    <div className="pl">
      {manage.status === "paid" && (
        <div className="pl-edits">
          <strong>{lang === "en" ? "Edits after purchase" : "Modifiche dopo l'acquisto"}</strong>
          <span className={`pl-edits-count${(manage.editCount ?? 0) >= 1 ? " is-used" : ""}`}>
            {(manage.editCount ?? 0) >= 1 ? (lang === "en" ? "1 of 1 used" : "1 di 1 usata") : (lang === "en" ? "0 of 1 available" : "0 di 1 disponibile")}
          </span>
          <small>{lang === "en" ? "You can change texts, photos and colours once. The template is fixed after purchase." : "Puoi modificare testi, foto e colori una sola volta. Il template è fissato dopo l'acquisto."}</small>
        </div>
      )}
      <div className="pl-quick" role="group" aria-label={T.quick}>
        <a className="pl-chip" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Share2 size={16} aria-hidden="true" />{T.whatsapp}</a>
        <CopyLink path={shareHref} lang={lang} />
        <a className="pl-chip" href={shareHref} target="_blank" rel="noreferrer"><Eye size={16} aria-hidden="true" />{T.view}</a>
        <a className="pl-chip" href={`/editor/${manage.id}`}><Pencil size={16} aria-hidden="true" />{T.edit}</a>
      </div>

      <div className="pl-tiles" aria-label={L.kicker}>
        <div className="pl-tile pl-tile-b"><Check size={22} aria-hidden="true" /><span>{L.replied}</span><strong>{summary.total}</strong><small>{L.repliedSub}</small></div>
        <div className="pl-tile pl-tile-c"><CalendarDays size={22} aria-hidden="true" /><span>{L.present}</span><strong>{summary.attending}</strong><small>{L.presentSub(summary.declined)}</small></div>
        <div className="pl-tile pl-tile-d"><Users size={22} aria-hidden="true" /><span>{L.people}</span><strong>{summary.guests}</strong><small>{L.peopleSub}</small></div>
      </div>

      <div className="pl-progress" aria-label={L.present}>
        <div className="pl-progress-top"><span>{L.present}</span><strong>{yesPct}%</strong></div>
        <div className="pl-bar pl-bar-yes" aria-hidden="true"><span style={{ width: `${yesPct}%` }} /></div>
      </div>

      <div className="pl-grid">
        <Panel id="pl-count" className="pl-count" icon={<Clock size={20} aria-hidden="true" />} title={T.count}>
          {days === null ? (
            <p className="hint">{L.countdownNeedDate}</p>
          ) : (
            <p className="pl-big">{days > 0 ? <><strong>{days}</strong> {L.daysLeft}</> : days === 0 ? L.today : L.past}</p>
          )}
          <p className="hint">{eventDate ? `${eventDate}${eventTime ? ` · ${eventTime}` : ""}` : (lang === "en" ? "Date to be set" : "Data da impostare")}</p>
          <label className="pl-field">
            <span>{L.noteLabel}</span>
            <input value={countdownNote} maxLength={200} placeholder={lang === "en" ? "e.g. Shuttle at 3pm from the centre" : "Es. Navetta alle 15:00 dal centro"} onChange={(e) => setCountdownNote(e.target.value)} />
          </label>
        </Panel>

        <Panel id="pl-notes" icon={<StickyNote size={20} aria-hidden="true" />} title={L.notes}>
          <textarea rows={7} value={notes} maxLength={4000} placeholder={lang === "en" ? "Suppliers, deadlines, things to remember…" : "Fornitori, scadenze, cose da ricordare…"} onChange={(e) => setNotes(e.target.value)} aria-label={L.notesAria} />
          <div className="pl-save">
            <button type="button" className="pl-btn" onClick={save} disabled={saved === "saving"}>{saved === "saving" ? L.saving : L.saveNotes}</button>
            <span role="status" className="hint">{saved === "ok" ? L.saved : saved === "error" ? L.notSaved : ""}</span>
          </div>
        </Panel>
      </div>

      <Panel id="pl-stats" icon={<BarChart3 size={20} aria-hidden="true" />} title={R.statsTitle}>
        <RsvpStats summary={summary} lang={lang} />
      </Panel>

      <Panel id="pl-rsvp" icon={<Check size={20} aria-hidden="true" />} title={L.replies}>
        <RsvpTable invitationId={manage.id} summary={summary} lang={lang} />
      </Panel>
    </div>
  );
}
