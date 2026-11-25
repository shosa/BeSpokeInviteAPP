import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOWCASE_TOKEN } from "@inviteme/shared";
import { getLang } from "@/lib/i18n";
import { showcasePlanner } from "@/lib/showcasePlanner";
import "../vetrina.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const q = await searchParams;
  const en = (q.lang === "en" || q.lang === "it" ? q.lang : await getLang()) === "en";
  return {
    title: en ? "Showcase · Bespoke Invite" : "Vetrina · Bespoke Invite",
    description: en ? "Three real-life invitations and a wedding planner, made with Bespoke Invite." : "Tre inviti e un planner, fatti con Bespoke Invite.",
    robots: { index: false, follow: false, nocache: true },
  };
}

type Card = { key: string; theme: string; kind: [string, string]; title: string; when: [string, string]; where: [string, string]; text: [string, string]; notes: [string, string][] };

const CARDS: Card[] = [
  {
    key: "melograno",
    theme: "Melograno di Sicilia",
    kind: ["Matrimonio", "Wedding"],
    title: "Chiara & Salvo",
    when: ["Sabato 18 settembre 2027", "Saturday 18 September 2027"],
    where: ["Tenuta Busulmone, Noto", "Tenuta Busulmone, Noto"],
    text: [
      "Si sono conosciuti in fila per una granita e tornano in Sicilia per sposarsi. Rito in giardino, cena nel cortile, navette da Noto e brunch al mare la domenica.",
      "They met queuing for granita and are going back to Sicily to get married. Ceremony in the garden, dinner in the courtyard, shuttles from Noto and a beach brunch on Sunday.",
    ],
    notes: [["Risposta con navetta e brunch", "RSVP with shuttle and brunch"], ["Planner collegato", "Linked planner"], ["Domande frequenti", "FAQ"]],
  },
  {
    key: "smeraldo",
    theme: "Stemma Smeraldo",
    kind: ["Nozze d'oro", "Golden anniversary"],
    title: "Giovanna & Piero",
    when: ["Sabato 22 maggio 2027", "Saturday 22 May 2027"],
    where: ["San Miniato al Monte e Bellosguardo, Firenze", "San Miniato al Monte and Bellosguardo, Florence"],
    text: [
      "Cinquant'anni di matrimonio, organizzati in segreto dai tre figli: messa dove tutto è iniziato, pranzo sulla collina e una sorpresa alle quattro.",
      "Fifty years of marriage, secretly organised by their three children: Mass where it all began, lunch on the hill and a surprise at four.",
    ],
    notes: [["Galleria e filmino di famiglia", "Family photos and home movie"], ["Messaggi da leggere alla festa", "Messages to read at the party"], ["Busta di velluto", "Velvet envelope"]],
  },
  {
    key: "pizzo",
    theme: "Velo di Pizzo",
    kind: ["Matrimonio", "Wedding"],
    title: "Elisa & James",
    when: ["Sabato 5 giugno 2027", "Saturday 5 June 2027"],
    where: ["Villa delle Rose Bianche, Cernobbio", "Villa delle Rose Bianche, Cernobbio"],
    text: [
      "Lei di Como, lui di Londra: un matrimonio in due lingue sul lago, con il battello per arrivare, la cena alla lunga tavola e si balla nella limonaia.",
      "She's from Como, he's from London: a bilingual wedding on the lake, with a boat to get there, dinner at the long table and dancing in the lemon house.",
    ],
    notes: [["Invito in italiano e inglese", "Italian and English versions"], ["Battello e piano pioggia", "Boat times and rain plan"], ["Canzone richiesta nella risposta", "Song request in the RSVP"]],
  },
];

