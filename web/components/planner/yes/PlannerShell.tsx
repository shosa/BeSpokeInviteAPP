"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_TYPES } from "@inviteme/shared";
import type { PremiumData } from "../PremiumPlanner";
import { PlannerIcon } from "../PlannerIcon";
import { YesPlanner } from "./YesPlanner";
import { daysUntil } from "./model";

// Pagina del planner dentro il sito: barra Bespoke, al centro icona, nome dell'evento e «Accedi al planner».
// Il pulsante apre il planner a tutto schermo con un cerchio che si allarga dal punto toccato (macchia d'olio);
// la chiusura fa il percorso inverso. Un link a una sezione (#tavoli…) apre il planner subito, senza animazione.
// Durante l'animazione il planner sta in un livello fisso; a planner aperto torna nel flusso della pagina, così
// lo scorrimento resta quello della finestra (barra laterale, intestazioni che si fissano in alto).
type Stage = "closed" | "opening" | "open" | "closing";
const MS = 650;

export function PlannerShell({ id, initial, lang, demo = false, accountHref, buyHref, backHref = "/account", backLabel }: {
  id: string;
  initial: PremiumData;
  lang: "it" | "en";
  demo?: boolean;
  accountHref?: string;
  buyHref?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [stage, setStage] = useState<Stage>("closed");
  const [origin, setOrigin] = useState({ x: 50, y: 50 }); // centro del cerchio, in % della finestra
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Link a una sezione del planner: si apre subito.
  useEffect(() => {
    if (window.location.hash.length > 1) setStage("open");
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  // A planner aperto la pagina sotto (barra del sito e copertina) non serve: si nasconde e non scorre.
  useEffect(() => {
    document.body.classList.toggle("yp-open", stage === "open");
    return () => document.body.classList.remove("yp-open");
  }, [stage]);

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: ((r.left + r.width / 2) / window.innerWidth) * 100, y: ((r.top + r.height / 2) / window.innerHeight) * 100 });
    if (reduced()) return setStage("open");
    setStage("opening");
    timer.current = setTimeout(() => { window.scrollTo({ top: 0 }); setStage("open"); }, MS);
  }

  function close() {
    // Si torna in cima, così il cerchio si richiude sulla parte visibile del planner, poi sul pulsante.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (reduced()) return setStage("closed");
    window.scrollTo({ top: 0 });
    setStage("closing");
    timer.current = setTimeout(() => setStage("closed"), MS);
  }

  const ev = initial.event;
  const typeLabel = EVENT_TYPES.find((x) => x.id === (ev.eventType ?? "wedding"));
  const days = daysUntil(ev.eventDate);
  const date = ev.eventDate ? new Intl.DateTimeFormat(en ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${ev.eventDate}T12:00:00`)) : "";
  const showPlanner = stage !== "closed";

  return (
    <>
      {stage !== "open" && (
        <section className="ypg" aria-labelledby="ypg-title">
          <div className="ypg-glow" aria-hidden="true" />
          <div className="ypg-card">
            <span className="ypg-ico"><PlannerIcon icon={initial.icon} eventType={ev.eventType} size={40} /></span>
            <p className="ypg-kicker">{t("Planner", "Planner")}{typeLabel ? ` · ${en ? typeLabel.labelEn : typeLabel.label}` : ""}</p>
            <h1 id="ypg-title" className="ypg-title">{ev.title || t("Il vostro evento", "Your event")}</h1>
            <p className="ypg-when">
              {date || t("Data da fissare", "Date to set")}
              {days !== null && days > 0 && <> · <strong>{days}</strong> {days === 1 ? t("giorno", "day") : t("giorni", "days")}</>}
            </p>
            <button type="button" className="btn solid ypg-open" onClick={open} disabled={stage !== "closed"}>{t("Accedi al planner", "Open the planner")}</button>
            {backLabel && <a className="link ypg-back" href={backHref}>← {backLabel}</a>}
          </div>
        </section>
      )}

      {showPlanner && (
        <div
          className={`ypg-stage is-${stage}`}
          style={{ "--ox": `${origin.x}%`, "--oy": `${origin.y}%`, "--ms": `${MS}ms` } as React.CSSProperties}
        >
          <YesPlanner id={id} initial={initial} lang={lang} demo={demo} accountHref={accountHref} buyHref={buyHref} onClose={close} />
        </div>
      )}
    </>
  );
}
