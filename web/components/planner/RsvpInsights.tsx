"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { RsvpQuestion } from "@inviteme/shared";
import { FileDown, Search } from "lucide-react";
import type { Lang } from "@/lib/ui";

// Pezzi condivisi dal planner base e dal planner premium:
// statistiche per domanda della conferma di presenza e tabella delle risposte.

export type RsvpAnswer = string | number | boolean;
export type RsvpSummary = {
  total: number;
  attending: number;
  declined: number;
  guests: number;
  questions: RsvpQuestion[];
  rsvps: { id: string; createdAt: string; answers: Record<string, RsvpAnswer> }[];
};

const COPY = {
  it: {
    statsTitle: "Statistiche delle risposte",
    statsEmpty: "Le statistiche compaiono quando arriva la prima risposta.",
    noQuestions: "L'invito non ha domande di conferma.",
    answered: (n: number, t: number) => `${n} ${n === 1 ? "risposta" : "risposte"} su ${t}`,
    yes: "Sì",
    no: "No",
    totalSum: "Totale",
    avg: "Media",
    range: "Da",
    to: "a",
    showAll: (n: number) => `Mostra tutte (${n})`,
    showLess: "Mostra meno",
    noText: "Nessuna risposta scritta.",
    tableTitle: "Tutte le risposte",
    csv: "Esporta CSV",
    all: "Tutti",
    present: "Presenti",
    absent: "Assenti",
    search: "Cerca nome o risposta",
    noMatch: "Nessun risultato per questa ricerca",
    noReplies: "Nessuna risposta ancora.",
    received: "Ricevuta",
    locale: "it-IT",
  },
  en: {
    statsTitle: "Reply statistics",
    statsEmpty: "Statistics appear when the first reply arrives.",
    noQuestions: "The invitation has no RSVP questions.",
    answered: (n: number, t: number) => `${n} of ${t} ${t === 1 ? "reply" : "replies"}`,
    yes: "Yes",
    no: "No",
    totalSum: "Total",
    avg: "Average",
    range: "From",
    to: "to",
    showAll: (n: number) => `Show all (${n})`,
    showLess: "Show less",
    noText: "No written answers.",
    tableTitle: "All replies",
    csv: "Export CSV",
    all: "All",
    present: "Attending",
    absent: "Not attending",
    search: "Search name or answer",
    noMatch: "No result for this search",
    noReplies: "No replies yet.",
    received: "Received",
    locale: "en-GB",
  },
};

const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

// ───────────── Statistiche per domanda ─────────────