const euro = (cents: number, en: boolean) => new Intl.NumberFormat(en ? "en-GB" : "it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

// Vetrina privata: tre inviti completi e un planner. Raggiungibile solo dal link (/vetrina/<token>), non indicizzata.
export default async function Showcase({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  if (token !== SHOWCASE_TOKEN) notFound();
  const q = await searchParams;
  const lang = q.lang === "en" || q.lang === "it" ? q.lang : await getLang();
  const en = lang === "en";
  const t = (pair: [string, string]) => (en ? pair[1] : pair[0]);
  const base = `/vetrina/${token}`;
  const qs = en ? "?lang=en" : "?lang=it";

  const p = showcasePlanner(en);
  const coming = p.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);
  const invited = p.guests.reduce((n, g) => n + g.party_size, 0);
  const committed = p.quotes.filter((x) => x.booked).reduce((n, x) => n + x.amount_cents, 0);
  const done = p.tasks.filter((x) => x.done).length;
  const seated = p.guests.filter((g) => g.table_id).reduce((n, g) => n + g.party_size, 0);
  const folder = Object.keys(p.docs).length;

  return (
    <div className="vt" lang={lang}>
      <header className="vt-top">
        <a className="vt-brand" href={`${base}${qs}`} aria-label="Bespoke Invite">
          <img src="/brand/logo.png" alt="" width={36} height={36} />
          <span>Bespoke Invite</span>
        </a>
        <nav className="vt-lang" aria-label={en ? "Language" : "Lingua"}>
          <a href={`${base}?lang=it`} aria-current={!en ? "page" : undefined}>IT</a>
          <a href={`${base}?lang=en`} aria-current={en ? "page" : undefined}>EN</a>
        </nav>
      </header>

      <section className="vt-hero">
        <p className="vt-kicker">{en ? "Private showcase" : "Vetrina riservata"}</p>
        <h1>{en ? <>Three invitations and a planner, <em>as couples really use them</em></> : <>Tre inviti e un planner, <em>come li usano davvero</em></>}</h1>
        <p className="vt-lede">
          {en
            ? "Each invitation is a real page from our engine: open it, tap the envelope, scratch the date, send a reply. The planner works in full: change anything you like. Nothing is saved and nobody receives an email."
            : "Ogni invito è una pagina vera del nostro motore: aprila, tocca la busta, gratta la data, prova a rispondere. Il planner funziona per intero: cambia quello che vuoi. Non si salva nulla e nessuno riceve email."}
        </p>
        <ul className="vt-jump">
          {CARDS.map((c) => <li key={c.key}><a href={`#${c.key}`}>{c.title}</a></li>)}
          <li><a href="#planner">{en ? "Planner" : "Planner"}</a></li>
        </ul>
      </section>

      <section className="vt-invites" aria-label={en ? "Invitations" : "Inviti"}>
        {CARDS.map((c, i) => (
          <article key={c.key} id={c.key} className={`vt-card${i % 2 ? " is-flip" : ""}`}>
            <div className="vt-phone">
              <div className="vt-screen">
                <iframe title={`${c.title} · ${c.theme}`} src={`${base}/invito/${c.key}?cover=0&lang=${lang}`} loading={i === 0 ? "eager" : "lazy"} />
              </div>
            </div>
            <div className="vt-info">
              <p className="vt-meta"><span>{t(c.kind)}</span><span aria-hidden="true">·</span><span>{en ? "Template" : "Template"} {c.theme}</span></p>
              <h2>{c.title}</h2>
              <p className="vt-when">{t(c.when)}<br />{t(c.where)}</p>
              <p className="vt-text">{t(c.text)}</p>
              <ul className="vt-notes">{c.notes.map((n) => <li key={n[0]}>{t(n)}</li>)}</ul>
              <div className="vt-actions">
                <a className="vt-btn is-solid" href={`${base}/invito/${c.key}?lang=${lang}`} target="_blank" rel="noopener">{en ? "Open with the envelope" : "Apri con la busta"}</a>
                <a className="vt-btn" href={`${base}/invito/${c.key}?lang=${en ? "it" : "en"}`} target="_blank" rel="noopener">{en ? "Italian version" : "Versione inglese"}</a>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section id="planner" className="vt-planner" aria-labelledby="vt-planner-title">
        <div className="vt-planner-head">
          <p className="vt-kicker">{en ? "The planner" : "Il planner"}</p>
          <h2 id="vt-planner-title">{en ? "Chiara and Salvo's wedding, ten months out" : "Il matrimonio di Chiara e Salvo, a dieci mesi"}</h2>
          <p className="vt-lede">
            {en
              ? "The same wedding as the first invitation, halfway through the organising: replies coming in, deposits paid, tables half filled. Add a guest, tick off a task, move someone to another table, compare two photographers."
              : "Lo stesso matrimonio del primo invito, a metà dell'organizzazione: risposte che arrivano, caparre versate, tavoli a metà. Aggiungi un invitato, spunta un'attività, sposta qualcuno di tavolo, confronta due fotografi."}
          </p>
        </div>
        <dl className="vt-stats">
          <div><dt>{en ? "Coming" : "Confermati"}</dt><dd>{coming}<small> / {invited}</small></dd></div>
          <div><dt>{en ? "Committed" : "Impegnato"}</dt><dd>{euro(committed, en)}<small> / {euro(p.budgetCents, en)}</small></dd></div>
          <div><dt>{en ? "Seated" : "A tavola"}</dt><dd>{seated}<small> {en ? "people" : "persone"}</small></dd></div>
          <div><dt>{en ? "Tasks done" : "Attività fatte"}</dt><dd>{done}<small> / {p.tasks.length}</small></dd></div>
          <div><dt>{en ? "Vendors" : "Fornitori"}</dt><dd>{p.vendors.length}</dd></div>
          <div><dt>{en ? "Folder sections" : "Sezioni della cartella"}</dt><dd>{folder}</dd></div>
        </dl>
        <div className="vt-actions is-center">
          <a className="vt-btn is-solid is-big" href={`${base}/planner${qs}`}>{en ? "Open the planner" : "Apri il planner"}</a>
        </div>
        <p className="vt-fine">{en ? "Demo mode: changes stay on this page and disappear when you leave it." : "Modalità demo: le modifiche restano in questa pagina e spariscono quando la lasci."}</p>
      </section>

      <footer className="vt-foot">
        <p>{en ? "The people, businesses and phone numbers in these examples are fictional." : "Persone, aziende e numeri di telefono di questi esempi sono inventati."}</p>
        <a href="https://www.thebespokeinvite.com">thebespokeinvite.com</a>
      </footer>
    </div>
  );
}
