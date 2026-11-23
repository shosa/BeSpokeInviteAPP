import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { initials, type ProStudio } from "./types";
import "./pro.css";

// Struttura delle pagine dell'area Pro: barra del sito, barra laterale dello studio (in alto sul telefono), contenuto.
type Section = "panoramica" | "clienti" | "nuovo" | "crediti";

const Ico = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 10.4 12 3.8l8 6.6V20a.9.9 0 0 1-.9.9h-4.3v-5.6H9.2v5.6H4.9A.9.9 0 0 1 4 20z" /></svg>,
  people: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="9" cy="8.2" r="3.3" /><path d="M3.3 19.7c.4-3.3 2.7-5.5 5.7-5.5s5.3 2.2 5.7 5.5z" /><circle cx="16.7" cy="8.8" r="2.6" /><path d="M16.3 13.6c2.6 0 4.3 1.9 4.5 4.9h-3.5" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  coins: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><ellipse cx="9" cy="7" rx="5.5" ry="2.6" /><path d="M3.5 7v4.5c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V7" /><path d="M9.5 16.4c.6 1.3 2.9 2.3 5.5 2.3 3 0 5.5-1.2 5.5-2.6V11.6c0-1.3-2.1-2.4-4.9-2.6" /></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20c.6-3.8 3.4-6 7.2-6s6.6 2.2 7.2 6" /></svg>,
};

export function ProShell({ studio, active, lang, children }: { studio: ProStudio; active: Section; lang: "it" | "en"; children: ReactNode }) {
  const en = lang === "en";
  const cur = (s: Section) => (active === s ? ("page" as const) : undefined);
  const plan = studio.plan.invitations || studio.plan.planners
    ? en
      ? `${studio.plan.invitations} invitations and ${studio.plan.planners} planners every month, on day ${studio.plan.renewDay}`
      : `${studio.plan.invitations} inviti e ${studio.plan.planners} planner ogni mese, il giorno ${studio.plan.renewDay}`
    : en ? "Credits assigned by Bespoke" : "Crediti assegnati da Bespoke";
  return (
    <>
      <Nav current="pro" lang={lang} />
      <div className="pro">
        <aside className="pro-side" aria-label={en ? "Pro area" : "Area Pro"}>
          <div className="pro-studio">
            <span className="pro-mono" aria-hidden="true">{initials(studio.name)}</span>
            <div><strong>{studio.name}</strong><span className="pro-badge">Bespoke Pro</span></div>
          </div>
          <nav className="pro-nav" aria-label={en ? "Sections" : "Sezioni"}>
            <a href="/pro" aria-current={cur("panoramica")}>{Ico.home}{en ? "Overview" : "Panoramica"}</a>
            <a href="/pro/clienti" aria-current={cur("clienti")}>{Ico.people}{en ? "Clients" : "Clienti"}<span>{studio.stats.clients}</span></a>
            <a href="/pro/nuovo" aria-current={cur("nuovo")}>{Ico.plus}{en ? "New event" : "Nuovo evento"}</a>
            <a href="/pro/crediti" aria-current={cur("crediti")}>{Ico.coins}{en ? "Credits" : "Crediti"}<span>{studio.credits.invitations} · {studio.credits.planners}</span></a>
            <a href="/account">{Ico.user}{en ? "My account" : "La mia area"}</a>
          </nav>
          <div className="pro-plan">
            <span className="pro-badge">{en ? "Your plan" : "Il tuo piano"}</span>
            <strong>{studio.plan.invitations || studio.plan.planners ? (en ? "Studio · monthly" : "Studio · mensile") : (en ? "Studio" : "Studio")}</strong>
            <p>{plan}</p>
          </div>
        </aside>
        <main className="pro-main">{children}</main>
      </div>
    </>
  );
}