function Bars({ items, total }: { items: { label: string; count: number; tone?: "yes" | "no" }[]; total: number }) {
  return (
    <ul className="rs-bars">
      {items.map((it) => (
        <li key={it.label}>
          <div className="rs-bar-top"><span>{it.label}</span><strong>{it.count} <small>· {pct(it.count, total)}%</small></strong></div>
          <div className={`rs-bar${it.tone ? ` is-${it.tone}` : ""}`} role="progressbar" aria-label={it.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct(it.count, total)}>
            <span style={{ width: `${pct(it.count, total)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TextAnswers({ answers, lang }: { answers: string[]; lang: Lang }) {
  const T = COPY[lang];
  const [open, setOpen] = useState(false);
  if (answers.length === 0) return <p className="hint">{T.noText}</p>;
  const shown = open ? answers : answers.slice(0, 4);
  return (
    <>
      <ul className="rs-texts">{shown.map((a, i) => <li key={i}>{a}</li>)}</ul>
      {answers.length > 4 && <button type="button" className="link rs-more" onClick={() => setOpen(!open)}>{open ? T.showLess : T.showAll(answers.length)}</button>}
    </>
  );
}

function QuestionStat({ q, rsvps, lang }: { q: RsvpQuestion; rsvps: RsvpSummary["rsvps"]; lang: Lang }) {
  const T = COPY[lang];
  const values = rsvps.map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== null && v !== "");
  const n = values.length;
  let body: ReactNode;
  if (q.type === "yes-no") {
    const yes = values.filter((v) => v === true).length;
    const no = values.filter((v) => v === false).length;
    body = <Bars total={n} items={[{ label: q.yes || T.yes, count: yes, tone: "yes" }, { label: q.no || T.no, count: no, tone: "no" }]} />;
  } else if (q.type === "choice") {
    const opts = q.options ?? [];
    const extra = [...new Set(values.map(String).filter((v) => !opts.includes(v)))];
    const items = [...opts, ...extra].map((o) => ({ label: o, count: values.filter((v) => String(v) === o).length }));
    body = <Bars total={n} items={items} />;
  } else if (q.type === "number") {
    const nums = values.map(Number).filter((v) => Number.isFinite(v));
    const sum = nums.reduce((s, v) => s + v, 0);
    const avg = nums.length ? sum / nums.length : 0;
    const fmt = (v: number) => v.toLocaleString(T.locale, { maximumFractionDigits: 1 });
    body = (
      <div className="rs-nums">
        <div><span>{T.totalSum}</span><strong>{fmt(sum)}</strong></div>
        <div><span>{T.avg}</span><strong>{fmt(avg)}</strong></div>
        {nums.length > 0 && <div><span>{T.range}</span><strong>{fmt(Math.min(...nums))} {T.to} {fmt(Math.max(...nums))}</strong></div>}
      </div>
    );
  } else {
    body = <TextAnswers answers={values.map(String)} lang={lang} />;
  }
  return (
    <article className="rs-q">
      <header>
        <h3>{q.label}</h3>
        <small>{T.answered(n, rsvps.length)}</small>
      </header>
      {body}
    </article>
  );
}

export function RsvpStats({ summary, lang = "it" }: { summary: RsvpSummary; lang?: Lang }) {
  const T = COPY[lang];
  if (summary.questions.length === 0) return <p className="hint">{T.noQuestions}</p>;
  if (summary.rsvps.length === 0) return <p className="hint">{T.statsEmpty}</p>;
  return <div className="rs-grid">{summary.questions.map((q) => <QuestionStat key={q.id} q={q} rsvps={summary.rsvps} lang={lang} />)}</div>;
}

// ───────────── Tabella delle risposte, con filtri e ricerca ─────────────

export function RsvpTable({ invitationId, summary, lang = "it" }: { invitationId: string; summary: RsvpSummary; lang?: Lang }) {
  const T = COPY[lang];
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [query, setQuery] = useState("");
  const questions = summary.questions;
  // La prima domanda sì/no dice chi viene: serve per i filtri Presenti / Assenti.
  const attendingQ = questions.find((q) => q.type === "yes-no");
  const rows = useMemo(() => summary.rsvps.filter((r) => {
    const att = attendingQ ? r.answers[attendingQ.id] : undefined;
    if (filter === "yes" && att !== true) return false;
    if (filter === "no" && att !== false) return false;
    const q = query.trim().toLowerCase();
    return !q || Object.values(r.answers).some((a) => String(a).toLowerCase().includes(q));
  }), [summary.rsvps, filter, query, attendingQ]);

  return (
    <div className="rs-table">
      <div className="pl-tools">
        <div className="pl-seg" role="group" aria-label={T.all}>
          {(["all", "yes", "no"] as const).map((f) => (
            <button key={f} type="button" className={filter === f ? "is-on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)} disabled={f !== "all" && !attendingQ}>
              {f === "all" ? T.all : f === "yes" ? T.present : T.absent}
            </button>
          ))}
        </div>
        <div className="rs-tools-right">
          <label className="pl-search"><Search size={16} aria-hidden="true" /><input type="search" value={query} placeholder={T.search} aria-label={T.search} onChange={(e) => setQuery(e.target.value)} /></label>
          <a className="pl-chip" href={`/api/invitations/${invitationId}/rsvps?format=csv`}><FileDown size={16} aria-hidden="true" />{T.csv}</a>
        </div>
      </div>
      {summary.rsvps.length === 0 ? (
        <p className="hint">{T.noReplies}</p>
      ) : rows.length === 0 ? (
        <p className="hint">{T.noMatch}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">{T.received}</th>{questions.map((q) => <th scope="col" key={q.id}>{q.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString(T.locale, { dateStyle: "short", timeStyle: "short" })}</td>
                  {questions.map((q) => {
                    const a = r.answers[q.id];
                    if (q.type === "yes-no") return <td key={q.id}><span className={`pl-answer ${a === true ? "is-yes" : a === false ? "is-no" : ""}`}>{a === true ? (q.yes || T.yes) : a === false ? (q.no || T.no) : "–"}</span></td>;
                    return <td key={q.id}>{String(a ?? "–")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const rsvpCopy = (lang: Lang) => COPY[lang];
