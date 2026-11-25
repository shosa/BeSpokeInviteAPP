import type { Metadata } from "next";
import { BookOpen, CalendarDays, Check, MailOpen, MapPin, Pencil } from "lucide-react";
import { Nav } from "@/components/Nav";
import { PlannerShell } from "@/components/planner/yes/PlannerShell";
import { plannerFonts } from "@/components/planner/yes/fonts";
import type { Weather } from "@/components/planner/yes/model";
import { showcasePlanner } from "@/lib/showcasePlanner";
import { getLang } from "@/lib/i18n";
import { DEMO_CARDS } from "./cards";
import "./demo.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Demo · Bespoke Invite" : "Demo · Bespoke Invite",
    description: en ? "Three invitations and a wedding planner, made with Bespoke Invite." : "Tre inviti e un planner, fatti con Bespoke Invite.",
    robots: { index: false, follow: false, nocache: true },
  };
}

// Meteo d'esempio per Noto a metà settembre: sole e caldo.
const TEMPS = [21, 20, 20, 19, 19, 20, 21, 23, 25, 27, 28, 29, 30, 30, 30, 29, 28, 27, 26, 25, 24, 23, 22, 22];
const NOTO_WEATHER: Weather = { forecast: { tmaxC: 30, tminC: 19, precipMm: 0, precipProb: 5, code: 1, hourly: TEMPS.map((tempC, hour) => ({ hour, tempC, precipMm: 0 })) }, place: "Noto", sample: true };

// Demo (/demo, non collegata dal sito e non indicizzata): tre inviti completi e il planner del primo, che si apre
// qui, a tutto schermo. Nel planner si modifica tutto e si crea il PDF; uscendo dalla pagina non resta nulla.
export default async function Demo() {
  const lang = await getLang();
  const en = lang === "en";
  const t = (pair: [string, string]) => (en ? pair[1] : pair[0]);
  const p = showcasePlanner(en);

  return (
    <>
      <Nav lang={lang} />
      <div className="dm">
        <div className="dm-rest">
          <section className="wrap dm-hero">
            <p className="kicker">{en ? "Demo" : "Demo"}</p>
            <h1>{en ? "Three invitations and a planner" : "Tre inviti e un planner"}</h1>
            <p className="lede">
              {en
                ? "Each invitation is a real page: open it, tap the envelope, scratch the date, try replying. The planner works in full, PDF included. Nothing is saved and nobody receives an email."
                : "Ogni invito è una pagina vera: aprila, tocca la busta, gratta la data, prova a rispondere. Il planner funziona per intero, PDF compreso. Non si salva nulla e nessuno riceve email."}
            </p>
            <nav className="dm-jump" aria-label={en ? "Go to" : "Vai a"}>
              {DEMO_CARDS.map((c) => <a key={c.key} href={`#${c.key}`}>{c.title}</a>)}
              <a href="#planner"><BookOpen size={15} aria-hidden="true" /> Planner</a>
            </nav>
          </section>

          <section className="wrap dm-list" aria-label={en ? "Invitations" : "Inviti"}>
            {DEMO_CARDS.map((c, i) => {
              const href = `/demo/invito/${c.key}`;
              return (
                <article key={c.key} id={c.key} className={`dm-card${i % 2 ? " is-flip" : ""}`}>
                  <a className="dm-frames" href={href} aria-label={`${en ? "Open" : "Apri"} ${c.title}`}>
                    {/* Fermo immagine: la busta chiusa (grande) e la pagina principale (piccola, davanti). Si scorre solo aprendo l'invito. */}
                    <span className="dm-phone is-big" aria-hidden="true">
                      <span className="dm-screen">
                        <iframe src={`/demo/invito/${c.key}/pagina?lang=${lang}`} title="" tabIndex={-1} scrolling="no" loading={i === 0 ? "eager" : "lazy"} />
                      </span>
                    </span>
                    <span className="dm-phone is-small" aria-hidden="true">
                      <span className="dm-screen">
                        <iframe src={`/demo/invito/${c.key}/pagina?cover=0&lang=${lang}`} title="" tabIndex={-1} scrolling="no" loading="lazy" />
                      </span>
                    </span>
                  </a>
                  <div className="dm-info">
                    <p className="kicker">{t(c.kind)} · {c.theme}</p>
                    <h2>{c.title}</h2>
                    <p className="dm-facts">
                      <span><CalendarDays size={16} aria-hidden="true" /> {t(c.when)}</span>
                      <span><MapPin size={16} aria-hidden="true" /> {t(c.where)}</span>
                    </p>
                    <p className="dm-text">{t(c.text)}</p>
                    <ul className="dm-notes">{c.notes.map((n) => <li key={n[0]}><Check size={14} aria-hidden="true" /> {t(n)}</li>)}</ul>
                    <a className="btn solid" href={href}><MailOpen size={18} aria-hidden="true" /> {en ? "Open" : "Apri"}</a>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="wrap dm-planner-intro" id="planner" aria-labelledby="dm-planner-title">
            <p className="kicker">Planner</p>
            <h2 id="dm-planner-title">{en ? "Giulia and Matteo's wedding, ten months out" : "Il matrimonio di Giulia e Matteo, a dieci mesi"}</h2>
            <p className="lede">
              {en
                ? "The same wedding as the first invitation, halfway through the organising: replies coming in, deposits paid, tables half filled. Add a guest, tick off a task, move someone to another table, then create the PDF of the binder."
                : "Lo stesso matrimonio del primo invito, a metà dell'organizzazione: risposte che arrivano, caparre versate, tavoli a metà. Aggiungi un invitato, spunta un'attività, sposta qualcuno di tavolo, poi crea il PDF della cartella."}
            </p>
            <p className="dm-fine"><Pencil size={14} aria-hidden="true" /> {en ? "Demo mode: changes disappear when you leave the page." : "Modalità demo: le modifiche spariscono quando lasci la pagina."}</p>
          </section>
        </div>

        <div className={`dm-planner ${plannerFonts}`}>
          <PlannerShell id="demo" initial={p} lang={lang} demo demoWeather={NOTO_WEATHER} demoAccent="#9B1B30" buyHref="https://www.thebespokeinvite.com" openFromHash={false} />
        </div>
      </div>
    </>
  );
}
